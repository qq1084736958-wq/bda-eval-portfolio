/**
 * 评测集扩充 · 真实问题回流导出
 * ---------------------------------------------------------------------------
 * 从运行库 app.db 把「真实用户提问」从三个来源回流，整理成与现有
 * src/modules/evaluation/data/offline-eval-v1.json 同格式的「待标注候选用例」：
 *   1. unknown_questions —— 系统答不了的问题（最高价值的难例/badcase）
 *   2. feedback(NOT_HELPFUL) —— 用户明确不满意，附缺陷类型（修复+回归用例）
 *   3. query_traces —— 全部真实问答轨迹（主力样本）
 *
 * 重要原则（诚实红线）：
 *   - 真实「问题」可直接用；但 trace 里记录的 intent/status 是**系统自己过去的输出**，
 *     只作为草稿预填，一律标 needsHumanLabel=true，必须人工确认/改正后才算 gold label。
 *   - feedback(NOT_HELPFUL) 说明系统当时就答错了，其草稿期望值大概率是错的，
 *     人工要据「已知缺陷」重新定正确期望。
 *
 * 用法：
 *   GEN_DATE=2026-10-22 node scripts/export-eval-candidates.mjs
 * 产物：
 *   eval-expansion/offline-eval-candidates-v2.json   机器可读候选集
 *   eval-expansion/labeling-worksheet.md             人工标注工作表
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const GEN_DATE = process.env.GEN_DATE || new Date().toISOString().slice(0, 10);
const DB_PATH = process.env.DB_PATH || "data/app.db";
const OUT_DIR = "eval-expansion";

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const all = (sql) => db.prepare(sql).all();

// ── 维表：用户 / 部门 ───────────────────────────────────────────────────────
const deptById = Object.fromEntries(all("SELECT id,name FROM departments").map((d) => [d.id, d.name]));
const userById = Object.fromEntries(
  all("SELECT id,username,display_name,role,department_id FROM users").map((u) => [
    u.id,
    { account: u.username, role: u.role, department: deptById[u.department_id] || "" },
  ]),
);

// ── 会话消息（用于还原「上下文追问」的前序轮次）─────────────────────────────
// messages.content 存的是 JSON（如 {"text":"..."}），需解析出纯文本
function msgText(content) {
  const s = String(content ?? "").trim();
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const o = JSON.parse(s);
      return o.text || o.content || o.message || s;
    } catch {
      return s;
    }
  }
  return s;
}
const msgsByConv = {};
for (const m of all("SELECT conversation_id,role,content,created_at FROM messages ORDER BY created_at")) {
  (msgsByConv[m.conversation_id] ||= []).push({ role: m.role, created_at: m.created_at, text: msgText(m.content) });
}
// 取当前问题之前、且不等于当前问题本身的前序用户轮次（最多 2 条）
function priorUserTurns(convId, beforeIso, selfNorm) {
  if (!convId || !msgsByConv[convId]) return [];
  return msgsByConv[convId]
    .filter((m) => m.role === "USER" && m.created_at < beforeIso && norm(m.text) !== selfNorm && m.text)
    .slice(-2)
    .map((m) => m.text);
}

// ── 归一化 & 去重 ───────────────────────────────────────────────────────────
const norm = (q) =>
  (q || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[?？!！。.,，、:：]+$/g, "")
    .toLowerCase();

// 已有 gold 集的问题，用于排除重复（只加新问题）
const existing = JSON.parse(readFileSync("src/modules/evaluation/data/offline-eval-v1.json", "utf8"));
const existingKeys = new Set(existing.cases.map((c) => norm(c.question)));

// ── 映射：系统 intent → 评测用的 route 分类 ────────────────────────────────
function toRoute(intent) {
  const i = (intent || "").toLowerCase();
  if (i.includes("knowledge")) return "RAG";
  if (i === "question_normalization") return "CLARIFICATION";
  if (
    ["procurement_amount", "approval_amount", "procurement_result"].includes(i) ||
    /amount|result|procurement|approval|project_query/.test(i)
  )
    return "STRUCTURED";
  if (i === "unknown" || /unsupported|permission|metric_definition|datasource|anomaly/.test(i)) return "UNSUPPORTED";
  return "UNKNOWN";
}
function toCategory(route, status, targetModule, hasContext) {
  if (targetModule === "PERMISSIONS") return "权限安全";
  if (hasContext) return "上下文追问";
  if (route === "RAG") return "RAG知识问答";
  if (route === "STRUCTURED" && status === "ANSWERED") return "结构化经营查询";
  if (status === "CLARIFICATION_REQUIRED") return "上下文追问";
  if (status === "NO_DATA" || route === "UNSUPPORTED" || status === "UNSUPPORTED") return "无数据/无依据";
  if (route === "STRUCTURED") return "结构化经营查询";
  return "无数据/无依据";
}

const CATS = ["结构化经营查询", "RAG知识问答", "上下文追问", "权限安全", "无数据/无依据", "复合问题"];
const seq = {}; // 每个来源的流水号
const nextId = (src) => `EXP-${src}-${String((seq[src] = (seq[src] || 0) + 1)).padStart(3, "0")}`;

const candidates = [];
const seen = new Map(); // normKey -> candidate（用于合并重复并累加出现次数）

function push(cand) {
  const key = norm(cand.question);
  if (!key || existingKeys.has(key)) return; // 跳过空与已在 gold 集的
  if (seen.has(key)) {
    seen.get(key)._meta.occurrences += cand._meta.occurrences;
    return; // 合并重复
  }
  seen.set(key, cand);
  candidates.push(cand);
}

function baseCase(src, question, { account = "", role = "", department = "", contextTurns = [] } = {}) {
  return {
    caseId: nextId(src),
    category: "", // 草稿分类放 _meta，留空待人工落位
    subtype: "",
    priority: "",
    capabilityStage: "待人工确认",
    account,
    role,
    department,
    contextTurns,
    question,
    expectedRoute: "", // ↓ 人工确认后填；草稿见 _meta.draft
    expectedStatus: "",
    expectedMetric: "",
    expectedFilters: null,
    expectedValue: null,
    expectedDocuments: [],
    forbiddenDocuments: [],
    assertions: [],
    scoringDimensions: [],
    sourceBasis: "data/app.db",
    _meta: {},
  };
}

// ── 来源 1：unknown_questions（难例/badcase，优先级最高）────────────────────
for (const r of all(
  "SELECT question,category,occurrence_count,target_module,status FROM unknown_questions",
)) {
  const c = baseCase("U", r.question);
  const route = "UNSUPPORTED";
  const cat = toCategory(route, "UNSUPPORTED", r.target_module, false);
  c._meta = {
    labelSource: "unknown-pool",
    occurrences: r.occurrence_count || 1,
    needsHumanLabel: true,
    draftFromSystemOutput: true,
    draft: { category: cat, expectedRoute: route, expectedStatus: "UNSUPPORTED" },
    unknownCategory: r.category,
    targetModule: r.target_module,
    priorityHint: (r.occurrence_count || 1) >= 3 ? "P0" : (r.occurrence_count || 1) >= 2 ? "P1" : "P2",
  };
  push(c);
}

// ── 来源 2：feedback(NOT_HELPFUL)（已知缺陷 → 修复+回归用例）────────────────
for (const r of all(
  `SELECT t.question,t.intent,t.status,t.user_id,f.reason,f.comment
     FROM feedback f JOIN query_traces t ON t.id=f.trace_id
    WHERE f.rating='NOT_HELPFUL'`,
)) {
  const u = userById[r.user_id] || {};
  const c = baseCase("F", r.question, u);
  const route = toRoute(r.intent);
  c._meta = {
    labelSource: "feedback-badcase",
    occurrences: 1,
    needsHumanLabel: true,
    draftFromSystemOutput: true,
    draft: { category: toCategory(route, r.status, null, false), expectedRoute: route, expectedStatus: r.status },
    knownDefect: [r.reason, r.comment].filter(Boolean).join(" · "),
    systemPastOutput: { intent: r.intent, status: r.status },
    priorityHint: "P0", // 用户明确不满意，置顶
    note: "用户当时不满意，系统过去输出很可能是错的；请据『已知缺陷』定正确期望，别照抄草稿。",
  };
  push(c);
}

// ── 来源 3：query_traces（主力真实样本）─────────────────────────────────────
for (const r of all(
  `SELECT id,conversation_id,user_id,question,status,intent,metric_id,filters_json,permission_rule,created_at
     FROM query_traces ORDER BY created_at DESC`,
)) {
  const u = userById[r.user_id] || {};
  const noisy = /部门选择[:：]|继续查询[:：]/.test(r.question); // 澄清流程拼接出的 UI 噪声串
  const ctx = priorUserTurns(r.conversation_id, r.created_at, norm(r.question));
  const qlen = r.question.replace(/\s/g, "").length;
  const hasContext = !noisy && ctx.length > 0 && qlen <= 12; // 短问 + 有真实前序 → 疑似追问
  const route = toRoute(r.intent);
  const cat = toCategory(route, r.status, null, hasContext);
  const c = baseCase("T", r.question, { ...u, contextTurns: hasContext ? ctx : [] });
  let filters = null;
  try {
    filters = r.filters_json ? JSON.parse(r.filters_json) : null;
  } catch {}
  c._meta = {
    labelSource: "trace",
    occurrences: 1,
    needsHumanLabel: true,
    draftFromSystemOutput: true,
    draft: {
      category: cat,
      expectedRoute: route,
      expectedStatus: r.status,
      expectedMetric: r.metric_id || "",
      expectedFilters: filters,
    },
    hasPriorContext: ctx.length > 0,
    noisy,
    priorityHint: "P1",
  };
  push(c);
}

// ── 统计 ────────────────────────────────────────────────────────────────────
const bySource = {};
const byCat = Object.fromEntries(CATS.map((c) => [c, 0]));
for (const c of candidates) {
  bySource[c._meta.labelSource] = (bySource[c._meta.labelSource] || 0) + 1;
  const dc = c._meta.draft?.category || "无数据/无依据";
  byCat[dc] = (byCat[dc] || 0) + 1;
}

mkdirSync(OUT_DIR, { recursive: true });

// ── 产物 1：候选集 JSON ─────────────────────────────────────────────────────
const outJson = {
  dataset: "business-data-assistant-offline-eval-candidates-v2",
  generatedAt: GEN_DATE,
  source: "data/app.db 的 unknown_questions / feedback(NOT_HELPFUL) / query_traces 回流",
  caveat:
    "候选用例的 expected* 为系统过去输出的草稿，needsHumanLabel=true；未经人工确认不得当作 gold label，更不得据此写真实准确率。",
  draftCategoryCounts: byCat,
  sourceCounts: bySource,
  total: candidates.length,
  cases: candidates,
};
writeFileSync(`${OUT_DIR}/offline-eval-candidates-v2.json`, JSON.stringify(outJson, null, 2));

// ── 产物 2：人工标注工作表 Markdown ─────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
let md = `# 评测集扩充 · 人工标注工作表\n\n`;
md += `- 生成日期：${GEN_DATE}\n`;
md += `- 来源：真实运行库 \`data/app.db\`（未知问题池 / 用户反馈 / 问答轨迹回流）\n`;
md += `- 候选总数：**${candidates.length}** 条（已排除与现有 gold 集重复的问题）\n`;
md += `- 来源分布：${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(" / ")}\n\n`;
md += `> 标注说明：\`期望*\` 列请人工填写最终 gold label。\`系统过去输出(草稿)\` 仅供参考；\n`;
md += `> **反馈类(feedback-badcase)务必据『已知缺陷』定正确期望，不要照抄草稿。** 确认后把该行整理进正式数据集。\n\n`;

for (const cat of CATS) {
  const rows = candidates.filter((c) => (c._meta.draft?.category || "无数据/无依据") === cat);
  if (!rows.length) continue;
  md += `## ${cat}（${rows.length}）\n\n`;
  md += `| caseId | 问题 | 角色/部门 | 前序上下文 | 来源 | 出现 | 系统过去输出(草稿) | 已知缺陷 | ✅期望Route | ✅期望Status | ✅期望指标/文档 | ✅断言 |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const c of rows) {
    const d = c._meta.draft || {};
    const past = [d.expectedRoute, d.expectedStatus, d.expectedMetric].filter(Boolean).join("/");
    const qCell = (c._meta.noisy ? "⚠️ " : "") + esc(c.question);
    md += `| ${c.caseId} | ${qCell} | ${esc([c.role, c.department].filter(Boolean).join(" "))} | ${esc(c.contextTurns.join(" ⏎ "))} | ${c._meta.labelSource} | ${c._meta.occurrences} | ${esc(past)} | ${esc(c._meta.knownDefect || "")} |  |  |  |  |\n`;
  }
  md += `\n`;
}
writeFileSync(`${OUT_DIR}/labeling-worksheet.md`, md);

// ── 控制台汇总 ──────────────────────────────────────────────────────────────
console.log("✅ 导出完成");
console.log(`  候选总数: ${candidates.length}`);
console.log(`  来源分布:`, bySource);
console.log(`  草稿分类分布:`, byCat);
console.log(`  产物: ${OUT_DIR}/offline-eval-candidates-v2.json`);
console.log(`        ${OUT_DIR}/labeling-worksheet.md`);
