# T002 知识库格式与首批病种

状态：待审查（2026-09-28 实现完成，医学内容仍为 draft）
依据：`docs/KNOWLEDGE_BASE.md`；`GAMEPLAY.md` 3.2、5A、6、9 节；`docs/PLAYTHROUGH.md`
分支：`codex/T002-knowledge-base`（Claude 已预先建好，勿新建）

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

- 分支和 PR 已由 Claude 建好：`git fetch` 后切到 `codex/T002-knowledge-base` 开发并推送，完成后在 PR 上留言“完成，请审查”，PR 正文写逐条自查。
- 更新 `HANDOFF.md`，填写本文件的“执行记录”，把 `tasks/README.md` 里 T002 的状态改为“待审查”。

## 执行记录（ChatGPT 填写）

### 2026-09-28：实现完成，待 Claude 审查

仅在已有 `codex/T002-knowledge-base` 开发。开始时工作区干净，读取工作流、任务单、GAMEPLAY/知识库计划/质量门槛与PR评论。`git pull --ff-only` 初次被 FETCH_HEAD 的 Operation not permitted 阻断；通过自动批准提升权限后成功，Already up to date。未新建分支、合并或修改本机接力服务配置。

#### 完成内容与逐条自查

1. **已满足（自动检查）**：`npm run verify`，游戏/知识库 **94/94**，接力 **5/5**；含新增知识库 **25/25**（2组完整数据检查、23个拒绝坏数据的反例）。字段/类型、所有引用、概率和、四年龄档、12月、白话长度、状态、范围与UTF-8格式均检查。沿用现有npm测试通配符，无新增依赖或package改动。
2. **已满足（草稿范围）**：11个病种文件、13检查、105术语、16来源、四类资源id清单及格式README，病种/检查/术语全部draft；没有模拟或界面实现。两个集合性疾病的icd10为null并有理由，其余9个为暂映射，全部编码待核。
3. **已满足（来源登记及不确定标记），未验证（全部医学内容）**：公开来源记录真实题名、机构、年、链接及支持范围；标题中的版次和实际期刊发表年分别记录，如上感2018版发表于2019。打开失败、只核到摘要/索引或未逐项核对者标needsVerification；完整清单见下。没有宣称所有来源全文均核验。
4. **已满足（估计可识别）**：就诊人次率、四档年龄权重、男女比例、月份系数、分诊和症状概率、诊断难度、结局概率/观察窗、费用、检查耗时/出报告时间和资源配置全部写明游戏估计。明确引用的诊断数字只有糖尿病空腹≥7.0及随机≥11.1 mmol/L（附典型症状/改日复查等条件），术语空腹至少8小时，定位diabetes_cn印刷页10–11。未引用真实流行病学或死亡率；ICD数码为分类标识。
5. **已满足（待审问题登记）**：以下列出我没有把握的内容与设计缺口；不自行改GAMEPLAY。Claude仍须逐条审核医学和运营内容。

#### 实际命令与浏览器证据

- `node --test tests/v2/knowledge.test.mjs`：25/25通过。
- `npm run verify`：最终94+5全部通过；语法检查通过。`git diff --check`通过。
- `npm start`：4173已被占用（EADDRINUSE），没有终止或修改原服务；改用临时 `PORT=4175 npm start`。
- 正常入口验收复用 `tests/v2/browser.cjs`，仅把脚本副本的 `path.resolve('art/screens/T001')` 换成 `path.resolve('art/screens/T002')`，存为 `/private/tmp/t002-browser.cjs`；运行 `PREVIEW_URL=http://localhost:4175 PLAYWRIGHT_MODULE=/Users/wongxg84/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node /private/tmp/t002-browser.cjs`。首次Chrome启动被沙箱EPERM/SIGABRT阻断，经自动批准重试成功。
- 正常 `/v2/`：390×844 DPR3下触控点选/取消、拖动/双指缩放、桌面操作、响应式、静止帧与导航通过，无v2控制台错误。截图 `art/screens/T002/v2-default.png`、`v2-selected.png`、`v2-zoom.png` 已打开目视核对。
- 玩家可理解性：房间/底栏可读、点选信息卡明确“诊疗详情将在后续任务接入”、顶栏标“示意”。审读本批plain与经营解释，避免把阴性结果说成排除、把转诊说成治愈；所有白话长度校验通过。术语语义穷尽性仍需Claude人工审阅。
- 旧 `/` 仅验证正常加载，既有favicon.ico 404仍在；未重跑旧版选址→开业→逐人接诊/离院→刷新完整链路，未定位玩家旧存档的接诊阻塞，也不宣称已修复。v2目前没有患者流/存档；本批未接入游戏，故没有知识库界面的真实游戏验收、真机或临床审阅证据。独立浏览器上下文未访问/改动玩家存档。

#### needsVerification 完整清单

来源条目（6项，标记意味着支持内容还需进一步核验，不代表标题编造）：

- `htn_cn`：国家基层高血压防治管理指南（2017）。官方通知和指南名称已确认；附件正文未成功取得。诊断细节与现行版本需 Claude 核验，不引用该附件数值。
- `htn_education`：国家卫生健康委疾控局关于开展2019年“全国高血压日”宣传活动的通知。检索确认官方标题、日期及宣传要点；本轮未逐段打开正文，需复核。
- `urticaria_cn`：中国荨麻疹诊疗指南（2022版）。题名、作者、2022年55卷12期1041–1049及DOI已核；正文打开失败，不能声称全文核验。
- `acs_nice`：Acute coronary syndromes。官方概览和检索正文确认；完整推荐页打开失败，处置细节需进一步审查。
- `chest_nice`：Recent-onset chest pain of suspected cardiac origin: assessment and diagnosis。已通过NICE官方检索确认题名、2010年发布及2016年修订标记；完整推荐页打开失败，检测及转诊细节需进一步核验。
- `icd_who`：ICD-10 Version:2019。已打开2019版浏览器；动态分类节点未逐码验证。所有映射待核，不能作为账单编码。

术语条目（81项，位于 `data/glossary.json`；定义与原文逐条对应尚待核验，均有说明）：

白细胞、贫血、病原、抗菌药、抗组胺药、风团、严重过敏反应、瘀斑、压痛、腹膜刺激征、脱水、电解质、缺氧、循环不稳、静脉血浆葡萄糖、空腹、随机血糖、应激性高血糖、代谢危象、并发症、分型、继发性高血压、白大衣性高血压、耐药、药敏、尿痛、尿频尿急、肾盂肾炎、尿道炎、梗阻、复位、移位、血运、关节受累、神经功能异常、肌腱断裂、心肌、心梗、冠脉介入、不稳定心绞痛、阴性、高敏检测、鉴别诊断、体征、造影剂、随访、转诊、复评、肺栓塞、主动脉夹层、心力衰竭、异位妊娠、舟骨骨折、胃食管反流、接触性皮炎、消化道出血、肠梗阻、尿路结石、输尿管结石、流行性感冒、过敏性鼻炎、1型糖尿病、尿蛋白、禁忌、晕厥、骨折、骨折线、稳定性、心律、尿糖、肝肾功能、抗栓、溶栓、氧疗、桡骨、膀胱炎、胸痛急救、气促、特异体征、分诊、初评。


病种与检查的同名术语沿用其sourceIds，相关来源的needsVerification仍须传递理解，不能因为术语没有单独标记就当作已审定。病种/检查本身全部draft；字段中的未核细节还见simplifications。

#### 希望 Claude 重点审查 / 问题与建议

- **数据是否可供T003使用**：所有概率均为未平衡占位数，不能当医学统计；timely/delayed/missed未定义延误时长、严重度与共病，30/90天观察窗只是建议。四种结局缺少“持续未愈”，不能强行当成临床互斥全集；是否增加此状态由Claude决定。
- **需求口径**：任务允许年发病率或门诊率，本批显式选就诊人次率，但GAMEPLAY描述城市新发疾病；慢病复诊如何与新发分开仍待决定，T003不可把就诊人次当新发病例数。
- **人群**：本批缩为非妊娠成人，0–14权重0，15–44档需过滤18岁以下；儿科/妊娠路径尚未编写，能否作为MVP范围请Claude决定。
- **医学高风险**：急性冠脉综合征国内转诊路径、快速肌钙蛋白与高敏方法区别；荨麻疹与严重过敏的急救分界；高血压现行指南全文；骨折神经血管危险表现。相关已标核验限制，未写具体剂量/阈值算法。
- **来源适用性**：NICE下尿路感染、NIDDK病毒性胃肠炎、NHS扭伤需评估国内适用性；病毒性胃肠炎不能代表所有急性胃肠炎；NHS扭伤不完整覆盖挫伤。阑尾炎旧县级路径已补WSES影像资料，仍需国内新路径审查；骨折用科普资料不等于完整指南。
- **编码**：ACS和多部位软组织损伤没有单一合适码，留null；J18.9、A09、N30.0、L50.9等仅暂映射，WHO逐节点和国内病案版本未核，不用于收费。
- **术语**：已覆盖病种、检查及主要专业表达，81个独立释义保守标待核验。测试无法证明自然语言专业词已穷尽；请重点审核鉴别疾病释义及出处是否充分，必要时增补专门来源。
- **运营**：检查/治疗id仅能力抽象，不代表满足现实执业和建设标准；手术只描述外院接续，本批没有完整手术资源包。费用只算本院初评，不得再与检查费用无条件相加。具体检查顺序、条件、复测和转诊资源消耗留后续任务，经审查后决定。

实现提交 `479b33fad51a7b382dddbd20d6341505a8d736a2` 已推送：`git push origin codex/T002-knowledge-base` 成功；`git rev-parse HEAD`、`git rev-parse origin/codex/T002-knowledge-base` 与 `git ls-remote origin refs/heads/codex/T002-knowledge-base` 当时三者一致，工作区干净。首次commit因专用副本没有作者身份失败，使用仅本次命令生效的 `git -c user.name=Codex -c user.email=codex@openai.com commit ...` 重试成功；没有写入全局或本地Git配置。

**未完成：PR正文写入与标记可审查。** `gh pr edit 3 --repo mud4u404/game003 --body-file /private/tmp/t002-pr-body.md` 返回GraphQL `Resource not accessible by personal access token (updatePullRequest)`；REST `gh api repos/mud4u404/game003/pulls/3 --method PATCH --input /private/tmp/t002-pr-request.json` 也返回HTTP 403。`gh pr ready 3 --repo mud4u404/game003` 返回同类 `markPullRequestReadyForReview` 权限错误。这是GitHub当前授权限制，不是自动批准审查拒绝；未更改凭据/服务/仓库外配置。完整正文已保存为 `tasks/T002-self-check.md`，请Claude或具备权限的接力流程同步。PR仍为草稿，任务单状态为“待审查”。

上述交付状态另作仅文档的跟进提交并推送，最终提交号与远程核对结果见本轮交付回复。最终评论由接力脚本发布，本轮不重复留言，没有合并PR。“待审查”不表示未核医学事项已完成审查。


## 审查记录（Claude 填写）

（未开始）
