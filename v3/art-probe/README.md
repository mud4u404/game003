# 二维等轴美术实际样张

这是 **代码组合与运行的验证样张**，不是此前的整张 AI 概念图，也不是最终美术标准。场景由 `scene.js` 的独立地面、墙、桌椅、人物和室外元素组成；页面有一位患者从候诊区走向诊室的简易移动与暂停按钮。病例文本只是展示，不接诊断模型或旧存档。

运行：

```sh
npm start
# http://localhost:4173/v3/art-probe/
```

`node v3/art-probe/render-preview.mjs` 会从同一份 `scene.js` 生成 `preview.svg`；如安装了 Inkscape，可执行：

```sh
inkscape v3/art-probe/preview.svg --export-filename=v3/art-probe/preview.png --export-width=780 --export-height=1688
```

仓库中的 `preview.webp` 是代码渲染的审查图；`preview.png` 是同一画面的本地无损导出，不纳入仓库。顶部与底部 UI 在导出脚本中按页面版式用 SVG 重绘；它不是浏览器页面截图。渲染环境需有中文字库，否则导出时中文可能缺失。此轮没有手机真机、浏览器性能、触控或患者动画的完整验收；无法以这张图推断整家医院的最终素材成本。

这套画风比之前的概念图简化了纹理、光照与人物细节。若用户认可方向，下一步应先以一间诊室制作更高质量的**可复用人物与家具素材**，并在正常浏览器入口验收走、坐、问诊及遮挡；再决定是否全面采用。概念图不可直接作为场景底图。
