# v05 3D 白模小样（2026-09-28）

用户不喜欢 v03 方案 C 的 Q 版人物，要求“简单，但好看、专业”。ChatGPT 生成的白模效果图（`../v04/a-clay.webp`）被选作目标参考。用户要求先看实际效果再决定，因此 Claude 用 Three.js 做了一个**真实可运行的 3D 场景小样**，不是效果图。

- `clay3d-overview.png`：默认视角（手机竖屏，3 倍像素）
- `clay3d-closeup.png`：拉近到大厅和诊室
- `src/clay3d.html`：场景源码（Three.js 0.169，从 jsDelivr 加载）。正交等轴相机、柔和阴影、GTAO 环境光遮蔽；墙、家具、人物全部由简单几何体搭成，没有贴图和外部模型。
- `src/shot.cjs`：截图脚本。需先在 `src/` 目录用本地 HTTP 服务打开页面（ES 模块不能用 file:// 加载），例如 `python3 -m http.server 8765`，再运行 `node shot.cjs "http://localhost:8765/clay3d.html?dpr=3" out.png`。可选参数 `view`（可见宽度，米）、`cx`、`cz`（视角中心）。

局限：人物是胶囊体拼成的简化小人，没有动画；家具只是圆角方块；没做交互。这些是小样级别，正式开发时可以细化（更好的人物模型、走路动画、更多设备细节）。
