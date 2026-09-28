# macOS 本机接力安装与运行

`tools/codex-relay.mjs` 接收允许账号在同仓库、仍开放的 `codex/*` PR 上带 `<!-- relay:codex -->` 的评论。一次处理一条。任务在独立副本里执行；不会在正在使用的游戏目录切分支。

## 安装

需要已登录的 Codex CLI、`gh` 和可向仓库推送的 Git SSH 身份，Node.js 20+。在包含本次脚本版本的仓库执行：

```sh
node tools/install-codex-relay.mjs
```

安装器创建用户级 LaunchAgent `com.mud4u404.game003.codex-relay`，立即启动，并在 macOS 开机登录该用户后自动启动；不需要打开终端或 Codex 桌面窗口。用户注销/关机时停止，睡眠时暂停，唤醒后继续轮询。没有安装系统级 root 服务，也不承诺登录前运行。

安装器会固定 CLI、Node、gh 的绝对路径，避免 launchd 的简化 PATH 找不到命令。CLI 的现有 ChatGPT 登录和 gh 的系统钥匙串登录继续使用；plist 不含令牌或私钥。现有脚本副本更新需在接力空闲时重新运行安装器。

默认命令（本机 CLI 0.158.0-alpha.2.1 已验证支持）：

```sh
codex exec --approve-for-me -c sandbox_workspace_write.network_access=true \
  -C <独立工作目录> --output-last-message <结果文件> -
```

通过 stdin 传任务。`--approve-for-me` 保持 workspace-write 沙箱，将需要的 Git 写入批准交给自动审查。默认沙箱保护 `.git`；仅打开网络不足以保证提交和本地引用更新。没有使用 `--dangerously-bypass-approvals-and-sandbox`。自动审查如果拒绝必要操作，任务会记录为未完成，不冒充成功。

支持用 `CODEX_CMD` 覆盖命令。推荐 JSON argv 数组，能正确处理带空格的路径，例如：

```sh
CODEX_CMD='["/path with spaces/codex","exec","--approve-for-me","-c","sandbox_workspace_write.network_access=true"]' \
  node tools/install-codex-relay.mjs
```

也支持带单/双引号的命令字符串；始终直接 spawn，不经 shell 执行或展开命令替换。

## 本机文件与管理

- LaunchAgent：`~/Library/LaunchAgents/com.mud4u404.game003.codex-relay.plist`
- 固定运行脚本：`~/Library/Application Support/game003-relay/codex-relay.mjs`
- 独立 Git 副本：`~/Library/Application Support/game003-relay/workspace`
- 状态及日志：`~/Library/Application Support/game003-relay/state/`
- `state.json` 保存查询游标、执行状态、通知状态；`logs/` 保存每次任务的本机输出和最终答复；`launchd.stderr.log` 保存后台启动错误。

```sh
# 查看是否运行
launchctl print gui/$(id -u)/com.mud4u404.game003.codex-relay
# 停止并禁止下次登录自动启动
launchctl bootout gui/$(id -u)/com.mud4u404.game003.codex-relay
launchctl disable gui/$(id -u)/com.mud4u404.game003.codex-relay
# 恢复：重新运行安装器会 enable 并 bootstrap
```

脚本直接运行时，默认根目录为脚本所属仓库，状态目录为 `tools/.relay/`（已忽略）；正式安装通过 `RELAY_ROOT` / `RELAY_STATE_DIR` 指向上述独立位置。可配置 `RELAY_REPO`、`RELAY_AUTHORS`、`RELAY_INTERVAL_SEC`、`GH_BIN`。首次启动默认从当前时间接收新评论；已有状态不会重置。确需回查旧消息时，可在全新状态目录使用 `RELAY_SINCE` ISO 时间。编辑已处理的评论不会重跑，请发新评论。

`node tools/codex-relay.mjs --check` 查询待处理数量，不执行 Codex 或发布评论；`--once` 只执行一次轮询。第二个进程遇到同一状态目录的活动锁会拒绝启动，不能并行操作同一个副本。

## 失败与接力语义

- 评论按分页获取，筛选允许账号及标记；`<!-- relay:done -->` 的完成留言不触发自身。
- Git 副本有未提交文件、未推送提交、分叉或无上游时保留现场并报告失败，不清理、不覆盖。需要处理现场后由 Claude 发新评论。
- 执行成功还须核对分支、工作区和远程 HEAD，才留言“完成，请审查”。只将最终答复发回 PR，不将完整工具日志或 stderr 粘到 GitHub。
- 发布通知失败会重试通知，不重新执行任务；每条通知带源评论 ID，重启后先查已发布通知，避免重复留言。
- 执行途中进程退出会记录为中断，保留副本和日志；不自动重复可能已经执行的改动。需要检查后发新消息。
- 这是本机 CLI 接力，不会唤醒或写入桌面上原有的聊天；结果经 PR 通知 Claude。GitHub 评论轮询默认 60 秒，网络失败时下一轮重试。

## 验证

```sh
npm run check:relay
npm run test:relay
npm run verify
```

接力测试包含允许账号过滤、命令解析、状态恢复、单实例锁、分页及留言失败后的防重复执行。GitHub/Codex 控制流程的自动集成测试使用本地替身，不向远程发布测试评论；实机 CLI、后台运行及推送验证见 HANDOFF.md。本安装不修改游戏代码，不替代游戏正常入口的验收。

官方参考：[非交互运行](https://learn.chatgpt.com/docs/non-interactive-mode)、[沙箱与自动批准](https://learn.chatgpt.com/docs/agent-approvals-security)。实际参数以安装的 `codex exec --help` 为准；本机 sandbox 测试语法是 `codex sandbox [COMMAND]`，不是旧版文档的 `codex sandbox macos`。

## 2026-09-28 暂停与通知重试修正

用户确认由当前 Codex 会话接手，Claude 暂停。本机 LaunchAgent 已 bootout 并 disable，状态与日志保留；修正后的脚本副本已安装，但没有重新启用，以免再接取 T004 旧评论。通知失败现在独立捕获，按 1、2、4 分钟递增至最多 1 小时重试，不再挡住后续任务，也不重跑已完成任务。瞬时与持续失败均有集成测试。

GitHub PR 写权限仍需恢复后单独验证；修复重试逻辑不代表授权已修好。恢复前须核对积压评论与当前会话已完成的任务，避免重复开发；确认后按原安装步骤重新启用。T005 的开工留言和十五分钟心跳未在本轮实现。
