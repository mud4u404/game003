# 任务单

Claude 编写、ChatGPT 执行、Claude 审查。流程见 `docs/WORKFLOW.md`。

| 编号 | 任务 | 状态 | 分支 |
|---|---|---|---|
| T001 | [等轴场景基础](T001-iso-scene.md) | 已完成 | `codex/T001-iso-scene` |
| T002 | [知识库格式与首批病种](T002-knowledge-base.md) | 已完成 | `codex/T002-knowledge-base` |
| T005 | [接力脚本：开工留言与进度心跳](T005-relay-heartbeat.md) | 待发布（需用户在场：重装接力服务会中断正在运行的任务） | `codex/T005-relay-heartbeat` |
| T003 | [就诊模拟引擎核心](T003-sim-core.md) | 已完成（Claude 实现） | `claude/T003-sim-core` |
| T006 | [可玩原型 v0.1：模拟接入画面](T006-playable.md) | 已完成（Claude 实现） | `claude/T006-playable` |
| T004 | [美术管线验证：一间诊室](T004-art-pipeline.md) | 暂停（PR #7 未合并：只换了内科诊室，全院新旧混杂；等 T007 方向验证后再按“房间模板自动布置”重新规划） | `codex/T004-art-pipeline` |
| T007 | 决策循环纸面测试（Claude 制作，用户试玩；页面 `prototypes/T007-director-desk.html`，已发布为 claude.ai 私有页面，试玩记录存在页面数据库 `playtests`） | 已结束：用户否定开关式规则和每日微调，见 `GAMEPLAY.md` 第 11 节 | `claude/compassionate-maxwell-azev51` |

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
