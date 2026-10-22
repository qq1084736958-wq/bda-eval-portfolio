/**
 * 答案质量五维 · 自动 LLM-as-Judge（对人工评审流程的扩展）
 * ---------------------------------------------------------------------------
 * 说明：business-data-assistant 原设计里，五维质量分是「人工后台评审」。本脚本是我新增的
 * 自动评审层——复用产品既有 rubric（正确性/清晰度/依据充分性/可行动性/表达自然度，1–5）与
 * 判定阈值（每维≥3 且均分≥4 → PASS），用一个「跨家族」评审模型给系统答案打分，
 * 以便把质量评测规模化。它不替代人工复核；分数为自动评审，建议抽样与人工对齐校准。
 *
 * 被测系统答案由 DEEPSEEK_MODEL 生成；评审由 JUDGE_MODEL（默认 claude-haiku，异家族）给出。
 *
 * 评审范围：
 *   - 默认(default)评测集里确定性判定为 REVIEW 的用例（质量需主观评审的那批）
 *   - 答案质量专项集(answer-quality)全部用例
 *
 * 用法（需先 source .env.local 且 chroma 在跑）：
 *   npx tsx scripts/run-answer-quality-judge.ts
 * 产物：
 *   eval-expansion/answer-quality-report.json
 */
import { createDatabase } from "../src/db/client";
import { evaluationCases } from "../src/db/schema";
import { ensureDefaultEvaluationDataset, ensureAnswerQualityEvaluationDataset } from "../src/modules/evaluation/dataset-service";
import { SingleEvaluationCaseRunner } from "../src/modules/evaluation/single-case-runner";
import { autoEvaluateCase } from "../src/modules/evaluation/auto-evaluator";
import { ANSWER_QUALITY_DIMENSIONS, answerQualityVerdict, type AnswerQualityScores } from "../src/modules/evaluation/answer-quality-review";
import { eq } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "node:fs";

const GEN_DATE = process.env.GEN_DATE || new Date().toISOString().slice(0, 10);
const JUDGE_BASE = (process.env.JUDGE_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
const JUDGE_KEY = process.env.JUDGE_API_KEY || process.env.DEEPSEEK_API_KEY || "";
const JUDGE_MODEL = process.env.JUDGE_MODEL || "gpt-4.1-mini";
const SUT_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

// 把结构化 output 压成可读 JSON（折叠超长数组，避免把 50 条记录 ID 喂给评审）
function compact(o: any, depth = 0): any {
  if (Array.isArray(o)) return depth >= 2 || o.length > 6 ? `[array x${o.length}]` : o.map((x) => compact(x, depth + 1));
  if (o && typeof o === "object") {
    const r: any = {};
    for (const k of Object.keys(o)) {
      if (k === "sourceRecordIds" || k === "syncBatchIds") { r[k] = `[x${Array.isArray(o[k]) ? o[k].length : 0}]`; continue; }
      r[k] = compact(o[k], depth + 1);
    }
    return r;
  }
  if (typeof o === "string") return o.length > 400 ? o.slice(0, 400) + "…" : o;
  return o;
}

function extractJson(content: string): any {
  let s = content.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

const JUDGE_SYSTEM = `你是严格的企业经营问答「答案质量」评审专家。请只依据给定材料，对「系统实际输出」从五个维度各打一个 1–5 的整数分：
- 正确性：结论、数值、口径、权限处理是否与期望一致，有无编造或越权泄露。
- 清晰度：表达是否清楚、有条理、重点突出。
- 依据充分性：是否给出来源/口径/记录数/版本等可追溯依据。
- 可行动性：用户能否据此明确下一步（含失败时是否说明原因与建议）。
- 表达自然度：是否自然，有无机械重复用户问题。
评分要点(assertions)是该题的锚点：满足则相应维度高分，违背则低分。
只输出 JSON，不要多余文字：{"scores":{"正确性":n,"清晰度":n,"依据充分性":n,"可行动性":n,"表达自然度":n},"note":"≤60字理由"}`;

async function judge(payload: string): Promise<{ scores: AnswerQualityScores; note: string } | { error: string }> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const resp = await fetch(`${JUDGE_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${JUDGE_KEY}` },
        body: JSON.stringify({ model: JUDGE_MODEL, temperature: 0, messages: [{ role: "system", content: JUDGE_SYSTEM }, { role: "user", content: payload }] }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!resp.ok) { if (resp.status >= 500) throw new Error(`HTTP_${resp.status}`); return { error: `HTTP_${resp.status}` }; }
      const data: any = await resp.json();
      const content = data?.choices?.[0]?.message?.content;
      const parsed = extractJson(String(content ?? ""));
      if (!parsed?.scores) return { error: "PARSE_FAIL" };
      const scores = {} as AnswerQualityScores;
      for (const d of ANSWER_QUALITY_DIMENSIONS) {
        const v = Number(parsed.scores[d]);
        if (!Number.isInteger(v) || v < 1 || v > 5) return { error: `BAD_SCORE_${d}` };
        scores[d] = v;
      }
      return { scores, note: String(parsed.note ?? "").slice(0, 80) };
    } catch (e: any) {
      if (attempt === 1) return { error: String(e?.message || e) };
    }
  }
  return { error: "UNREACHABLE" };
}

function buildPayload(item: any, output: unknown, status: string) {
  return JSON.stringify({
    问题: item.question,
    上下文: JSON.parse(item.contextTurnsJson || "[]"),
    角色: item.roleLabel, 部门: item.departmentLabel,
    期望状态: item.expectedStatus, 期望路由: item.expectedRoute,
    评分要点: JSON.parse(item.assertionsJson || "[]"),
    期望值: JSON.parse(item.expectedValueJson || "{}"),
    系统实际状态: status,
    系统实际输出: compact(output),
  }, null, 1);
}

async function main() {
  const connection = createDatabase();
  try {
    const defaultDatasetId = ensureDefaultEvaluationDataset(connection.db);
    const aqDatasetId = ensureAnswerQualityEvaluationDataset(connection.db);
    const runner = new SingleEvaluationCaseRunner(connection);

    const defaultCases = connection.db.select().from(evaluationCases).where(eq(evaluationCases.datasetId, defaultDatasetId)).all();
    const aqCases = connection.db.select().from(evaluationCases).where(eq(evaluationCases.datasetId, aqDatasetId)).all();

    const judged: any[] = [];
    let i = 0;
    const LIMIT = process.env.JUDGE_LIMIT ? Number(process.env.JUDGE_LIMIT) : Infinity;

    const total = defaultCases.length + aqCases.length;
    const handle = async (item: any, group: string, onlyReview: boolean) => {
      if (judged.length >= LIMIT) return;
      i += 1;
      process.stderr.write(`\r评审 ${i}/${total} ${item.caseCode}            `);
      let execution;
      try {
        execution = await runner.run(item.id);
      } catch (e: any) {
        judged.push({ code: item.caseCode, group, category: item.category, error: `SUT_CRASH:${String(e?.message || e).slice(0, 60)}` });
        return;
      }
      if (onlyReview) {
        const det = autoEvaluateCase(item, execution);
        if (det.autoVerdict !== "REVIEW") return; // 只评 REVIEW（质量需主观判定）的那批
      }
      const res = await judge(buildPayload(item, execution.output, execution.status));
      if ("error" in res) { judged.push({ code: item.caseCode, group, category: item.category, error: res.error }); return; }
      const verdict = answerQualityVerdict(res.scores);
      const avg = ANSWER_QUALITY_DIMENSIONS.reduce((s, d) => s + res.scores[d], 0) / 5;
      judged.push({ code: item.caseCode, group, category: item.category, scores: res.scores, average: Math.round(avg * 100) / 100, verdict, note: res.note });
    };

    for (const item of defaultCases) await handle(item, "default-REVIEW", true);
    for (const item of aqCases) await handle(item, "answer-quality", false);
    process.stderr.write("\n");

    // ── 汇总 ────────────────────────────────────────────────────────────────
    const scored = judged.filter((r) => r.scores);
    const errors = judged.filter((r) => r.error);
    const dimAvg: Record<string, number> = {};
    for (const d of ANSWER_QUALITY_DIMENSIONS) dimAvg[d] = scored.length ? Math.round((scored.reduce((s, r) => s + r.scores[d], 0) / scored.length) * 100) / 100 : 0;
    const overallAvg = scored.length ? Math.round((scored.reduce((s, r) => s + r.average, 0) / scored.length) * 100) / 100 : 0;
    const passN = scored.filter((r) => r.verdict === "PASS").length;
    const passRate = scored.length ? Math.round((passN / scored.length) * 1000) / 10 : null;

    const byGroup: Record<string, any> = {};
    for (const g of [...new Set(scored.map((r) => r.group))]) {
      const sub = scored.filter((r) => r.group === g);
      byGroup[g] = { n: sub.length, avg: Math.round((sub.reduce((s, r) => s + r.average, 0) / sub.length) * 100) / 100, pass: sub.filter((r) => r.verdict === "PASS").length };
    }
    const lows = scored.filter((r) => r.verdict === "FAIL").sort((a, b) => a.average - b.average).map((r) => ({ code: r.code, avg: r.average, note: r.note, scores: r.scores }));

    const report = {
      generatedAt: GEN_DATE, sutModel: SUT_MODEL, judgeModel: JUDGE_MODEL,
      method: "自动 LLM-as-Judge（扩展原人工评审流程）；跨家族评审，未与人工分数校准，建议抽样对齐。",
      total: judged.length, scored: scored.length, errors: errors.length,
      overallAverage: overallAvg, passRate, dimensionAverages: dimAvg, byGroup,
      failCases: lows, errorCases: errors,
    };
    mkdirSync("eval-expansion", { recursive: true });
    writeFileSync("eval-expansion/answer-quality-report.json", JSON.stringify(report, null, 2));

    console.log(`\n==== 答案质量五维评审 · ${GEN_DATE} ====`);
    console.log(`被测模型: ${SUT_MODEL} | 评审模型: ${JUDGE_MODEL}`);
    console.log(`评审用例: ${scored.length}（错误 ${errors.length}）`);
    console.log(`综合均分: ${overallAvg}/5  通过率(每维≥3且均分≥4): ${passRate}%`);
    console.log(`各维度均分:`, ANSWER_QUALITY_DIMENSIONS.map((d) => `${d} ${dimAvg[d]}`).join(" | "));
    console.log(`分组:`, Object.entries(byGroup).map(([g, a]: any) => `${g} n=${a.n} 均分${a.avg} PASS${a.pass}`).join("  |  "));
    if (lows.length) console.log(`\n低分项(${lows.length}): ${lows.map((r) => `${r.code}(${r.avg})`).join(", ")}`);
    if (errors.length) console.log(`评审失败: ${errors.map((r) => `${r.code}:${r.error}`).join(", ")}`);
    console.log(`\n报告: eval-expansion/answer-quality-report.json`);
  } finally {
    connection.sqlite.close();
  }
}

void main();
