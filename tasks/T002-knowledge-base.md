# T002 知识库格式与首批病种

状态：待开发（等 T001 合并后发布）
依据：`docs/KNOWLEDGE_BASE.md`；`GAMEPLAY.md` 3.2、5A、6、9 节；`docs/PLAYTHROUGH.md`
分支：`codex/T002-knowledge-base`

## 目标

建立游戏知识库的数据格式，并写入 MVP 需要的首批病种、检查项目和术语。之后的患者模拟、病历卡和院长助理都读这里的数据。

用户明确说过专业知识很重要，所以本任务**质量优先于数量**：每一条都要有来源、有白话解释，宁可少写，不可编造。

## 背景

- 玩家（院长）不是医生。游戏里的疾病、检查、治疗、结局要真实可信，助理的解释要准确易懂。
- 医学规则和数值不能由 AI 凭空编造。本任务的内容由 ChatGPT 起草，Claude 逐条审查，通过后状态改为 `claude_reviewed`。尚无临床专业人员审阅，任何地方都不得写“临床准确”。
- 本任务只写数据和校验，不写模拟逻辑。

## 范围

### 要做

1. **数据目录** `data/`，全部用 JSON，UTF-8，缩进 2 空格：
   - `data/diseases/<id>.json`：每个病种一个文件
   - `data/exams.json`：检查项目
   - `data/glossary.json`：术语表（病历里会出现、需要助理解释的词）
   - `data/sources.json`：参考资料清单，其他文件通过 `sourceIds` 引用
   - `data/README.md`：格式说明（字段含义、取值范围、如何新增条目）
2. **病种字段**（每个字段都必填，不适用时写 `null` 并在 `simplifications` 里说明）：

   | 字段 | 说明 |
   |---|---|
   | `id`、`name`、`icd10` | 英文小写下划线 id；中文名；ICD-10 编码 |
   | `department`、`relatedDepartments` | 首诊科室；可能涉及的科室。科室 id 见下方清单 |
   | `epidemiology` | `annualIncidencePer100k`（年发病率或门诊就诊率，每 10 万人）、`ageWeights`（0–14、15–44、45–64、65+ 四档的相对权重）、`sexRatio`（男:女）、`seasonality`（12 个月的相对系数，无季节性全填 1）、`basis`（数字是引用数据还是估计） |
   | `triage` | 就诊时 I–IV 级的比例，四项之和为 1 |
   | `presentation` | `chiefComplaints`（患者会怎么说，2–4 条口语化表述）、`symptoms`（`[{name, probability}]`）、`signs`（医生能查到的体征） |
   | `differentials` | 需要鉴别的疾病（写 id；首批里没有的写中文名） |
   | `workup` | `[{examId, purpose, typicalFinding, diagnosticValue}]`，`diagnosticValue` 取 `essential` / `supportive` / `rule_out` |
   | `diagnosis` | `criteria`（确诊依据，白话）、`difficulty`（1–5，1 最容易）、`misdiagnosisRisks`（常见误诊方向和原因） |
   | `treatment` | `[{setting, description, requires, duration}]`；`setting` 取 `outpatient` / `observation` / `inpatient` / `surgery` / `referral`；`requires` 写需要的科室、设备、人员（id） |
   | `referral` | 小医院什么情况必须转诊，转去哪类机构 |
   | `outcomes` | 按 `timely`（及时正确处理）、`delayed`（延误）、`missed`（漏诊或误诊）三种情况，给出 `recovered` / `improved` / `complication` / `death` 的比例（各自之和为 1），标明是引用数据还是游戏估计 |
   | `costCNY` | 一次典型就诊的费用区间 `[低, 高]`，标明依据或估计 |
   | `plain` | 给玩家看的白话解释，2–3 句，不用术语，或术语后面立刻解释 |
   | `businessNote` | 对医院经营意味着什么：常见于什么人群、需要什么能力、是否常需转诊 |
   | `sourceIds` | 引用 `sources.json` 里的条目，至少 1 条 |
   | `simplifications` | 游戏做了哪些简化、没覆盖什么 |
   | `reviewStatus` | 本任务一律写 `draft` |

3. **首批 11 个病种**（MVP 的 10 个，加上急性冠脉综合征，因为小医院需要“识别并转诊”）：
   上呼吸道感染、社区获得性肺炎、急性胃肠炎、原发性高血压、2 型糖尿病、下尿路感染、急性阑尾炎、软组织损伤（扭挫伤）、桡骨远端骨折、急性荨麻疹、急性冠脉综合征。
4. **检查项目**：覆盖以上病种需要的检查，至少包括血常规、尿常规、血糖、糖化血红蛋白、心电图、肌钙蛋白（快速检测）、胸部 X 光、四肢 X 光、腹部超声、腹部 CT。每项写：`id`、`name`、`room`、`equipment`、`staff`、`durationMinutes`、`resultMinutes`（出结果要多久）、`costCNY`、`plain`（白话：这项检查是做什么的）、`sourceIds`、`reviewStatus`。MVP 里没有超声和 CT 房间也要写上，用于表示“本院做不了、需要转诊”。
5. **科室、房间、设备、人员的 id 清单**：写在 `data/README.md`（或单独 `data/ids.json`），只列本批数据引用到的，供之后的模拟和建设任务使用。
6. **术语表**：病历、检查结果和治疗里出现的专业词都要收录，每条有 `term`、`plain`、`sourceIds`。
7. **来源要求**：
   - 优先使用中国的权威资料：国家卫健委发布的诊疗规范和临床路径、中华医学会各分会的指南和专家共识、人民卫生出版社的规划教材（如《内科学》《外科学》）、国家统计局或卫健委的统计年鉴。
   - `sources.json` 每条写 `title`、`publisher`、`year`，有公开链接才写 `url`。**不得编造标题、年份或链接**。确定不了的写 `"needsVerification": true`。
   - 数值如果是游戏估计而不是引用，必须在对应字段的 `basis` 或 `simplifications` 里写明“游戏估计”。
8. **校验测试** `tests/v2/knowledge.test.mjs`，加入 `npm run verify`：
   - 每个病种、检查、术语的必填字段齐全，类型正确
   - 所有 `examId`、`sourceIds`、科室/房间/设备/人员 id 都能在清单里找到
   - `triage`、每组 `outcomes` 的比例之和为 1（允许 ±0.001 误差）
   - `ageWeights` 四档齐全，`seasonality` 恰好 12 个数
   - `plain` 非空且不超过 120 字
   - `reviewStatus` 取值合法

### 不做

- 不写患者生成、就诊模拟、病历卡界面、助理界面，不改 `v2/` 的场景代码。
- 不写首批以外的病种。
- 不写任何“临床准确”“经医生审核”之类的说法。

## 验收标准

1. `npm run verify` 通过，贴出命令和结果。
2. 11 个病种文件齐全，每个字段都有内容，`reviewStatus` 为 `draft`。
3. 每条来源真实可查；无法确认的标了 `needsVerification`。在执行记录里列出所有标了 `needsVerification` 的条目。
4. 在执行记录里说明：哪些数值有引用依据，哪些是游戏估计。
5. 在执行记录里列出你自己没有把握、希望 Claude 重点审查的内容。

## 交付

- 从最新 `main` 建分支 `codex/T002-knowledge-base`，开 PR 到 `main`，标题 `T002 知识库格式与首批病种`。
- 更新 `HANDOFF.md`，填写本文件的“执行记录”，把 `tasks/README.md` 里 T002 的状态改为“待审查”。

## 执行记录（ChatGPT 填写）

（未开始）

## 审查记录（Claude 填写）

（未开始）
