# game003

项目仓库：https://github.com/mud4u404/game003

本项目是一款面向手机端、严肃克制的专业医疗模拟游戏。玩家投资一家从小诊所起步的医院并任命管理层，观察其持续经营，在愿意时干预发展方向，逐步建立诊疗能力与专业声誉。产品方向及待验证建议见 `DESIGN.md`。现已有 0.1 可玩原型：2D 诊所场景、自动接诊、院长授权、第二诊室筹备、本地存档与离线补算。实现范围和限制见 `IMPLEMENTATION.md`。

## 开始工作

1. 阅读 `AGENTS.md`，遵守协作和提交规则。
2. 阅读 `HANDOFF.md`，确认当前进度、已知问题和下一步。
   产品设计工作还需阅读 `DESIGN.md`，区分用户已明确的方向与候选建议。
3. 查看 `git status` 与 `git log -5 --oneline`。在工作区干净时拉取最新进度：`git pull --ff-only`。

新电脑可使用 `git clone https://github.com/mud4u404/game003.git` 获取项目。文件夹名称不影响仓库连接；当前创建者的本地目录名是 `medical`。

## 运行与验证

需要 Node.js 20 或更高版本。应用无第三方依赖，不需要 `npm install`。

```sh
npm start
```

打开 `http://localhost:4173`。拖动场景、滚轮或双指缩放、点选人物；下方“院长”可以调整授权或委托启用第二诊室。横屏观察全院，竖屏近看并拖动探索。不要用文件协议直接打开 HTML。

```sh
npm test
npm run check
```

可选浏览器检查需要本机安装 Playwright 和 Chrome，在预览服务运行时执行：

```sh
# Playwright 可位于外部工具目录，无需加入应用依赖。
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser.cjs
```

浏览器检查覆盖授权/扩建、刷新存档、双标签互斥与接管、人物查看、移动端布局、离线进展及损坏存档保护；截图默认输出到 `/tmp/meiao-browser-checks`。

游戏进度只保存在当前浏览器的本地存储中，不会随 GitHub 代码同步。离线运行采用重开时补算，尚未部署云端常驻服务。LLM、专业疾病系统、科研与学科声誉尚未实现。

## 保存与接力

每完成一个可验证的小任务，更新 `HANDOFF.md`，提交相关文件并推送。只有推送成功的提交才能被其他电脑或云端 AI 获取。GitHub 不会自动接收本地文件保存，也不会同步聊天记录。

顺序接力默认使用 `main`；多个 AI 同时开发时，各自使用独立分支，通过 PR 合并。切换接手者时明确告知仓库和分支。
