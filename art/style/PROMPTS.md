# T004 生成记录

工具：Codex 内置 imagegen，透明背景。共 17 件素材，首轮每件独立生成 1 次（9 件家具、8 个人物姿态/朝向）。参考图均为 `user-reference.png`。

公共约束：clean simplified vector-like painted illustration; white, pale mint, medium teal; nearly no outlines; soft upper-left lighting; orthographic 2:1 isometric projection; full object centered; transparent background; no floor, cast shadow, glow, text, watermark or scenery; normal adult proportions.

第一张诊桌：teal clinic consultation desk, empty tabletop, no monitor, no chair, no person; footprint 1.4 by 0.65 tiles; modest drawer pedestal and open knee space.

医生站姿正面：adult male doctor in white coat, navy trousers, black shoes, stethoscope, short dark hair; normal slender proportions about 7 heads tall; front three-quarter down-left; relaxed arms.

其余素材主题：
- monitor: a small desktop LCD computer monitor on a slim stand, pale mint frame, dark teal screen, viewed from its BACK three-quarter side; entire isolated monitor including base, no table
- doctor-chair: an empty mint teal adjustable doctor's swivel chair with low backrest, teal upholstered seat, white metal five-star base, facing down-left, no person
- patient-chair: one empty clinic visitor chair with white seat and backrest, slender teal tubular metal armrests and four legs, facing up-right, no person
- exam-bed: one clinic examination couch with mint teal padded mattress, small off-white pillow, teal base and four legs, long axis down-left, no person
- cabinet: one low teal medical side cabinet, pale mint top, two doors and a drawer, clean empty top, long axis down-right
- sink: one teal freestanding clinic washstand cabinet with white ceramic sink bowl and silver faucet, simple, long axis down-right
- plant: one small indoor leafy plant with several broad understated green leaves, white cylindrical floor pot
- lightbox: one rectangular wall-mounted medical x-ray viewing lightbox, pale mint frame, softly off-white panel, faint two chest x-ray panels inside, viewed along a vertical wall whose horizontal edge slopes down-right, no wall around it
- doctor-stand-back: one standing adult male doctor, rear three-quarter view facing up-right, short dark hair, white knee-length coat, navy trousers, black shoes, arms relaxed, NO chair
- doctor-seat-front: one seated adult male doctor, front three-quarter view facing down-left, white coat, dark trousers, normal adult 7-head proportions, knees bent 90 degrees with both feet planted, hands lightly on lap, isolated PERSON ONLY, invisible chair support, NO chair or desk drawn
- doctor-seat-back: one seated adult male doctor, rear three-quarter view facing up-right, white coat, dark trousers, normal adult 7-head proportions, knees bent 90 degrees, hands on lap, isolated PERSON ONLY, NO chair or desk drawn
- patient-stand-front: one standing adult female patient, front three-quarter view facing down-left, shoulder-length brown hair, muted sage green blouse, brown trousers, dark flat shoes, normal slender adult 7-head proportions, relaxed arms
- patient-stand-back: one standing adult female patient, rear three-quarter view facing up-right, shoulder-length brown hair, muted sage green blouse, brown trousers, dark flat shoes, normal slender adult 7-head proportions
- patient-seat-front: one seated adult female patient, front three-quarter view facing down-left, shoulder-length brown hair, muted sage green blouse, brown trousers, dark flat shoes, normal slender adult proportions, knees bent 90 degrees, feet planted, hands on lap, isolated PERSON ONLY, NO chair drawn
- patient-seat-back: one seated adult female patient, rear three-quarter view facing up-right, shoulder-length brown hair, muted sage green blouse, brown trousers, dark flat shoes, normal slender adult proportions, knees bent 90 degrees, feet planted, hands on lap, isolated PERSON ONLY, NO chair drawn

所有输出保留 alpha，按 alpha≥32 的边界裁去空白、等比缩至最长边512像素；不加描边、不修改色相。运行显示尺寸与脚底/底面锚点登记在 manifest.json。缩小后的风格、方向及坐姿仍须在游戏里验收。


动态接入追加4张男性患者，参考已有 `patient-stand-front.png`，每张一次 imagegen，透明输出：

公共提示：One isolated male patient game sprite. Match supplied reference character clean simplified isometric illustration style and scale. Adult man, short brown hair, sage green shirt, brown straight-leg trousers, dark flat shoes. Normal slender 7-head proportions, same outfit every view. Small understated facial features. Orthographic 2:1 slightly above, soft upper-left lighting, nearly no outlines, full body and feet, transparent, no shadow/glow/text/scenery/people/furniture.

四种姿态：stand-front（front three-quarter facing down-left）、stand-back（rear three-quarter facing up-right）、seat-front和seat-back（对应朝向，knees bent 90 degrees, both feet planted, hands on lap, invisible chair support）。裁边/缩放/alpha约定与上述一致；运行时下肢分片缓存产生轻量步态，没有把AI生成结果称为逐帧行走素材。
