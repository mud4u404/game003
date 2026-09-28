// 就诊模拟引擎（T003）。纯逻辑，不依赖浏览器。
// 时间以“分钟”为最小单位，与现实时间 1:1；advanceTo 逐分钟推进，所以一次推进与分段推进结果完全一致。
// 全部状态保存在 this.s（可直接 JSON 序列化），随机数状态也在其中，存档恢复后结果不变。
import { createRng } from './rng.js';
import { personName } from './names.js';

export const STAGE_LABELS = {
  triage_wait: '等待分诊', triage: '分诊中', wait_doctor: '候诊', consult: '问诊中',
  exam_wait: '等待检查', exam: '检查中', result_wait: '等待检查结果', review_wait: '等待医生看结果',
  review: '医生看结果', treat_wait: '等待处置', treatment: '处置 / 取药', done: '已离院',
};
export const ROLE_LABELS = { physician: '医生', nurse: '护士', lab_technician: '检验技师', radiographer: '放射技师' };
export const OUTCOME_LABELS = { recovered: '治愈', improved: '好转 / 病情控制', complication: '出现并发症', death: '死亡' };
export const RULES = {
  examStrategy: { lean: '精简', standard: '规范', full: '全面' },
  scope: { refer: '能力外直接转诊', try: '尽量处理' },
};
const AGE_RANGES = { '15–44': [18, 44], '45–64': [45, 64], '65+': [65, 88] };
const DELAY_LIMIT = { 1: 30, 2: 90, 3: 240, 4: 480 };   // 分钟：超过即算“延误”（游戏规则）
const PATIENCE = { 1: Infinity, 2: Infinity, 3: 210, 4: 150 }; // 候诊超过即自行离开（游戏规则）
const LONG_RESULT = 120;         // 出结果超过 2 小时的检查不等待，结果另行回报
const FOLLOW_UP_DAYS = 3;        // 游戏简化：结局在离院 3 天后随访揭晓
const RETURN_CHANCE = 0.6;       // 误诊且未死亡时返诊的概率（游戏估计）

export function loadKnowledge({ diseases, exams }) {
  return { diseases, exams, disease: Object.fromEntries(diseases.map(d => [d.id, d])), exam: Object.fromEntries(exams.map(e => [e.id, e])) };
}

export class Engine {
  constructor(kb, config, { seed = 1, startMs = Date.now(), state = null } = {}) {
    this.kb = kb.disease ? kb : loadKnowledge(kb);
    this.config = config;
    this.rng = createRng(seed);
    if (state) { this.s = state; this.rng.state = state.rng; }
    else {
      this.s = {
        v: 1, minute: Math.floor(startMs / 60000), startMinute: Math.floor(startMs / 60000), rng: this.rng.state, seq: 0,
        rules: { ...config.rules },
        staff: config.staff.map(st => ({ ...st, fatigue: 0, task: null })),
        patients: {}, records: [], scheduled: [],
        queues: { triage: [], doctor: {}, review: {}, exam: {}, treat: [] },
        day: this.localDay(Math.floor(startMs / 60000)),
      };
    }
    this.index();
  }

  // ---------- 时间 ----------
  local(minute = this.s.minute) {
    const m = minute + this.config.timezoneOffsetMinutes, day = Math.floor(m / 1440), inDay = m - day * 1440;
    return { day, hour: Math.floor(inDay / 60), minute: inDay % 60, date: new Date(day * 86400000).toISOString().slice(0, 10), month: new Date(day * 86400000).getUTCMonth() };
  }
  localDay(minute) { return this.local(minute).day; }
  isOpen(minute = this.s.minute) { const { hour } = this.local(minute); return hour >= this.config.openHour && hour < this.config.closeHour; }
  nextOpening(minute = this.s.minute) {
    const t = this.local(minute), dayStart = minute - (t.hour * 60 + t.minute);
    const open = dayStart + this.config.openHour * 60;
    return t.hour < this.config.openHour ? open : open + 1440;
  }
  advanceTo(ms) {
    const target = Math.floor(ms / 60000);
    while (this.s.minute < target) this.tick();
    this.s.rng = this.rng.state;
  }
  serialize() { this.s.rng = this.rng.state; return JSON.stringify(this.s); }
  static restore(kb, config, json) { return new Engine(kb, config, { state: typeof json === 'string' ? JSON.parse(json) : json }); }

  // ---------- 能力 ----------
  index() {
    const c = this.config, served = new Set();
    for (const r of c.rooms) { served.add(r.type); (r.alsoServes || []).forEach(t => served.add(t)); }
    this.roomTypes = served;
    this.equipment = new Set(c.equipment);
    this.departments = new Set(c.departments);
    this.roles = new Set(c.staff.map(s => s.role));
    this.roomOfType = type => c.rooms.find(r => r.type === type || (r.alsoServes || []).includes(type));
    this.recordById = new Map(this.s.records.map(r => [r.id, r]));
  }
  examAvailable(exam) {
    return this.roomTypes.has(exam.room) && exam.equipment.every(e => this.equipment.has(e)) && exam.staff.some(r => this.roles.has(r) || (r === 'radiologist' && this.roles.has('radiographer')));
  }
  missingFor(requires) {
    const miss = [];
    for (const d of requires.departments || []) if (!this.departments.has(d)) miss.push(DEPT[d] || d);
    for (const e of requires.equipment || []) if (!this.equipment.has(e)) miss.push(EQUIP[e] || e);
    if ((requires.staff || []).length && !(requires.staff || []).some(r => this.roles.has(r))) miss.push(STAFF[requires.staff[0]] || requires.staff[0]);
    return miss;
  }
  treatmentPlan(disease, level) {
    const opts = disease.treatment, ref = opts.find(t => t.setting === 'referral');
    if (level <= 2 && ref) return { setting: 'referral', text: ref.description, reason: '病情较重，需要上级医院救治' };
    for (const t of opts) {
      if (t.setting === 'referral') continue;
      const miss = this.missingFor(t.requires);
      if (t.setting === 'outpatient' && !miss.length) return { setting: 'outpatient', text: t.description };
      if (t.setting !== 'outpatient') return { setting: 'referral', text: (ref || t).description, reason: t.setting === 'surgery' ? '本院没有手术能力' : '本院无法住院治疗' };
    }
    const first = opts.find(t => t.setting !== 'referral');
    const miss = first ? this.missingFor(first.requires) : [];
    return { setting: 'referral', text: (ref || opts[0]).description, reason: miss.length ? `本院缺少${miss.join('、')}` : '超出本院诊疗能力' };
  }

  // ---------- 主循环 ----------
  tick() {
    const m = this.s.minute, day = this.localDay(m);
    if (day !== this.s.day) { this.s.day = day; for (const st of this.s.staff) st.fatigue = 0; }
    for (const st of this.s.staff) if (st.task && st.task.end <= m) this.complete(st);
    for (const p of Object.values(this.s.patients)) if (p.stage === 'result_wait' && p.results.every(r => r.at <= m)) this.toReview(p);
    this.s.scheduled = this.s.scheduled.filter(x => { if (x.at <= m) { this.arrive(x); return false; } return true; });
    if (this.isOpen(m)) {
      const n = this.rng.poisson(this.lambdaPerMinute(m));
      for (let i = 0; i < n; i++) this.arrive(null);
    }
    this.enforceLimits(m);
    for (const st of this.s.staff) if (!st.task) this.assign(st);
    for (const st of this.s.staff) st.fatigue = st.task ? Math.min(100, st.fatigue + 0.18) : Math.max(0, st.fatigue - 0.3);
    this.s.minute = m + 1;
  }
  lambdaPerMinute(minute) {
    const d = this.config.district, month = this.local(minute).month;
    const openMinutes = (this.config.closeHour - this.config.openHour) * 60;
    let total = 0;
    for (const dis of this.kb.diseases) total += this.diseaseWeight(dis, month);
    return total * d.population / 1e5 * d.marketShare / 365 / openMinutes * this.hourFactor(minute);
  }
  // 门诊时段分布：各营业小时的相对系数，归一后平均为 1（总量不变）。
  hourFactor(minute) {
    const w = this.config.arrivalProfile?.weights; if (!w) return 1;
    const hours = []; for (let h = this.config.openHour; h < this.config.closeHour; h++) hours.push(w[h] ?? 1);
    const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
    return (w[this.local(minute).hour] ?? 1) / mean;
  }
  diseaseWeight(dis, month) { return dis.epidemiology.annualIncidencePer100k * (dis.epidemiology.seasonality[month] ?? 1); }

  // ---------- 到院 ----------
  arrive(returnOf) {
    const rng = this.rng, m = this.s.minute, id = `P${++this.s.seq}`;
    let rec;
    if (returnOf) {
      const prev = this.recordById.get(returnOf.recordId);
      rec = this.newRecord(id, { name: prev.name, sex: prev.sex, age: prev.age, truth: prev.truth, level: Math.max(2, prev.triageLevel - 1),
        complaint: `上次看过，${this.kb.disease[prev.truth].presentation.chiefComplaints[0]}，一直没好`, symptoms: prev.symptoms, source: '返诊', returnOf: prev.id });
      prev.returnedAs = id;
    } else {
      const month = this.local(m).month, list = this.kb.diseases;
      const dis = rng.weighted(list, list.map(x => this.diseaseWeight(x, month)));
      const shares = this.config.district.ageShares, bands = Object.keys(AGE_RANGES);
      const band = rng.weighted(bands, bands.map(b => (shares[b] || 0) * (dis.epidemiology.ageWeights[b] || 0))) || '45–64';
      const [lo, hi] = AGE_RANGES[band], age = rng.int(lo, hi);
      const ratio = dis.epidemiology.sexRatio, sex = rng.next() < ratio / (1 + ratio) ? 'male' : 'female';
      const level = Number(rng.weighted(['1', '2', '3', '4'], ['I', 'II', 'III', 'IV'].map(k => dis.triage[k] || 0)) || 4);
      const symptoms = dis.presentation.symptoms.filter(s => rng.next() < s.probability).map(s => s.name);
      rec = this.newRecord(id, { name: personName(rng, sex), sex, age, truth: dis.id, level, complaint: rng.pick(dis.presentation.chiefComplaints),
        symptoms: symptoms.length ? symptoms : [dis.presentation.symptoms[0].name], source: '门诊' });
    }
    this.s.patients[id] = { id, recordId: id, stage: 'triage_wait', room: 'hall', level: rec.triageLevel, queuedAt: m, doctorId: null, plan: [], results: [], busyWith: null };
    this.s.queues.triage.push(id);
  }
  newRecord(id, o) {
    const rec = { id, name: o.name, sex: o.sex, age: o.age, source: o.source, arrivedAt: this.s.minute, triageLevel: o.level, complaint: o.complaint, symptoms: o.symptoms,
      truth: o.truth, doctorId: null, doctorName: null, suspicion: null, exams: [], diagnosis: null, correct: null, treatment: null, disposition: null, referralReason: null,
      outcome: null, cost: 0, waits: { triage: null, doctor: null }, consultAt: null, finishedAt: null, flags: [], timeline: [], returnOf: o.returnOf || null, returnedAs: null };
    this.s.records.push(rec); this.recordById.set(id, rec);
    this.log(rec, o.source === '返诊' ? '返诊到院，挂号' : '到院，挂号');
    rec.cost += this.config.fees.registration;
    return rec;
  }
  log(rec, text) { rec.timeline.push({ t: this.s.minute, text }); }

  // ---------- 派工 ----------
  pickFrom(queue) {
    if (!queue || !queue.length) return null;
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = this.s.patients[queue[i]], b = this.s.patients[queue[best]];
      if (a.level < b.level || (a.level === b.level && a.queuedAt < b.queuedAt)) best = i;
    }
    return queue.splice(best, 1)[0];
  }
  duration(st, base) { return Math.max(2, Math.round(base / (st.speed || 1) * (1 + st.fatigue / 200))); }
  start(st, kind, pid, base) {
    const p = this.s.patients[pid];
    st.task = { kind, patientId: pid, end: this.s.minute + this.duration(st, base) };
    p.busyWith = st.id; p.room = st.room;
    return p;
  }
  assign(st) {
    const q = this.s.queues;
    if (st.role === 'nurse' && (st.duty === 'triage' || !this.s.staff.some(x => x.duty === 'triage'))) {
      const pid = this.pickFrom(q.triage);
      if (pid) { const p = this.start(st, 'triage', pid, 4); p.stage = 'triage'; const rec = this.rec(p); rec.waits.triage = this.s.minute - p.queuedAt; this.log(rec, `护士${st.name}分诊`); return; }
    }
    if (st.role === 'physician') {
      let pid = this.pickFrom(q.review[st.id]), kind = 'review';
      if (!pid) { pid = this.pickFrom(q.doctor[st.id]); kind = 'consult'; }
      if (pid) {
        const p = this.start(st, kind, pid, kind === 'consult' ? 10 : 5), rec = this.rec(p);
        p.stage = kind;
        if (kind === 'consult') { rec.waits.doctor = this.s.minute - p.queuedAt; rec.consultAt = this.s.minute; this.log(rec, `${st.name}医生接诊`); }
        else this.log(rec, `${st.name}医生查看检查结果`);
        return;
      }
    }
    for (const [roomId, queue] of Object.entries(q.exam)) {
      if (!queue.length || !this.canRunExamIn(st, roomId)) continue;
      const pid = this.pickFrom(queue), p = this.s.patients[pid], exam = this.kb.exam[p.plan[0]];
      this.start(st, 'exam', pid, exam.durationMinutes); p.stage = 'exam';
      const e = this.rec(p).exams.find(x => x.id === exam.id && !x.startedAt); if (e) e.startedAt = this.s.minute;
      this.log(this.rec(p), `${st.name}做${exam.name}`);
      return;
    }
    if (st.role === 'nurse' && st.duty === 'treatment') {
      const pid = this.pickFrom(q.treat);
      if (pid) { const p = this.start(st, 'treat', pid, this.rec(p0(this, pid)).treatment.setting === 'outpatient' && this.needsSplint(pid) ? 15 : 8); p.stage = 'treatment'; this.log(this.rec(p), `护士${st.name}处置、发药和宣教`); }
    }
  }
  needsSplint(pid) { const r = this.rec(this.s.patients[pid]); return (this.kb.disease[r.diagnosis.id].treatment.find(t => t.setting === 'outpatient')?.requires.equipment || []).includes('splint_kit'); }
  canRunExamIn(st, roomId) {
    const room = this.config.rooms.find(r => r.id === roomId);
    if (!room) return false;
    if (room.type === 'laboratory') return st.role === 'lab_technician';
    if (room.type === 'xray_room') return st.role === 'radiographer';
    return st.role === 'nurse' && st.duty === 'treatment' && st.room === roomId;
  }
  rec(p) { return this.recordById.get(p.recordId); }

  // ---------- 完成一项工作 ----------
  complete(st) {
    const { kind, patientId } = st.task; st.task = null;
    const p = this.s.patients[patientId]; if (!p) return;
    p.busyWith = null;
    if (kind === 'triage') return this.afterTriage(p);
    if (kind === 'consult') return this.afterConsult(p, st);
    if (kind === 'exam') return this.afterExam(p);
    if (kind === 'review') return this.decide(p, st);
    if (kind === 'treat') return this.finish(p, 'treated');
  }
  afterTriage(p) {
    const rec = this.rec(p), dis = this.kb.disease[rec.truth];
    const docs = this.s.staff.filter(s => s.role === 'physician');
    const match = docs.filter(d => d.department === dis.department);
    const pool = match.length ? match : docs;
    const doc = pool.reduce((a, b) => (this.queueLen(a) <= this.queueLen(b) ? a : b));
    p.doctorId = doc.id; rec.doctorId = doc.id; rec.doctorName = doc.name;
    this.log(rec, `分诊 ${['', 'I', 'II', 'III', 'IV'][rec.triageLevel]} 级，分到${doc.name}医生${match.length ? '' : '（本院无对应专科）'}`);
    p.stage = 'wait_doctor'; p.room = 'hall'; p.queuedAt = this.s.minute;
    (this.s.queues.doctor[doc.id] ||= []).push(p.id);
  }
  queueLen(doc) { return (this.s.queues.doctor[doc.id] || []).length + (doc.task ? 1 : 0); }
  afterConsult(p, doc) {
    const rec = this.rec(p), rng = this.rng, truth = this.kb.disease[rec.truth];
    rec.cost += this.config.fees.consultation;
    // 初步判断：能力越高、病越好认、越不累，越容易想对。
    const returnBonus = rec.source === '返诊' ? 0.25 : 0;
    const pc = clamp(0.66 + 0.3 * doc.skill - 0.06 * (truth.diagnosis.difficulty - 2) - doc.fatigue / 600 + returnBonus, 0.2, 0.97);
    const suspect = rng.next() < pc ? truth : this.wrongGuess(truth);
    rec.suspicion = { id: suspect.id, name: suspect.name };
    this.log(rec, `初步考虑：${suspect.name}`);
    // 按检查策略开单
    const strategy = this.s.rules.examStrategy;
    const wanted = suspect.workup.filter(w => w.diagnosticValue === 'essential' || (strategy !== 'lean' && w.diagnosticValue === 'supportive') || strategy === 'full').map(w => w.examId);
    if (strategy === 'full') for (const dId of suspect.differentials) { const dd = this.kb.disease[dId]; if (dd) dd.workup.filter(w => w.diagnosticValue === 'essential').forEach(w => wanted.push(w.examId)); }
    const exams = [...new Set(wanted)].map(id => this.kb.exam[id]).filter(Boolean);
    const unavailable = exams.filter(e => !this.examAvailable(e));
    const plan = this.treatmentPlan(suspect, rec.triageLevel);
    const essentialMissing = suspect.workup.some(w => w.diagnosticValue === 'essential' && unavailable.some(e => e.id === w.examId));
    for (const e of unavailable) rec.exams.push({ id: e.id, name: e.name, available: false, finding: '本院无法进行' });
    if (this.s.rules.scope === 'refer' && (essentialMissing || plan.setting === 'referral')) {
      rec.diagnosis = { id: suspect.id, name: suspect.name, tentative: true }; rec.correct = suspect.id === truth.id;
      rec.treatment = { setting: 'referral', text: plan.text };
      return this.finish(p, 'referred', essentialMissing ? `需要${unavailable.map(e => e.name).join('、')}，本院无法检查` : plan.reason);
    }
    for (const e of exams.filter(x => this.examAvailable(x))) {
      rec.cost += mid(e.costCNY);
      const room = this.roomOfType(e.room);
      if (e.room === 'consultation') { rec.exams.push(this.examResult(e, truth, this.s.minute, this.s.minute)); continue; }
      rec.exams.push({ id: e.id, name: e.name, available: true, orderedAt: this.s.minute, room: room.id, finding: null });
      p.plan.push(e.id);
    }
    if (p.plan.length) { this.log(rec, `开检查：${p.plan.map(id => this.kb.exam[id].name).join('、')}`); return this.nextExam(p); }
    this.decide(p, doc);
  }
  wrongGuess(truth) {
    const cands = truth.differentials.map(id => this.kb.disease[id]).filter(Boolean);
    const same = this.kb.diseases.filter(d => d.id !== truth.id && d.department === truth.department);
    return this.rng.pick(cands.length ? cands : same.length ? same : this.kb.diseases.filter(d => d.id !== truth.id));
  }
  examResult(exam, truth, doneAt, resultAt) {
    const w = truth.workup.find(x => x.examId === exam.id);
    return { id: exam.id, name: exam.name, available: true, orderedAt: doneAt, startedAt: doneAt, doneAt, resultAt, finding: w ? w.typicalFinding : '未见明显异常' };
  }
  nextExam(p) {
    const exam = this.kb.exam[p.plan[0]], room = this.roomOfType(exam.room);
    p.stage = 'exam_wait'; p.room = 'hall'; p.queuedAt = this.s.minute;
    (this.s.queues.exam[room.id] ||= []).push(p.id);
  }
  afterExam(p) {
    const rec = this.rec(p), truth = this.kb.disease[rec.truth], exam = this.kb.exam[p.plan.shift()];
    const e = rec.exams.find(x => x.id === exam.id && !x.doneAt);
    const at = this.s.minute + exam.resultMinutes;
    Object.assign(e, this.examResult(exam, truth, this.s.minute, at), { orderedAt: e.orderedAt, startedAt: e.startedAt, room: e.room });
    if (exam.resultMinutes > LONG_RESULT) { e.finding = `结果需 ${Math.round(exam.resultMinutes / 60)} 小时，另行回报`; e.pending = true; }
    else p.results.push({ id: exam.id, at });
    if (p.plan.length) return this.nextExam(p);
    p.stage = 'result_wait'; p.room = 'hall';
    if (p.results.every(r => r.at <= this.s.minute)) this.toReview(p);
  }
  toReview(p) {
    p.stage = 'review_wait'; p.room = 'hall'; p.queuedAt = this.s.minute; p.results = [];
    this.log(this.rec(p), '检查结果已出');
    (this.s.queues.review[p.doctorId] ||= []).push(p.id);
  }
  // 最终诊断与处置
  decide(p, doc) {
    const rec = this.rec(p), rng = this.rng, truth = this.kb.disease[rec.truth];
    // 误诊只来自“初步判断错了，检查和复评又没能纠正”。初步判断对了就维持（游戏简化）。
    let correct = rec.suspicion.id === truth.id;
    if (!correct) {
      const done = new Set(rec.exams.filter(e => e.available && e.doneAt != null && !e.pending).map(e => e.id));
      let evidence = 0.15;   // 问诊查体本身的复评机会
      // 做过的检查只要与“真实疾病”或“怀疑的疾病”相关，结果（阳性或出乎意料的阴性）都能帮助纠正判断。
      const suspect = this.kb.disease[rec.suspicion.id], weight = { essential: 0.55, supportive: 0.3, rule_out: 0.2 };
      const best = {};
      for (const w of [...truth.workup, ...suspect.workup]) if (done.has(w.examId)) best[w.examId] = Math.max(best[w.examId] || 0, weight[w.diagnosticValue] || 0);
      evidence += Object.values(best).reduce((a, b) => a + b, 0);
      evidence += doc.skill * 0.15 - doc.fatigue / 600;
      correct = rng.next() < Math.min(0.9, Math.max(0.05, evidence));
      if (correct) this.log(rec, '结合检查结果修正了初步判断');
    }
    const final = correct ? truth : this.kb.disease[rec.suspicion.id];
    rec.diagnosis = { id: final.id, name: final.name }; rec.correct = correct;
    this.log(rec, `诊断：${final.name}`);
    const plan = this.treatmentPlan(final, rec.triageLevel);
    rec.treatment = { setting: plan.setting, text: plan.text };
    if (plan.setting === 'referral') return this.finish(p, 'referred', plan.reason);
    rec.cost += Math.round(mid(final.costCNY) * this.config.fees.treatmentShare);
    p.stage = 'treat_wait'; p.room = 'hall'; p.queuedAt = this.s.minute;
    this.s.queues.treat.push(p.id);
  }

  // ---------- 离院与结局 ----------
  finish(p, disposition, reason = null) {
    const rec = this.rec(p), m = this.s.minute, truth = this.kb.disease[rec.truth];
    rec.disposition = disposition; rec.referralReason = reason; rec.finishedAt = m;
    this.log(rec, disposition === 'treated' ? '处置完成，离院' : disposition === 'referred' ? `转诊：${reason}` : disposition === 'left' ? '未就诊，自行离开' : `${reason}`);
    for (const q of [this.s.queues.triage, this.s.queues.treat, ...Object.values(this.s.queues.doctor), ...Object.values(this.s.queues.review), ...Object.values(this.s.queues.exam)]) {
      const i = q.indexOf(p.id); if (i >= 0) q.splice(i, 1);
    }
    for (const st of this.s.staff) if (st.task?.patientId === p.id) st.task = null;
    delete this.s.patients[p.id];
    if (disposition === 'left' || disposition === 'closed') {
      rec.outcome = { category: null, result: null, revealAt: m, note: '未完成就诊，结局未知' };
      return;
    }
    const elapsed = m - rec.arrivedAt;
    const category = !rec.correct ? 'missed' : elapsed > DELAY_LIMIT[rec.triageLevel] ? 'delayed' : 'timely';
    const probs = truth.outcomes[category], keys = ['recovered', 'improved', 'complication', 'death'];
    const result = this.rng.weighted(keys, keys.map(k => probs[k]));
    rec.outcome = { category, result, revealAt: m + FOLLOW_UP_DAYS * 1440, note: disposition === 'referred' ? '转诊后经接续治疗的结局（游戏估计）' : '门诊处置后的结局（游戏估计）' };
    if (!rec.correct && result !== 'death' && disposition === 'treated' && this.rng.next() < RETURN_CHANCE) {
      const at = this.nextOpening(m + this.rng.int(1, 3) * 1440 - 1440) + this.rng.int(0, 300);
      this.s.scheduled.push({ at, recordId: rec.id });
    }
    if (rec.returnOf) {
      const prev = this.recordById.get(rec.returnOf);
      const days = Math.max(1, Math.round((rec.arrivedAt - prev.finishedAt) / 1440));
      prev.flags.push({ t: m, type: 'misdiagnosis', text: `初诊误诊：${days} 天后返诊，诊断改为${rec.diagnosis?.name ?? '待定'}` });
    }
  }
  enforceLimits(m) {
    const { hour } = this.local(m);
    for (const p of Object.values(this.s.patients)) {
      const rec = this.rec(p);
      if ((p.stage === 'triage_wait' || p.stage === 'wait_doctor') && m - p.queuedAt > PATIENCE[p.level]) {
        rec.flags.push({ t: m, type: 'left', text: `候诊 ${m - p.queuedAt} 分钟后自行离开` });
        this.finish(p, 'left');
      } else if (hour >= this.config.lastServiceHour) {
        rec.flags.push({ t: m, type: 'closed', text: '超过服务时间未完成就诊，已约次日' });
        this.finish(p, 'closed', '超过服务时间未完成就诊，已约次日');
      }
    }
  }

  // ---------- 院长操作 ----------
  setRule(name, value) {
    if (!RULES[name] || !RULES[name][value]) throw new Error(`未知规则 ${name}=${value}`);
    this.s.rules[name] = value;
  }

  // ---------- 给画面和界面用的视图 ----------
  view() {
    const t = this.local();
    return {
      minute: this.s.minute, time: t, open: this.isOpen(), nextOpening: this.nextOpening(),
      patients: Object.values(this.s.patients).map(p => {
        const r = this.rec(p);
        return { id: p.id, name: r.name, sex: r.sex, age: r.age, level: p.level, stage: p.stage, stageLabel: STAGE_LABELS[p.stage], room: p.room, staffId: p.busyWith, doctorId: p.doctorId };
      }),
      staff: this.s.staff.map(st => ({ id: st.id, name: st.name, role: st.role, roleLabel: ROLE_LABELS[st.role], title: st.title || '', room: st.room, fatigue: Math.round(st.fatigue),
        patientId: st.task?.patientId || null, status: st.task ? { triage: '分诊', consult: '问诊', review: '看结果', exam: '做检查', treat: '处置' }[st.task.kind] : '空闲' })),
      rules: { ...this.s.rules },
    };
  }
  record(id) { return this.recordById.get(id) || null; }
}

const DEPT = { internal_medicine: '内科', surgery: '外科', emergency: '急诊科', orthopedics: '骨科', cardiology: '心内科' };
const EQUIP = { resuscitation_kit: '抢救设备', splint_kit: '夹板', ct_scanner: 'CT', ultrasound_machine: '超声', troponin_analyzer: '肌钙蛋白检测' };
const STAFF = { surgeon: '外科手术医师', emergency_physician: '急诊医师', orthopedic_physician: '骨科医师' };
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function mid([a, b]) { return Math.round((a + b) / 2); }
function p0(engine, pid) { return engine.s.patients[pid]; }
