# T002 知识库（格式 v1，审查草稿）

本批含 11 个病种、13 项检查、术语释义及来源清单。它们尚未接入 `/v2/` 或旧原型；全部 `reviewStatus` 为 `draft`，等待 Claude 逐条审查。未经临床专业人员审阅，不提供真实诊疗建议。数据和游戏估计的通过校验不代表医学内容已审定。

## 文件与引用

- `diseases/<id>.json`：单一病种对象，文件名必须与 id 相同。
- `exams.json`、`glossary.json`、`sources.json`：对象数组。
- `ids.json`：`departments`、`rooms`、`equipment`、`staff` 四个数组；每项 `{id, name}`。它是本批资源引用的完整清单，不是批准的建设目录，也不是执业许可标准。
- 全部 JSON 为 UTF-8、2 空格缩进、末尾换行，无注释。id 为小写英文/数字/下划线，不以数字开头；本批四类资源 id 不重名。
- `sourceIds` 至少一项，引用 `sources.json.id`。`examId` 引用 `exams.json.id`；`department`、`relatedDepartments`、检查资源与治疗 `requires` 引用对应分类。
- `differentials` 中首批已有病种必须写其 id，其余用中文病名；中文名称并不表示已建立额外病种文件。
- `reviewStatus` 只允许 `draft` / `claude_reviewed`；只有 Claude 审查后才能改后者。两种状态均不等于经过临床专业人员审阅。本任务测试另外锁定全部条目为 `draft`，后续审查时应有意更新该任务快照断言。

## 病种字段

以下字段全部必填。本批仅两个集合性病种的 `icd10` 为 `null`，理由在各自 `simplifications` 中；其他字段不得用 `null`、空字符串或漏字段占位。未来确实不适用的新情形，先说明理由并明确扩展校验，不静默放行所有 null。

| 字段 | 类型与约束 / 含义 |
|---|---|
| `id`, `name`, `icd10` | id、非空中文名、ICD-10类别字符串或有理由的 null。WHO 2019映射均待逐码核验，非本地结算码；E11/K35为类别，不是完整病案编码。 |
| `department`, `relatedDepartments` | 首诊科室 id、相关科室 id 数组。危险表现可覆盖首诊分配。 |
| `population` | `{minimumAge, scope}`，最小年龄整数与人群说明。本批18岁以上非妊娠成人简化路径。 |
| `epidemiology` | 见下节；抽样口径是待审建议，不更改 GAMEPLAY 的城市模型决定。 |
| `triage` | `{I, II, III, IV}`，各为0–1、合计1±0.001。只是虚构到诊病例占位分布，不是按病种自动分诊的规则。 |
| `presentation` | `chiefComplaints`: 2–4句；`symptoms`: 非空 `{name, probability}` 数组，概率0–1；`signs`: 非空体征字符串数组。症状可并存，概率不需合计1。 |
| `differentials` | 非空字符串数组，规则见上。不是完整的排除诊断列表。 |
| `workup` | `{examId, purpose, typicalFinding, diagnosticValue}` 数组。`purpose`描述使用条件；`diagnosticValue`为 `essential` / `supportive` / `rule_out`。空数组表示典型轻症无常规检查，不表示重症无需评估。 |
| `diagnosis` | `{criteria, difficulty, misdiagnosisRisks}`：非空依据、1–5整数难度、非空风险字符串数组。难度是游戏估计。 |
| `treatment` | 非空数组；每项 `{setting, description, requires, duration}`。setting仅 `outpatient` / `observation` / `inpatient` / `surgery` / `referral`；duration为非空说明，不是固定占用房间的计时器。 |
| `treatment[].requires` | `{departments, equipment, staff}`，均为 id 数组，设备可空，科室/人员至少一项。同数组的资源为该路径所需组合，不是自动授权。本批手术/转诊条目只表达外院接续，没有建设完整手术资源包。 |
| `referral` | 非空中文说明，包含必须转诊的危险表现/能力不足及接收机构能力。 |
| `outcomes` | 见下节。三种处理情景分别有一组四种结局概率和统一解释。 |
| `costCNY` | `[低, 高]`，非负有限数，低≤高。一次本院初评/基础处置人民币总额游戏估计，不含外院、手术、长期药物和复诊；不能与检查费用无条件叠加以免重复收费。 |
| `plain` | 2–3句玩家解释，非空且不超过120个Unicode字符。自动测试检查长度，句意和易懂程度需人工审阅。 |
| `businessNote` | 非空经营解释：患者人群、能力需求与接续，不是营销/过度医疗建议。 |
| `sourceIds`, `simplifications`, `reviewStatus` | 来源id数组、非空简化说明数组、审阅状态。每条均标明游戏估计和未覆盖范围。 |

`essential` 表示该草稿诊断路径的重要证据，不得理解为“等检查完成才能转诊”；疑似心脏急症的转运和初评并行。`rule_out` 只是检查目的，不代表阴性必然排除。单次正常心电图/快速肌钙蛋白、未显示阑尾的超声都不是安全排除规则。

### 流行病学与结局的游戏口径

`epidemiology.annualIncidencePer100k` 保留任务单字段名，但当前全部表示 **每10万人每年就诊人次**，用 `metric: annual_consultations_per_100k` 明示。慢病包括复诊，不能拿来当新发病例率或患病率。`basis` 标明均为游戏估计；将来患者引擎必须先经 Claude 确认生成新病和复诊的口径，不能直接接入这些占位数。

`ageWeights` 恰为 `0–14`、`15–44`、`45–64`、`65+` 四键（使用 en dash），非负且至少一个大于0，**不是各年龄档占比**。按城市人口乘权重后归一化；15–44档仍须应用18岁下限。`sexRatio` 为男性率相对女性率的非负系数，例如0.25表示1:4；尚未建模其他性别与生理差异。`seasonality` 是12个非负相对系数，至少一个正数；本批均为1，表示未建模季节差异，不声称真实疾病没有季节性。

`outcomes.timely`、`.delayed`、`.missed` 各含 `recovered`、`improved`、`complication`、`death`，每组非负且合计1±0.001。`basis` 均为游戏估计，`.horizonDays` 给出30或90天占位观察窗，`.scope` 说明是包括外院接续后的结局，转诊本身不是成功治疗。这不是现实因果风险；“延误多久”、共病与严重度尚未参数化，不能用于引擎推断。慢病的 recovered 为0，好转表示控制改善。为满足四格格式，互斥优先级是死亡>并发症>恢复>好转，未建模持续未愈等额外类别；该设计缺口交由 Claude 决定。本批轻症死亡0只是占位简化，绝不表示所有患者死亡风险为0。

## 检查、术语与来源

检查每条必填 `id,name,room,equipment,staff,durationMinutes,resultMinutes,costCNY,plain,sourceIds,reviewStatus,basis,simplifications`。资源数组至少一项。时间均为非负有限分钟数：duration为操作占用，result为操作结束至报告可用，不含排队/外送/转运；0表示当场读数。两个时间及所有费用、资源配置均为游戏估计。超声和CT虽有资源id，但不表示MVP医院已具备它们。培养和药敏时间没有标成“立即”。快速肌钙蛋白并未指定试剂、阈值或复测算法。

术语每条必填 `term,plain,sourceIds,reviewStatus`。术语名唯一；含病种和检查本身的解释。额外 `needsVerification: true` 与 `verificationNote` 表示释义或出处对应还未核实；本批所有独立专业词释义都明确标记，不能当成已审定助理答案。字符串中自然语言的所有专业词是否覆盖仍需人工检查，测试只保证病种/检查名称全部入表，不冒充自动语义审校。

来源每条必填 `id,title,publisher,year,scope,needsVerification,verificationNote,accessedOn`。`year`为明确的版本/出版/页面复核年，具体含义写在scope；不把检索引擎相对时间当出版年。不能确定年份时允许null并必须标记needsVerification。只有存在公开链接才填https `url`；不能凭空拼接链接。`scope`限制支持范围，检索摘要或全文受阻写在verificationNote。`needsVerification: false`只说明本轮标记的元信息/支持段落可查，不意味着现行性、医学结论或所有外推已获审校。其他 JSON 里的估计不能因为引用了指南就变成指南数值。

数值引用目前仅明确写入糖尿病诊断解释的空腹≥7.0、随机≥11.1 mmol/L及空腹释义至少8小时，来源 `diabetes_cn` 印刷页10–11；需典型症状/复查条件，不能作为完整决策算法。其余概率、就诊率、权重、费用、时间、难度均为游戏估计。ICD数字是类别标识，不是统计数值。

## 新增或修改

1. 先确认任务范围，阅读原始资料，登记来源标题/机构/年/定位和核验状态。不可自动把失效来源替换成不同资料。
2. 使用既有id或在ids中增加有中文说明的实际引用资源，添加字段齐全的JSON。涉及人群、编码和数据缺口时写明简化，未知值不伪装为0。
3. 在术语表补上玩家会看到的专业词，白话释义不超过120字。诊断、治疗、危险表现应分别核对，游戏估计逐字段明确标记。
4. 运行 `node --test tests/v2/knowledge.test.mjs` 和 `npm run verify`。现有 npm 通配符已包含该测试，无需改 package.json 或引入依赖。
5. 在任务执行记录及PR列出待核验项和自查，保持draft，由Claude审查。后续连接模拟前必须解决观察窗、复诊口径、特殊人群和危险表现的建模缺口。

校验覆盖字段/类型/范围、唯一性、交叉引用、概率和、年龄/月份、白话长度、审阅状态、文件名及JSON格式，并用反例证明会拒绝坏数据。它不会验证网页可用性、临床事实、术语完整性或游戏平衡。
