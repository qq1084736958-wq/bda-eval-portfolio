/**
 * 离线评测 · 全量基线运行器（headless）
 * ---------------------------------------------------------------------------
 * 跑数据库里 default 数据集的全部评测用例，真实调用助手管线，用 autoEvaluateCase
 * 做确定性判定，并汇总为可写进作品集的基线指标：
 *   - 路由准确率 routeAccuracy（意图/路由判对率）
 *   - 状态准确率 statusAccuracy（ANSWERED/CLARIFICATION/NO_DATA/UNSUPPORTED 判对率）
 *   - 引用命中率 evidenceHit（RAG 必需文档召回且不含禁用文档）
 *   - 结构化取值正确率 valueCorrect（金额/记录数等精确匹配）
 *   - PASS / REVIEW / FAIL 分布 + 按类别细分 + 失败清单
 *
 * 运行模式由 DEEPSEEK_API_KEY 决定：有 key → 真实 deepseek-chat；无 key → 规则/抽取式降级。
 * 需要 chroma 服务在 127.0.0.1:8000（RAG 用例检索）。
 *
 * 用法：
 *   npx tsx scripts/run-offline-baseline.ts
 * 产物：
 *   eval-expansion/baseline-report.json
 */
import { createDatabase } from "../src/db/client";
import { evaluationCases } from "../src/db/schema";
import { ensureDefaultEvaluationDataset } from "../src/modules/evaluation/dataset-service";
import { SingleEvaluationCaseRunner } from "../src/modules/evaluation/single-case-runner";
import { autoEvaluateCase } from "../src/modules/evaluation/auto-evaluator";
import { writeFileSync, mkdirSync } from "node:fs";

const GEN_DATE = process.env.GEN_DATE || new Date().toISOString().slice(0, 10);
const modelMode = process.env.DEEPSEEK_API_KEY ? `deepseek (${process.env.DEEPSEEK_MODEL || "deepseek-chat"})` : "rule-only/extractive (无 key 降级)";

function rate(trueN: number, denom: number) {
  return denom === 0 ? null : Math.round((trueN / denom) * 1000) / 10; // 百分比，一位小数
}

async function main() {
  const connection = createDatabase();
  try {
    ensureDefaultEvaluationDataset(connection.db);
    const cases = connection.db
      .select({
        id: evaluationCases.id,
        code: evaluationCases.caseCode,
        category: evaluationCases.category,
        priority: evaluationCases.priority,
        expectedStatus: evaluationCases.expectedStatus,
        expectedRoute: evaluationCases.expectedRoute,
        expectedValueJson: evaluationCases.expectedValueJson,
        expectedDocumentsJson: evaluationCases.expectedDocumentsJson,
        forbiddenDocumentsJson: evaluationCases.forbiddenDocumentsJson,
      })
      .from(evaluationCases)
      .all();

    const runner = new SingleEvaluationCaseRunner(connection);
    const limited = process.env.CASE_LIMIT ? cases.slice(0, Number(process.env.CASE_LIMIT)) : cases;
    const rows: any[] = [];
    let i = 0;
    for (const item of limited) {
      i += 1;
      process.stderr.write(`\r跑用例 ${i}/${limited.length} ${item.code}            `);
      let ev;
      try {
        const result = await runner.run(item.id);
        ev = autoEvaluateCase(item, result);
      } catch (e: any) {
        ev = { statusMatched: false, routeMatched: false, evidenceMatched: null, valueMatched: null, autoVerdict: "FAIL", error: String(e?.message || e) };
      }
      rows.push({ code: item.code, category: item.category, priority: item.priority, expectedRoute: item.expectedRoute, ...ev });
    }
    process.stderr.write("\n");

    // ── 汇总 ────────────────────────────────────────────────────────────────
    const agg = (subset: any[]) => {
      const n = subset.length;
      const routeOk = subset.filter((r) => r.routeMatched === true).length;
      const statusOk = subset.filter((r) => r.statusMatched === true).length;
      const evDen = subset.filter((r) => r.evidenceMatched !== null).length;
      const evOk = subset.filter((r) => r.evidenceMatched === true).length;
      const valDen = subset.filter((r) => r.valueMatched !== null).length;
      const valOk = subset.filter((r) => r.valueMatched === true).length;
      const pass = subset.filter((r) => r.autoVerdict === "PASS").length;
      const review = subset.filter((r) => r.autoVerdict === "REVIEW").length;
      const fail = subset.filter((r) => r.autoVerdict === "FAIL").length;
      return {
        n,
        routeAccuracy: rate(routeOk, n),
        statusAccuracy: rate(statusOk, n),
        evidenceHit: rate(evOk, evDen),
        valueCorrect: rate(valOk, valDen),
        verdict: { PASS: pass, REVIEW: review, FAIL: fail },
      };
    };

    const overall = agg(rows);
    const byCategory: Record<string, any> = {};
    for (const cat of [...new Set(rows.map((r) => r.category))]) byCategory[cat] = agg(rows.filter((r) => r.category === cat));
    const failures = rows.filter((r) => r.autoVerdict === "FAIL").map((r) => ({ code: r.code, category: r.category, route: r.routeMatched, status: r.statusMatched, evidence: r.evidenceMatched, value: r.valueMatched, error: r.error }));

    const report = { dataset: "default (offline-eval-v1)", generatedAt: GEN_DATE, modelMode, total: rows.length, overall, byCategory, failures };

    mkdirSync("eval-expansion", { recursive: true });
    writeFileSync("eval-expansion/baseline-report.json", JSON.stringify(report, null, 2));

    // ── 控制台 ──────────────────────────────────────────────────────────────
    console.log(`\n==== 离线评测基线 · ${GEN_DATE} ====`);
    console.log(`模式: ${modelMode} | 用例数: ${rows.length}`);
    console.log(`路由准确率: ${overall.routeAccuracy}%  状态准确率: ${overall.statusAccuracy}%  引用命中: ${overall.evidenceHit}%  结构化取值正确: ${overall.valueCorrect}%`);
    console.log(`判定: PASS ${overall.verdict.PASS} / REVIEW ${overall.verdict.REVIEW} / FAIL ${overall.verdict.FAIL}`);
    console.log(`\n按类别:`);
    for (const [cat, a] of Object.entries(byCategory)) console.log(`  ${cat.padEnd(10)} n=${(a as any).n}  route ${(a as any).routeAccuracy}%  status ${(a as any).statusAccuracy}%  value ${(a as any).valueCorrect ?? "-"}%  [P${(a as any).verdict.PASS}/R${(a as any).verdict.REVIEW}/F${(a as any).verdict.FAIL}]`);
    if (failures.length) console.log(`\n失败项(${failures.length}): ${failures.map((f) => f.code).join(", ")}`);
    console.log(`\n报告: eval-expansion/baseline-report.json`);
  } finally {
    connection.sqlite.close();
  }
}

void main();
