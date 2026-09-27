# v03 效果图候选（2026-09-28）

用户否定了用几何线框表示美术方向，要求出三张“符合需求”的效果图供选择。三张图画的是同一家医院、同一个场景，全部用代码绘制（未使用生图模型），源文件在 `src/`，用 `src/render.cjs` 渲染成手机竖屏 PNG（390×844，3 倍像素）。

| 文件 | 风格 | 说明 |
|---|---|---|
| `a-pixel.png` | A 像素风 | 3/4 俯视，低分辨率像素、描边，Into the Breach 式清晰度 |
| `b-illustration.png` | B 柔和插画 | 贴近 v02 的 3/4 俯视插画，圆角、柔和投影 |
| `c-isometric.png` | C 等轴 2.5D | 接近 Project Hospital 的等轴视角，含室外救护车、停车场、道路 |

画面内容（诊室、检验科、候诊大厅、放射科、病房、病历卡、6 个管理入口）是示意，不代表已批准的布局或数值。用户选定前，v02 仍是视觉基准。

重新渲染：

```sh
cd art/concepts/v03/src
NODE_PATH=$(npm root -g) node render.cjs isometric.html ../c-isometric.png
```
