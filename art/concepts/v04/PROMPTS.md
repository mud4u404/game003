# v04 专业画风：生图提示词

2026-09-28。用户认为 v03 方案 C 的 Q 版人物“滑稽”，要求“可以简单，但要好看、专业”。代码绘制的画质有上限，改由 ChatGPT 的图像生成出效果图，Claude 负责美术方向和审查。

三个方向共用同一个场景，方便对比。每条提示词单独发给 ChatGPT 生成一张图，生成结果保存为 `art/concepts/v04/a-*.png` 等。

## 共同要求（已写进每条提示词）

- 手机竖屏游戏截图，9:16。
- 人物是真实身体比例（约 7 头身），不要 Q 版、大头、圆脸、腮红、卡通表情。
- 场景：一家小医院的剖开视角，包括诊室、检验科、候诊大厅、放射科（X 光）、三床病房；室外有急诊入口和救护车。
- 画面安静、干净、专业，像医疗建筑设计图或严肃模拟游戏，不像休闲手游。
- 界面元素少：只要顶部一条细状态栏和底部一排六个图标，不要大段文字（生图模型写中文容易出错，文字以后由游戏程序绘制）。

## A 建筑白模（极简、高级）

```
A vertical 9:16 mobile game screenshot of a hospital management simulation, isometric 2:1 projection, cutaway view of a small clinic with walls cut down so interiors are visible. Art style: architectural white-model / clay render — almost all surfaces matte white and warm light grey, soft global illumination, gentle ambient occlusion and soft contact shadows, very clean and calm, like an architect's presentation model. Only a few restrained accent colors: muted teal for staff uniforms and wayfinding floor lines, soft coral for the emergency sign and the ambulance stripe. Rooms: a doctor's consultation room with desk, monitor and exam couch; a laboratory with benches and analyzers; a waiting hall with rows of seats and a triage desk; an X-ray room with the X-ray table, overhead tube and a lead-glass control booth; a ward with three beds. Outside: pale ground, simple white model trees, an emergency entrance with a white ambulance. People are small realistic-proportion figures (about 7 heads tall), simplified and faceless like architectural scale figures, colored by role: doctors in white coats, nurses in teal scrubs, patients in muted clothing. No chibi, no big heads, no cartoon faces. Minimal UI: a thin translucent top status bar and a row of six simple line icons at the bottom, no readable text. Serious, elegant, professional, high detail, crisp.
```

## B 写实等轴（接近 Project Hospital）

```
A vertical 9:16 mobile game screenshot of a serious hospital management simulation, isometric 2:1 projection similar to Project Hospital, cutaway view with walls lowered so interiors are visible. Style: clean semi-realistic 3D render, realistic materials and lighting — light oak wood floor in the consultation room, terrazzo floor in the waiting hall, grey medical vinyl in the lab and X-ray room, pale sage vinyl in the ward, white walls with subtle dado rails, soft daylight from windows, soft shadows. Accurate medical equipment: consultation desk with monitor and exam couch, lab analyzers and centrifuge, X-ray table with overhead tube and lead-glass control booth, adjustable hospital beds with IV stands, rows of waiting seats and a triage desk. Outside: grass, a road, a parking lot, trees, an emergency entrance with a modern ambulance. People have realistic body proportions (about 7 heads tall) and natural clothing: doctors in white coats, nurses in teal scrubs, technicians in blue, varied patients, some seated, some walking, one patient in a wheelchair. No chibi, no big heads, no cartoon style. Calm, professional color palette with muted blues, whites, warm woods. Minimal UI: thin dark top status bar and six simple icons at the bottom, no readable text. High detail, crisp, polished.
```

## C 建筑平面图渲染（正俯视，最适合手机竖屏）

```
A vertical 9:16 mobile game screenshot of a hospital management simulation, strict top-down orthographic view, styled like a high-end architectural floor plan rendering. Thick charcoal walls in architectural poché style, door swing arcs, realistic floor materials seen from above (light oak, terrazzo, grey vinyl, pale sage vinyl), furniture and medical equipment drawn as refined top-down symbols with soft drop shadows: consultation desk and exam couch, lab benches with analyzers, rows of waiting chairs and a triage desk, an X-ray table with a lead-glass control booth, a ward with three hospital beds with pillows and folded blankets. People seen from directly above as realistic small figures (shoulders and head), colored by role: white coats for doctors, teal for nurses, muted colors for patients. Outside at the bottom: an emergency entrance and an ambulance seen from above. Calm, precise, professional, like a hospital planning document brought to life. Minimal UI: thin top status bar and six simple line icons at the bottom, no readable text. Crisp, elegant, high detail.
```

## 选定后的下一步

- 用选定风格，让 ChatGPT 生成统一的素材图（人物各角色和姿势、家具、设备、地面材质），透明背景，固定等轴角度和光照方向。
- 游戏引擎（T001 的等轴骨架）改为摆放这些素材，而不是用代码绘制人物和家具。
