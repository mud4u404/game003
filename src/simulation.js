import { createNurseTask, advanceNurseTask, syncNurseTask } from './staff-behavior.js';
import { movePatient, settledMotion, atDestination, patientPose, ROOM_POS, ENTRY, DESK, seatFeet, registrationSlot, nursingSlot, NURSING_POS, WALK_SPEED } from './movement.js';
// Time and randomness belong to the simulation, never to rendering or UI refreshes.
export const VERSION = 2;
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const PROJECT = { cost: 6800, duration: 20 * MINUTE, reserve: 30_000 };
export const CASES = [
  { id: 'routine', label: '常规门诊', fee: 160, consultation: 95_000, aftercare: false },
  { id: 'care', label: '基础护理需求', fee: 220, consultation: 105_000, aftercare: true },
  { id: 'specialist', label: '需专科评估', fee: 0, consultation: 65_000, aftercare: false }
];
export const STAFF = [
  { id: 'director', name: '周敏', role: '执行院长', color: '#526b72', description: '重视现金储备，依据持续需求安排投入。' },
  { id: 'doctor1', name: '林岚', role: '全科医生', color: '#e3ece8', description: '负责问诊和服务范围内的诊疗安排。' },
  { id: 'nurse', name: '陈雪', role: '护士', color: '#759899', description: '承担基础护理与院内协作。' },
  { id: 'reception', name: '何晴', role: '接待', color: '#5b7b85', description: '负责登记、预约与转诊联络。' },
  { id: 'doctor2', name: '顾宁', role: '全科医生', color: '#e3ece8', description: '第二诊室的接诊医生。' }
];
const SURNAMES = ['陈', '林', '周', '王', '徐', '沈', '赵', '方', '许', '李', '吴', '何'];
const GIVEN = ['文清', '明远', '舒宁', '子安', '雅琴', '建平', '晓禾', '雨桐', '思源', '清和', '书言', '知夏'];
const COLORS = ['#bd8668', '#6d8997', '#a6a07f', '#8d8b9c', '#78938a', '#b19480'];
const THOUGHTS = ['希望尽量不耽误下午的安排。', '这里很安静，先等医生叫号。', '想把自己的情况说清楚。', '希望下次还能遇到同一位医生。'];

function random(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
function note(s, title, detail, kind = 'care') {
  s.log.unshift({ id: ++s.eventSequence, at: s.time, title, detail, kind });
  s.log.length = Math.min(s.log.length, 48);
}
function demand(s, at) {
  // Only this function consumes world randomness. Construction and management cannot spawn demand.
  const roll = random(s);
  const kind = roll < 0.67 ? 'routine' : roll < 0.87 ? 'care' : 'specialist';
  const p = {
    id: 'patient-' + (++s.sequence), name: SURNAMES[Math.floor(random(s) * SURNAMES.length)] + GIVEN[Math.floor(random(s) * GIVEN.length)],
    age: 22 + Math.floor(random(s) * 54), kind, color: COLORS[Math.floor(random(s) * COLORS.length)],
    thought: THOUGHTS[Math.floor(random(s) * THOUGHTS.length)], appearance: Math.floor(random(s) * 4),
    arrivedAt: at, phase: 'arriving', phaseAt: at, due: at + 8000, room: null, seat: null, waitStarted: null
  };
  s.metrics.demand++;
  s.demandTrace.push({ id: p.id, at, kind });
  if (s.demandTrace.length > 256) s.demandTrace.shift();
  s.nextArrival = at + Math.round(47_000 + random(s) * 48_000);
  if (s.patients.filter(p => p.phase !== 'leaving').length >= 16) {
    s.metrics.capacityRedirected++;
    note(s, '接待安排了外部接续', '当前候诊已满，已告知新到访者可用的外部服务。', 'referral');
    return;
  }
  p.queueSlot = freeSlot(s, ['arriving', 'registerQueue']);
  p.motion = settledMotion(ENTRY, at);
  movePatient(p, 'arriving', at, registrationSlot(p.queueSlot), 0);
  s.patients.push(p);
}
function freeSlot(s, phases) {
  const occupied = new Set(s.patients.filter(p => phases.includes(p.phase)).map(p => p.queueSlot));
  let i = 0; while (occupied.has(i)) i++; return i;
}
function enter(p, phase, at, duration = null) {
  const target = { arriving: registrationSlot(p.queueSlot || 0), registerQueue: registrationSlot(p.queueSlot || 0),
    registration: DESK, waiting: seatFeet(p.seat || 0), consultation: ROOM_POS[p.room || 1],
    nursingQueue: nursingSlot(p.queueSlot || 0), nursing: NURSING_POS, leaving: ENTRY }[phase];
  movePatient(p, phase, at, target, duration);
}
function releaseRoom(p) {
  // Keep the room reserved until the outgoing patient has crossed its doorway.
  let length = 0;
  for (let i = 1; i < p.motion.points.length; i++) {
    const a = p.motion.points[i-1], b = p.motion.points[i];
    length += Math.hypot(b[0]-a[0], b[1]-a[1]);
    if (b[1] >= 364) break;
  }
  p.roomReleasedAt = p.motion.start + Math.ceil(length / WALK_SPEED * 1000);
}
function waitingSeat(s) {
  const occupied = new Set(s.patients.filter(p => ['waiting', 'consultation'].includes(p.phase) && p.seat !== null).map(p => p.seat));
  let index = 0; while (occupied.has(index)) index++; return index;
}
function dispatch(s) {
  if (!s.patients.some(p => p.phase === 'registration')) {
    const p = s.patients.find(p => ['arriving','registerQueue'].includes(p.phase));
    if (p?.phase === 'registerQueue' && atDestination(p,s.time)) enter(p, 'registration', s.time, 14_000);
  }
  // Queue advances into the newly vacated spot; nobody waits in the street.
  s.patients.filter(p=>['arriving','registerQueue'].includes(p.phase)).forEach((p,i)=>{
    if(p.queueSlot!==i){p.queueSlot=i;enter(p,p.phase,s.time,p.phase==='arriving'?0:null);}
  });
  for (let room = 1; room <= (s.secondRoom ? 2 : 1); room++) {
    if (s.patients.some(p => p.room === room && (p.phase === 'consultation' || p.roomReleasedAt > s.time))) continue;
    const p = s.patients.filter(p => p.phase === 'waiting' && (atDestination(p, s.time) || s.time <= p.motion.end)).sort((a, b) => a.waitStarted - b.waitStarted)[0];
    if (!p) break;
    const waited = s.time - p.waitStarted;
    s.metrics.waitTotal += waited; s.metrics.waitCount++;
    p.room = room; p.waited = waited;
    enter(p, 'consultation', s.time, CASES.find(c => c.id === p.kind).consultation);
  }
  if (!s.patients.some(p => p.phase === 'nursing')) {
    const p = s.patients.find(p => p.phase === 'nursingQueue' && atDestination(p, s.time));
    if (p) enter(p, 'nursing', s.time, 42_000);
  }
  syncNurseTask(s);
}
function finishVisit(s, p, referred = false) {
  if (referred) {
    s.metrics.referred++;
    note(s, '已安排专科接续', p.name + '需要本院范围以外的评估，接待已提供转诊信息。', 'referral');
  } else {
    const fee = CASES.find(c => c.id === p.kind).fee;
    s.cash += fee; s.metrics.revenue += fee; s.metrics.completed++;
    note(s, '完成一次接诊', p.name + '的本次服务已完成。收入 ¥' + fee + ' 已入账。');
  }
  p.outcome = referred ? '转诊接续' : '完成接诊';
  enter(p, 'leaving', s.time, 0);
}
function progressPatient(s, p) {
  switch (p.phase) {
    case 'arriving': enter(p, 'registerQueue', s.time); break;
    case 'registration':
      p.seat = waitingSeat(s); p.waitStarted = s.time;
      enter(p, 'waiting', s.time); break;
    case 'consultation':
      if (p.kind === 'specialist') finishVisit(s, p, true);
      else if (p.kind === 'care') { p.queueSlot = freeSlot(s, ['nursingQueue']); enter(p, 'nursingQueue', s.time); }
      else finishVisit(s, p);
      releaseRoom(p);
      break;
    case 'nursing': finishVisit(s, p); break;
    case 'leaving':
      s.history.unshift({ id: p.id, name: p.name, kind: p.kind, outcome: p.outcome, at: s.time });
      s.history.length = Math.min(s.history.length, 40);
      s.patients = s.patients.filter(item => item.id !== p.id); break;
  }
}
export function managerObservation(s) {
  const waiting = s.patients.filter(p => p.phase === 'waiting').length;
  return Object.freeze({
    at: s.time, waiting, cash: s.cash, secondRoom: s.secondRoom, project: s.project ? { ...s.project } : null,
    completed: s.metrics.completed, demand: s.metrics.demand, referred: s.metrics.referred,
    averageWait: s.metrics.waitCount ? s.metrics.waitTotal / s.metrics.waitCount : 0,
    investmentAuthority: s.authority, pressureChecks: s.pressureChecks
  });
}
// A future LLM adapter must consume observations and propose one of these validated actions.
export function proposeManagement(s) {
  const o = managerObservation(s);
  if (o.project) return { action: 'hold', reason: '第二诊室正在准备，现有门诊照常运行。' };
  if (o.secondRoom) return { action: 'hold', reason: o.waiting > 2 ? '两间诊室持续接诊，我会继续观察候诊变化。' : '目前两间诊室能够覆盖需求，暂不扩大投入。' };
  if (o.pressureChecks >= 2) {
    if (o.cash < PROJECT.cost + PROJECT.reserve) return { action: 'hold', reason: '候诊压力上升，但现金储备不足，暂缓新增固定成本。' };
    if (o.investmentAuthority) return { action: 'openSecondRoom', reason: '连续两次复盘发现候诊积压，计划启用第二诊室。' };
    return { action: 'hold', reason: '候诊持续积压。按你的授权，我保留资金并提交第二诊室建议。' };
  }
  return { action: 'hold', reason: o.waiting ? '候诊仍在观察范围，先按现有安排接诊。' : '门诊运行平稳，保持现有团队与现金储备。' };
}
export function applyManagementAction(s, proposal, actor = 'director') {
  if (!proposal || proposal.action !== 'openSecondRoom') return { ok: false, reason: '不支持的操作' };
  if (!['director', 'investor'].includes(actor)) return { ok: false, reason: '没有操作权限' };
  if (actor === 'director' && !s.authority) return { ok: false, reason: '超出投资授权' };
  if (s.secondRoom || s.project) return { ok: false, reason: '第二诊室已启用或正在准备' };
  if (s.cash < PROJECT.cost + PROJECT.reserve) return { ok: false, reason: '需保留 ¥30,000 运营储备' };
  s.cash -= PROJECT.cost; s.metrics.investment += PROJECT.cost;
  s.project = { type: 'secondRoom', startedAt: s.time, completesAt: s.time + PROJECT.duration, actor };
  note(s, '第二诊室进入准备阶段', (actor === 'investor' ? '根据你的决定' : '院长依据持续候诊需求') + '，投入 ¥6,800，安排设施与人员到岗。', 'management');
  return { ok: true };
}
export function setAuthority(s, value) {
  if (typeof value !== 'boolean' || s.authority === value) return false;
  s.authority = value;
  note(s, value ? '恢复院长投资授权' : '调整为保留资金', value ? '符合需求与现金储备条件时，院长可安排第二诊室。' : '日常运营照常，新增诊室由你决定。', 'management');
  return true;
}
function review(s) {
  const waiting = s.patients.filter(p => p.phase === 'waiting').length;
  s.pressureChecks = waiting >= 2 ? s.pressureChecks + 1 : 0;
  const proposal = proposeManagement(s);
  s.directorThought = proposal.reason;
  if (proposal.action !== 'hold') applyManagementAction(s, proposal);
  s.lastReview = s.time;
  s.nextReview += 3 * MINUTE;
}
export function createState(now = Date.now(), seed = 20260926) {
  const s = {
    version: VERSION, time: now, startedAt: now, rng: seed >>> 0, sequence: 0, eventSequence: 0,
    nextArrival: now + 9000, nextReview: now + 3 * MINUTE, nextCost: now + MINUTE,
    cash: 180000, secondRoom: false, authority: true, project: null, pressureChecks: 0,
    lastReview: now, directorThought: '先稳定基础门诊，持续观察需求，再决定是否启用第二诊室。',
    metrics: { demand: 0, completed: 0, referred: 0, capacityRedirected: 0, revenue: 0, operating: 0, investment: 0, waitTotal: 0, waitCount: 0 },
    patients: [], history: [], demandTrace: [], log: [], nurseTask: createNurseTask(now)
  };
  // An explicit opening cohort, present whether the player is watching or not.
  for (let i = 0; i < 4; i++) demand(s, now);
  s.patients.forEach((p, i) => {
    p.motion = settledMotion([310 + i * 17, 1016], now);
    enter(p, 'arriving', now + i * 1700, 0);
  });
  s.nextArrival = now + 45_000;
  note(s, '梅奥诊所开始营业', '林岚与陈雪已到岗。周敏负责日常经营，你可以随时观察和调整授权。', 'management');
  return s;
}
export function advanceTo(s, target, eventLimit = 200_000) {
  if (!Number.isFinite(target) || target <= s.time) return { caughtUp: true, events: 0 };
  let count = 0;
  while (count < eventLimit) {
    const patientDue = s.patients.reduce((min, p) => Math.min(min, p.due ?? Infinity, p.motionDue ?? Infinity, p.roomReleasedAt ?? Infinity), Infinity);
    const next = Math.min(s.nextArrival, s.nextCost, s.nextReview, s.project?.completesAt ?? Infinity, s.nurseTask.due ?? Infinity, patientDue);
    if (next > target) { s.time = target; return { caughtUp: true, events: count }; }
    s.time = next;
    advanceNurseTask(s);
    if (s.nextArrival === next) demand(s, next);
    if (s.nextCost === next) {
      const cost = s.secondRoom ? 19 : 12;
      s.cash -= cost; s.metrics.operating += cost; s.nextCost += MINUTE;
    }
    if (s.project?.completesAt === next) {
      s.secondRoom = true; s.project = null;
      note(s, '第二诊室开始接诊', '顾宁已到岗。新增容量不会改变小镇的患者需求。', 'management');
    }
    for (const p of s.patients) { if (p.motionDue === next) p.motionDue = null; if (p.roomReleasedAt === next) p.roomReleasedAt = null; }
    for (const p of [...s.patients]) if (p.due !== null && p.due === next) progressPatient(s, p);
    dispatch(s);
    if (s.nextReview === next) review(s);
    count++;
  }
  return { caughtUp: false, events: count };
}
export function phaseLabel(p, time = Infinity) {
  if (!atDestination(p, time)) {
    const pose = patientPose(p, time);
    if (pose.sit > 0 && time < p.motion.start) return '起身中';
    if (time >= p.motion.end && p.motion.toSeated) return '正在落座';
    return { waiting: '前往候诊座位', consultation: '前往诊室', nursing: '前往护理位',
      nursingQueue: '前往护理区', registration: '走向接待台', leaving: '正在离院' }[p.phase] || '正在到院';
  }
  return { arriving: '正在到院', registerQueue: '等待登记', registration: '接待登记', waiting: '候诊中',
    consultation: '正在接诊', nursingQueue: '等待护理', nursing: '基础护理', leaving: p.outcome || '准备离院' }[p.phase] || '';
}
export function snapshot(s) {
  return { time: s.time, completed: s.metrics.completed, referred: s.metrics.referred,
    revenue: s.metrics.revenue, operating: s.metrics.operating, investment: s.metrics.investment, cash: s.cash };
}
export function restoreState(serialized) {
  const s = JSON.parse(serialized);
  const finite = n => Number.isFinite(n);
  const count = n => Number.isSafeInteger(n) && n >= 0;
  const timed = new Set(['arriving', 'registration', 'consultation', 'nursing', 'leaving']);
  const metricKeys = ['demand', 'completed', 'referred', 'capacityRedirected', 'revenue', 'operating', 'investment', 'waitTotal', 'waitCount'];
  if (!s || ![1, VERSION].includes(s.version) || !finite(s.time) || !finite(s.cash) ||
      !finite(s.startedAt) || s.startedAt > s.time || !count(s.rng) ||
      ![s.sequence, s.eventSequence, s.pressureChecks].every(count) ||
      typeof s.authority !== 'boolean' || typeof s.secondRoom !== 'boolean' ||
      typeof s.directorThought !== 'string' || !finite(s.lastReview) ||
      !Array.isArray(s.patients) || !Array.isArray(s.log) || !Array.isArray(s.history) || !Array.isArray(s.demandTrace) ||
      !s.metrics || !metricKeys.every(key => count(s.metrics[key])) ||
      ![s.nextArrival, s.nextCost, s.nextReview].every(n => finite(n) && n >= s.time) ||
      s.patients.length > 32 || new Set(s.patients.map(p => p?.id)).size !== s.patients.length ||
      s.patients.some(p => !p || typeof p.id !== 'string' || typeof p.name !== 'string' ||
        typeof p.thought !== 'string' || typeof p.color !== 'string' || !count(p.age) || !count(p.appearance) ||
        !CASES.some(c => c.id === p.kind) || !phaseLabel(p) || !finite(p.phaseAt) || !finite(p.arrivedAt) ||
        (p.seat !== null && !count(p.seat)) || (p.room !== null && ![1, 2].includes(p.room)) ||
        (p.phase === 'consultation' && ![1, 2].includes(p.room)) ||
        (p.phase === 'waiting' && !finite(p.waitStarted)) ||
        (timed.has(p.phase) ? !finite(p.due) || p.due < s.time : p.due !== null)) ||
      s.log.some(e => !e || !count(e.id) || !finite(e.at) || typeof e.title !== 'string' || typeof e.detail !== 'string') ||
      s.history.some(e => !e || typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.outcome !== 'string') ||
      (s.project && (s.secondRoom || s.project.type !== 'secondRoom' || !finite(s.project.startedAt) ||
        !finite(s.project.completesAt) || s.project.completesAt < s.time ||
        s.project.completesAt - s.project.startedAt !== PROJECT.duration))) {
    throw new Error('存档格式不完整');
  }
  if (s.version === 1) {
    for (const p of s.patients) {
      p.queueSlot = Math.min(3, s.patients.filter(x => x.phase === p.phase).indexOf(p));
      const target = { arriving: ENTRY, registerQueue: registrationSlot(p.queueSlot), registration: DESK,
        waiting: seatFeet(p.seat || 0), consultation: ROOM_POS[p.room || 1], nursingQueue: nursingSlot(p.queueSlot),
        nursing: NURSING_POS, leaving: ENTRY }[p.phase];
      p.motion = settledMotion(target, s.time, ['waiting','consultation','nursing'].includes(p.phase));
      p.serviceAt = p.motion.ready; p.motionDue = null;
    }
    s.version = VERSION;
  }
  for (const p of s.patients) {
    const m = p.motion;
    if (!m || !Array.isArray(m.points) || m.points.length < 2 || m.points.length > 512 ||
        m.points.some(x => !Array.isArray(x) || x.length !== 2 || !x.every(finite)) ||
        ![m.at,m.start,m.end,m.ready,m.length,p.serviceAt].every(finite) || m.length < 0 ||
        m.at > m.start || m.start > m.end || m.end > m.ready ||
        (p.motionDue !== null && (!finite(p.motionDue) || p.motionDue < s.time)) ||
        (p.roomReleasedAt != null && (!finite(p.roomReleasedAt) || p.roomReleasedAt < s.time)) ||
        (p.due !== null && p.due < p.serviceAt)) throw new Error('存档动作时间不完整');
  }
  // Optional v2 addition: old saves retain patient progress and initialize staff chores.
  if(!s.nurseTask) { s.nurseTask=createNurseTask(s.time); syncNurseTask(s); }
  const task=s.nurseTask,m=task.motion;
  if(!['available','supplyWalk','preparing','returning','approach','care'].includes(task.phase) ||
      (task.due!==null && (!finite(task.due)||task.due<s.time)) ||
      !m || ![m.at,m.start,m.end,m.ready,m.length].every(finite) || m.length<0 || m.start>m.end ||
      !Array.isArray(m.points) || m.points.length<2 || m.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)))
    throw new Error('员工动作存档不完整');
  return s;
}
