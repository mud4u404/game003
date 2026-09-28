# T004 自查（2026-09-28，Codex）

用户本轮重新选择白色/青绿色插画，参考为 `art/style/user-reference.png`，取代此前 D 图；用户授权 Codex 在 Claude 暂停期间接手开发及自查。本记录不是独立审查结论。

| 验收项 | 结果与证据 |
|---|---|
| 风格规范 | 已满足：`art/style/STYLE.md`，配色、投影、光照、比例、锚点与镜像限制 |
| 家具9种、人物8姿态 | 已满足：17个透明PNG与 `v2/assets/manifest.json`；内置imagegen逐件生成17次，提示词见 `art/style/PROMPTS.md` |
| 复用等轴引擎 | 已满足：复用投影、分段墙、排序、renderer、camera、picker；新增alpha素材节点，正式医院保留原人物路径 |
| 拖缩、点选、静止不重画 | 已满足：素材单元测试及 `tests/v2/art-browser.cjs`，alpha在加载时缓存 |
| 一间诊室验证场景 | 已满足：`/v2/?scene=clinic-room`；医生坐诊、患者坐诊、门外候诊；隔离存档 |
| 三张截图 | 已满足：`art/screens/T004/room.png`、`room-zoom.png`、`compare.png`，已目视检查 |
| 与参考完全统一 | 部分满足：白/青绿、少描边、比例与视角落实；柜体更立体、不同人物姿态脸部细节有差异，镜像光照未完全解决。等待用户视觉验收 |
| 自动检查 | 已满足：`npm run verify` 游戏/素材112项，接力6项通过；git diff检查通过 |
| 正式医院未受损 | 正常 `/v2/` 独立存储验证汇报、病历下钻、规则面板，真实时间观察与刷新续接详见HANDOFF；未读写用户浏览器存档 |
| 手机真机与完整整院新美术 | 未验证/未实施；本轮是诊室管线试验 |

附带接手修复：macOS AppleDouble 文件不再被知识库测试误认；接力通知持续失败不再堵住新任务，增加退避重试与集成测试。本机服务保持停用，修正版副本已安装。已尝试 `gh pr edit 7 --body-file tasks/T004-self-check.md`，GitHub返回 `Resource not accessible by personal access token (updatePullRequest)`；PR正文未更新，自查以此文件为准。GitHub PR API写权限仍未恢复，不能把重试逻辑修复称作授权修复。T005心跳仍待做。


## 用户追加动态试验的自查

正常入口接入范围、动画机制、路线改动、实际验证和已知差距见T004动态补充执行记录及HANDOFF最新条目。115项游戏/素材回归+6项接力回归通过，移动端模拟的真实病历点选/相机/静止帧通过。其他科室与员工仍待换装，未独立审查，未合并main。动态视频标注测试时钟；不以加速场景替代正常入口观察。
