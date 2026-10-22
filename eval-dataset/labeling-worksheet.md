# 评测集扩充 · 人工标注工作表

- 生成日期：2026-10-22
- 来源：真实运行库 `data/app.db`（未知问题池 / 用户反馈 / 问答轨迹回流）
- 候选总数：**66** 条（已排除与现有 gold 集重复的问题）
- 来源分布：unknown-pool 12 / feedback-badcase 6 / trace 48

> 标注说明：`期望*` 列请人工填写最终 gold label。`系统过去输出(草稿)` 仅供参考；
> **反馈类(feedback-badcase)务必据『已知缺陷』定正确期望，不要照抄草稿。** 确认后把该行整理进正式数据集。

## 结构化经营查询（18）

| caseId | 问题 | 角色/部门 | 前序上下文 | 来源 | 出现 | 系统过去输出(草稿) | 已知缺陷 | ✅期望Route | ✅期望Status | ✅期望指标/文档 | ✅断言 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EXP-F-001 | 查一下我们部门本季度采购金额 | DEPARTMENT_MANAGER 政企事业部 |  | feedback-badcase | 18 | STRUCTURED/ANSWERED | INACCURATE · 采购金额和采购系统里看到的数不一致，请核对是否包含暂估金额。 |  |  |  |  |
| EXP-F-006 | 今年本部门立项金额是多少 | EXECUTIVE |  | feedback-badcase | 5 | STRUCTURED/ANSWERED | INACCURATE |  |  |  |  |
| EXP-F-007 | 查看中标金额 | EXECUTIVE |  | feedback-badcase | 3 | STRUCTURED/ANSWERED | INACCURATE |  |  |  |  |
| EXP-T-008 | 查询本部门2026年立项金额 | EXECUTIVE |  | trace | 2 | STRUCTURED/ANSWERED/approval_amount |  |  |  |  |  |
| EXP-T-010 | 云网项目采购结果出来了吗 | EXECUTIVE |  | trace | 3 | STRUCTURED/ANSWERED/procurement_result |  |  |  |  |  |
| EXP-T-014 | 本部门待确认采购金额 | EXECUTIVE |  | trace | 1 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-027 | 本月采购金额按项目排名 | EXECUTIVE |  | trace | 2 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-031 | 按项目查看本季度是多少?采购金额 | EXECUTIVE |  | trace | 1 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-069 | 查询我们部门2026年采购金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 2 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-097 | 按项目查看2026年我们部门采购金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 1 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-098 | 查询2026年我们部门采购金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 2 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-113 | 查询2026年第二季度我们部门采购金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 2 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-118 | 2026年全公司采购金额是多少 | EXECUTIVE |  | trace | 1 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-121 | 按月查看本部门2026年立项金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 1 | STRUCTURED/ANSWERED/approval_amount |  |  |  |  |  |
| EXP-T-123 | 按项目查看查一下我们部门本季度采购金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 1 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-140 | 按项目查看今年本部门是多少立项金额 | EXECUTIVE |  | trace | 1 | STRUCTURED/ANSWERED/approval_amount |  |  |  |  |  |
| EXP-T-141 | 按月查看今年本部门是多少立项金额 | EXECUTIVE |  | trace | 1 | STRUCTURED/ANSWERED/approval_amount |  |  |  |  |  |
| EXP-T-167 | 今年全公司立项金额趋势 | EXECUTIVE |  | trace | 1 | STRUCTURED/ANSWERED/metric-approval-amount |  |  |  |  |  |

## RAG知识问答（5）

| caseId | 问题 | 角色/部门 | 前序上下文 | 来源 | 出现 | 系统过去输出(草稿) | 已知缺陷 | ✅期望Route | ✅期望Status | ✅期望指标/文档 | ✅断言 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EXP-F-003 | 本月采购金额统计口径是什么 | DEPARTMENT_MANAGER 网络建设部 |  | feedback-badcase | 2 | RAG/ANSWERED | OUTDATED · 口径说明似乎还是旧版本。 |  |  |  |  |
| EXP-F-005 | 这个规定适用于哪些部门？ | EXECUTIVE |  | feedback-badcase | 5 | RAG/ANSWERED | INACCURATE |  |  |  |  |
| EXP-T-044 | 投资型折旧成本是什么? | EXECUTIVE |  | trace | 1 | RAG/ANSWERED |  |  |  |  |  |
| EXP-T-112 | 同时告诉我达到多少必须公开招标 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 2 | RAG/ANSWERED |  |  |  |  |  |
| EXP-T-117 | 并解释采购金额指标的统计口径 | EXECUTIVE |  | trace | 1 | RAG/ANSWERED |  |  |  |  |  |

## 上下文追问（28）

| caseId | 问题 | 角色/部门 | 前序上下文 | 来源 | 出现 | 系统过去输出(草稿) | 已知缺陷 | ✅期望Route | ✅期望Status | ✅期望指标/文档 | ✅断言 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EXP-T-002 | 查看数据口径 | PROJECT_SPECIALIST 政企事业部 | 查一下我们部门本季度采购金额 | trace | 8 | RAG/ANSWERED |  |  |  |  |  |
| EXP-T-006 | 按项目拆分 | EXECUTIVE | 查询本部门2026年立项金额 ⏎ 查看数据口径 | trace | 8 | STRUCTURED/ANSWERED/approval_amount |  |  |  |  |  |
| EXP-T-013 | 本季度采购金额是多少? | OPERATOR |  | trace | 2 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-017 | ⚠️ 部门选择:我的部门,继续查询:本季度采购结果汇总一下 | EXECUTIVE |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_result |  |  |  |  |  |
| EXP-T-018 | 本季度采购结果汇总一下 | EXECUTIVE |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_result |  |  |  |  |  |
| EXP-T-022 | ⚠️ 部门选择:我的部门,继续查询:部门选择:我的部门,继续查询:本季度采购金额前十项目 | OPERATOR |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-023 | ⚠️ 部门选择:我的部门,继续查询:本季度采购金额前十项目 | OPERATOR |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-024 | 本季度采购金额前十项目 | OPERATOR |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-028 | 有例外审批情形吗? | EXECUTIVE | 按项目拆分 ⏎ 查看数据口径 | trace | 2 | RAG/ANSWERED |  |  |  |  |  |
| EXP-T-037 | ⚠️ 部门选择:我的部门,继续查询:去年同期采购金额对比 | EXECUTIVE |  | trace | 2 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-039 | 去年同期采购金额对比 | EXECUTIVE |  | trace | 5 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-055 | ⚠️ 部门选择:我的部门,继续查询:指标选择:采购金额,继续查询:查一下今年金额 | EXECUTIVE |  | trace | 2 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-056 | ⚠️ 指标选择:采购金额,继续查询:查一下今年金额 | EXECUTIVE |  | trace | 2 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-057 | 查一下今年金额 | EXECUTIVE |  | trace | 6 | CLARIFICATION/CLARIFICATION_REQUIRED |  |  |  |  |  |
| EXP-T-062 | ⚠️ 部门选择:我的部门,继续查询:指标选择:采购结果,继续查询:查一下今年金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_result |  |  |  |  |  |
| EXP-T-063 | ⚠️ 指标选择:采购结果,继续查询:查一下今年金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_result |  |  |  |  |  |
| EXP-T-064 | ⚠️ 部门选择:我的部门,继续查询:指标选择:立项金额,继续查询:查一下今年金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 2 | STRUCTURED/CLARIFICATION_REQUIRED/approval_amount |  |  |  |  |  |
| EXP-T-066 | ⚠️ 指标选择:立项金额,继续查询:查一下今年金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/approval_amount |  |  |  |  |  |
| EXP-T-068 | 采购金额 | DEPARTMENT_MANAGER 政企事业部 | 查询2026年网络建设部才够金额 ⏎ 采购金我 | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-072 | 公开招标标准是多少 | DEPARTMENT_MANAGER 政企事业部 | 公开招标标淮是多少 | trace | 1 | RAG/ANSWERED |  |  |  |  |  |
| EXP-T-080 | 查询美丽项目采购金额 | DEPARTMENT_MANAGER 政企事业部 | 查询2026年网络建设部采购金额 ⏎ 今年公司利润率是多少 | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-083 | 查询星河项目采购金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 4 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-095 | 按项目排名 | DEPARTMENT_MANAGER 政企事业部 | 按项目查看2026年我们部门采购金额 ⏎ 按项目拆分 | trace | 1 | STRUCTURED/ANSWERED/procurement_amount |  |  |  |  |  |
| EXP-T-106 | 查询星河项目2026年采购金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-125 | ⚠️ 部门选择：我的部门，继续查询：部门选择：我的部门，继续查询：去年同期采购金额对比 | EXECUTIVE |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-126 | ⚠️ 部门选择：我的部门，继续查询：去年同期采购金额对比 | EXECUTIVE |  | trace | 3 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-155 | 查询本季度采购金额 | EXECUTIVE | 去年同期采购金额对比 | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |
| EXP-T-157 | 查询全公司2025年采购金额 | OPERATOR |  | trace | 1 | STRUCTURED/CLARIFICATION_REQUIRED/procurement_amount |  |  |  |  |  |

## 权限安全（1）

| caseId | 问题 | 角色/部门 | 前序上下文 | 来源 | 出现 | 系统过去输出(草稿) | 已知缺陷 | ✅期望Route | ✅期望Status | ✅期望指标/文档 | ✅断言 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EXP-U-003 | 为什么我看不到其他部门的项目金额？ |  |  | unknown-pool | 3 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |

## 无数据/无依据（14）

| caseId | 问题 | 角色/部门 | 前序上下文 | 来源 | 出现 | 系统过去输出(草稿) | 已知缺陷 | ✅期望Route | ✅期望Status | ✅期望指标/文档 | ✅断言 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| EXP-U-001 | 云网项目是不是云网融合建设项目？ |  |  | unknown-pool | 6 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-004 | 最近采购异常有哪些？ |  |  | unknown-pool | 7 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-005 | 合同系统今天的数据同步了吗？ |  |  | unknown-pool | 4 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-006 | 本部门预算执行情况怎么样？ |  |  | unknown-pool | 6 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-007 | 公开招标项目完成情况 |  |  | unknown-pool | 3 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-015 | 查询 |  |  | unknown-pool | 3 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-016 | 查询2026年网络建设部才够金额 |  |  | unknown-pool | 3 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-017 | 全公司 |  |  | unknown-pool | 3 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-018 | 金额 |  |  | unknown-pool | 3 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-019 | 才够金额 |  |  | unknown-pool | 6 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-U-022 | 我负责项目的脱敏金额 |  |  | unknown-pool | 3 | UNSUPPORTED/UNSUPPORTED |  |  |  |  |  |
| EXP-F-002 | 云网融合项目采购结果出来了吗 | PROJECT_SPECIALIST 政企事业部 |  | feedback-badcase | 2 | STRUCTURED/NO_DATA | INCOMPLETE · 项目有采购进度，但没有返回结果说明。 |  |  |  |  |
| EXP-T-071 | 查询网络建设部2026年采购金额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 1 | STRUCTURED/NO_DATA/procurement_amount |  |  |  |  |  |
| EXP-T-073 | 查询网络建设部2026年采购额额 | DEPARTMENT_MANAGER 政企事业部 |  | trace | 1 | STRUCTURED/NO_DATA/procurement_amount |  |  |  |  |  |

