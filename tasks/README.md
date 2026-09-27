# 任务单

Claude 编写、ChatGPT 执行、Claude 审查。流程见 `docs/WORKFLOW.md`。

| 编号 | 任务 | 状态 | 分支 |
|---|---|---|---|
| T001 | [等轴场景基础](T001-iso-scene.md) | 已完成 | `codex/T001-iso-scene` |
| T002 | [知识库格式与首批病种](T002-knowledge-base.md) | 待审查 | `codex/T002-knowledge-base` |
| T003 | [就诊模拟引擎核心](T003-sim-core.md) | 待发布（依赖 T002） | `codex/T003-sim-core` |

## 任务单模板

```markdown
# T### 标题

状态：待开发 / 开发中 / 待审查 / 需修改 / 已完成
依据：（设计文档章节、参考图）

## 目标
## 背景
## 范围
### 要做
### 不做
## 验收标准
## 交付
## 执行记录（ChatGPT 填写）
## 审查记录（Claude 填写）
```
