import { initVenture, ventureDue, advanceVenture, acceptingAt, nextAdmission, serviceAvailable, investmentAllowed, validateVenture, siteOf, candidate } from './business.js';
import { GIVEN_PROFILES, patientSex } from './identity.js';
import { createMedical, newClinicalCase, CLINICAL_CASES, ANNEX, LAB_HOURS, DAY, clinicalNote, clinicalStatus, recordPatient, scheduleClinical, medicalDue, validateMedical, createPharmacy, PHARMACY } from './medical.js';
import { createNurseTask, advanceNurseTask, syncNurseTask } from './staff-behavior.js';
import { movePatient, settledMotion, atDestination, patientPose, ROOM_POS, ENTRY, DESK, seatFeet, registrationSlot, nursingSlot, NURSING_POS, WALK_SPEED, SAMPLE_POS, URGENT_POS, PHARMACY_POS } from './movement.js';
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
  {id:'pharmacist',name:'陆承安',role:'药师',color:'#e3ece8',description:'负责处方审核、药品核对发放、用药说明和库存交接。'},
  { id:'nurse2',name:'许禾',role:'采样护士',color:'#759899',description:'负责相邻采样单元的核对、采样与送检交接。' },
  { id: 'director', name: '周敏', role: '执行院长', color: '#526b72', description: '重视现金储备，依据持续需求安排投入。' },
  { id: 'doctor1', name: '林岚', role: '全科医生', color: '#e3ece8', description: '负责问诊和服务范围内的诊疗安排。' },
  { id: 'nurse', name: '陈雪', role: '护士', color: '#759899', description: '承担基础护理与院内协作。' },
  { id: 'reception', name: '何川', role: '接待', color: '#5b7b85', description: '负责登记、预约与转诊联络。' },
  { id: 'doctor2', name: '顾宁', role: '全科医生', color: '#e3ece8', description: '第二诊室的接诊医生。' }
];
const SURNAMES = ['陈', '林', '周', '王', '徐', '沈', '赵', '方', '许', '李', '吴', '何'];
const GIVEN = GIVEN_PROFILES.map(([name])=>name);
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
  p.sex=patientSex(p);
  s.metrics.demand++;
  s.demandTrace.push({ id: p.id, at, kind });
  if (s.demandTrace.length > 256) s.demandTrace.shift();
  s.nextArrival = at + Math.round(s.venture ? 720_000 + random(s)*600_000 : s.medical ? 180_000 + random(s)*180_000 : 47_000 + random(s)*48_000);
  if(s.medical){p.clinical=newClinicalCase(p);p.thought=CLINICAL_CASES[p.clinical.type].complaint;}
  if(s.venture){
    if(!acceptingAt(s,at)){s.venture.world.closed++;return;}
    if((s.sequence*37)%100>=siteOf(s.venture.site).access){s.venture.world.outside++;return;}
    if(!serviceAvailable(s,p.clinical.type)){s.venture.world.unavailable++;note(s,'已提供外部就诊指引','到访需求超出本院当前服务范围，接待已指引合适的合作机构。','referral');return;}
  }
  if (s.patients.filter(p => p.phase !== 'leaving').length >= 16 && p.clinical?.priority!==0) {
    s.metrics.capacityRedirected++;
    note(s, '接待安排了外部接续', '当前候诊已满，已告知新到访者可用的外部服务。', 'referral');
    return;
  }
  p.queueSlot = freeSlot(s, ['arriving', 'registerQueue']);
  p.annexAccess=Boolean(s.medical?.annex);
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
    nursingQueue: nursingSlot(p.queueSlot || 0), nursing: NURSING_POS, sampling:SAMPLE_POS, pharmacy:PHARMACY_POS, urgent:[URGENT_POS[0]-(p.urgentSlot||0)*60,URGENT_POS[1]], leaving: ENTRY }[phase];
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
    if(room===1 && s.patients.some(p=>p.phase==='urgent'))continue;
    const p = s.patients.filter(p => p.phase === 'waiting' && (!p.clinical || ['consult','review','followup'].includes(p.clinical.stage)) && (atDestination(p, s.time) || s.time <= p.motion.end)).sort((a,b)=>(a.clinical?.priority??2)-(b.clinical?.priority??2)||a.waitStarted-b.waitStarted)[0];
    if (!p) break;
    const waited = s.time - p.waitStarted;
    s.metrics.waitTotal += waited; s.metrics.waitCount++;
    p.room = room; p.waited = waited;
    enter(p, 'consultation', s.time, p.clinical ? (p.clinical.stage==='review'?180000:300000) : CASES.find(c => c.id === p.kind).consultation);
  }
  if (!s.patients.some(p => ['nursing','urgent'].includes(p.phase))) {
    const p = s.patients.find(p => p.phase === 'nursingQueue' && atDestination(p, s.time));
    if (p) enter(p, 'nursing', s.time, 42_000);
  }
  dispatchClinical(s);
  syncNurseTask(s);
  alignClinicalStaff(s);
}
function finishVisit(s, p, referred = false) {
  if (referred) {
    s.metrics.referred++;
    note(s, '已安排专科接续', p.name + '需要本院范围以外的评估，接待已提供转诊信息。', 'referral');
  } else {
    const fee = p.clinical ? (p.clinical.stage==='sample'?80:p.clinical.visit?40:80) : CASES.find(c => c.id === p.kind).fee;
    s.cash += fee; s.metrics.revenue += fee; s.metrics.completed++;
    note(s, '完成一次接诊', p.name + '的本次服务已完成。收入 ¥' + fee + ' 已入账。');
  }
  p.outcome = p.clinical?.outcome || (referred ? '转诊接续' : '完成接诊');
  if(p.clinical){clinicalNote(p,s.time,p.outcome);recordPatient(s,p);}
  enter(p, 'leaving', s.time, 0);
}
function progressPatient(s, p) {
  if(p.clinical && progressClinical(s,p))return;
  switch (p.phase) {
    case 'arriving': enter(p, 'registerQueue', s.time); break;
    case 'registration':
      p.seat = waitingSeat(s); p.waitStarted = s.time;
      if(p.clinical){p.clinical.waitSince=s.time;p.clinical.readyAt=s.time+(['pressure','workup','screening'].includes(p.clinical.type)?5*MINUTE:0);}
      enter(p, 'waiting', s.time);
      if(p.clinical?.stage==='assessment'&&['pressure','workup','screening'].includes(p.clinical.type))p.clinical.readyAt=p.motion.ready+5*MINUTE;
      break;
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
  const waiting = s.patients.filter(p => p.phase === 'waiting' && (!p.clinical || ['consult','review','followup'].includes(p.clinical.stage))).length;
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
  const issue=investmentAllowed(s,proposal?.action);if(issue)return {ok:false,reason:issue};
  if(proposal && ['buildAnnex','priorityLab','standardLab','openPharmacy'].includes(proposal.action))return clinicalInvestment(s,proposal.action,actor);
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
  if(s.venture&&s.venture.stage!=='open'){s.nextReview+=3*MINUTE;s.lastReview=s.time;return;}
  const waiting = s.patients.filter(p => p.phase === 'waiting' && (!p.clinical || ['consult','review','followup'].includes(p.clinical.stage))).length;
  s.pressureChecks = waiting >= 2 ? s.pressureChecks + 1 : 0;
  const proposal = proposeManagement(s);
  s.directorThought = proposal.reason;
  if (proposal.action !== 'hold') applyManagementAction(s, proposal);
  s.lastReview = s.time;
  s.nextReview += 3 * MINUTE;
}
export function createState(now = Date.now(), seed = 20260926, options={}) {
  const s = {
    medical:options.medical===false?null:createMedical(now),
    version: VERSION, time: now, startedAt: now, rng: seed >>> 0, sequence: 0, eventSequence: 0,
    nextArrival: now + 9000, nextReview: now + 3 * MINUTE, nextCost: now + MINUTE,
    cash: 180000, secondRoom: false, authority: true, project: null, pressureChecks: 0,
    lastReview: now, directorThought: '先稳定基础门诊，持续观察需求，再决定是否启用第二诊室。',
    metrics: { demand: 0, completed: 0, referred: 0, capacityRedirected: 0, revenue: 0, operating: 0, investment: 0, waitTotal: 0, waitCount: 0 },
    patients: [], history: [], demandTrace: [], log: [], nurseTask: createNurseTask(now)
  };
  // An explicit opening cohort, present whether the player is watching or not.
  if(!options.empty)for (let i = 0; i < 4; i++) demand(s, now);
  s.patients.forEach((p, i) => {
    p.motion = settledMotion([310 + i * 17, 1016], now);
    enter(p, 'arriving', now + i * 1700, 0);
  });
  s.nextArrival = now + 45_000;
  note(s, '梅奥诊所开始营业', '林岚与陈雪已到岗。周敏负责日常经营，你可以随时观察和调整授权。', 'management');
  return s;
}
export function createVenture(now=Date.now(),seed=20260926){
  const s=createState(now,seed,{empty:true});s.venture=initVenture(now);s.log=[];s.eventSequence=0;s.authority=false;return s;
}
export function advanceTo(s, target, eventLimit = 200_000) {
  if (!Number.isFinite(target) || target <= s.time) return { caughtUp: true, events: 0 };
  let count = 0;
  while (count < eventLimit) {
    const patientDue = s.patients.reduce((min, p) => Math.min(min, p.due ?? Infinity, p.motionDue ?? Infinity, p.roomReleasedAt ?? Infinity), Infinity);
    const next = Math.min(s.nextArrival, s.nextCost, s.nextReview, s.project?.completesAt ?? Infinity, s.nurseTask.due ?? Infinity, s.sampleTask?.due ?? Infinity, medicalDue(s), ventureDue(s), patientDue);
    if (next > target) { s.time = target; return { caughtUp: true, events: count }; }
    s.time = next;
    advanceVenture(s);
    advanceNurseTask(s);
    advanceClinical(s);
    if (s.nextArrival === next) demand(s, next);
    if (s.nextCost === next) {
      const extra=s.medical?.annex?ANNEX.operating:0;
      if(s.medical&&!s.venture){s.medical.costs.staffSpace+=extra;if(s.medical.pharmacy.enabled)s.medical.pharmacy.operating+=PHARMACY.operating;}
      const cost = s.venture?0:(s.secondRoom ? 19 : 12)+extra+(s.medical?.pharmacy.enabled?PHARMACY.operating:0);
      s.cash -= cost; s.metrics.operating += cost; s.nextCost += MINUTE;
    }
    if (s.project?.completesAt === next) {
      s.secondRoom = true; s.project = null;
      note(s, '第二诊室开始接诊', (s.venture?'周启明':'顾宁')+'已到岗。新增容量不会改变小镇的患者需求。', 'management');
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
  if(p.clinical && atDestination(p,time))return clinicalStatus(p,time);
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
    revenue: s.metrics.revenue, operating: s.metrics.operating, investment: s.metrics.investment, cash: s.cash, debtPaid:s.venture?.debtPaid||0 };
}
export function restoreState(serialized) {
  const s = JSON.parse(serialized);
  const finite = n => Number.isFinite(n);
  const count = n => Number.isSafeInteger(n) && n >= 0;
  const timed = new Set(['arriving', 'registration', 'consultation', 'nursing', 'sampling', 'pharmacy', 'urgent', 'leaving']);
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
        (p.sex!==undefined&&!['female','male'].includes(p.sex)) || typeof p.thought !== 'string' || typeof p.color !== 'string' || !count(p.age) || !count(p.appearance) ||
        !CASES.some(c => c.id === p.kind) || !['arriving','registerQueue','registration','waiting','consultation','nursingQueue','nursing','sampling','pharmacy','urgent','leaving'].includes(p.phase) || !phaseLabel(p) || !finite(p.phaseAt) || !finite(p.arrivedAt) ||
        (p.seat !== null && !count(p.seat)) || (p.room !== null && ![1, 2].includes(p.room)) ||
        (p.phase === 'consultation' && ![1, 2].includes(p.room)) ||
        (p.phase === 'waiting' && !finite(p.waitStarted)) ||
        (p.pausedForUrgent ? p.due!==null || !finite(p.remainingService) || p.remainingService<0 : timed.has(p.phase) ? !finite(p.due) || p.due < s.time : p.due !== null)) ||
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
  if(s.medical===undefined)s.medical=createMedical(s.time);
  if(s.medical&&s.medical.pharmacy===undefined)s.medical.pharmacy=createPharmacy();
  validateMedical(s);
  validateVenture(s);
  if(s.sampleTask){const t=s.sampleTask,m=t.motion;if(!m||![m.at,m.start,m.end,m.ready,m.length].every(finite)||m.start>m.end||!Array.isArray(m.points)||m.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite))||(t.due!==null&&(!finite(t.due)||t.due<s.time)))throw Error('采样岗位存档不完整');}
  return s;
}

function spendClinical(s,amount,category){s.cash-=amount;s.metrics.operating+=amount;s.medical.costs[category]+=amount;}
function queueClinical(s,p,stage){p.clinical.stage=stage;p.clinical.waitSince=s.time;p.waitStarted=s.time;p.seat=waitingSeat(s);p.room=null;enter(p,'waiting',s.time);}
function closeClinical(s,p,outcome,referred=false){p.clinical.outcome=outcome;finishVisit(s,p,referred);}
function arrangeFollowup(s,p,days){
  if(!scheduleClinical(s,p,'followup',days*DAY))clinicalNote(p,s.time,'本院随访名额已满，已交接合作机构继续跟进。');
}
function prescribe(s,p){
  p.clinical.prescription={status:'医师已审核',issuedAt:s.time,description:'核对既往方案后续配；药品与剂量由既有处方记录管理'};
  p.clinical.plan.push(s.medical.pharmacy.enabled?'前往院内药房，由药师审核处方、核对续配并说明用药；缺货时安排外部接续。':'本院尚未开设药房，由合作药房审核与续配，继续家庭监测。');s.medical.stats.prescribed++;
  clinicalNote(p,s.time,'已核对既往处方、过敏史与当前资料；生成续配处方。');
}
function progressClinical(s,p){const c=p.clinical,m=s.medical;
  if(p.phase==='arriving'&&c.priority===0){
    c.stage='urgent';c.findings=[CLINICAL_CASES.urgent.assessment];c.diagnosis=CLINICAL_CASES.urgent.diagnosis;c.plan=[CLINICAL_CASES.urgent.plan];clinicalNote(p,s.time,'识别急症警示，立即联系急救接收方；不等待常规登记。');
    p.urgentSlot=s.patients.filter(q=>q.phase==='urgent').length;enter(p,'urgent',s.time,2*MINUTE);m.stats.urgent++;
    note(s,'团队启动急救接续',p.name+'出现急症警示。护士照护等候，医生协调转诊，接待联系接收方。','referral');return true;
  }
  if(p.phase==='urgent'){
    c.outcome='已交接急救接收方 · 后续待回传';clinicalNote(p,s.time,'急救接收方确认接续，完成交接；不能据此判定治愈。');
    s.metrics.referred++;scheduleClinical(s,p,'transfer',DAY);recordPatient(s,p);
    s.history.unshift({id:p.id,name:p.name,kind:p.kind,outcome:c.outcome,at:s.time});s.history.length=Math.min(40,s.history.length);
    s.patients=s.patients.filter(q=>q.id!==p.id);note(s,'急救转诊已交接',p.name+'由接收方继续评估，诊所等待后续回传。','referral');return true;
  }
  if(p.phase==='pharmacy'){
    if(c.stage==='pharmacy'){
      c.stage='dispense';c.prescription.status='药师审核通过 · 核对调配中';
      clinicalNote(p,s.time,'院内药师完成处方审核，核对患者、既往用药及续配记录。');p.due=s.time+MINUTE;
    }else{
      const f=m.pharmacy;f.stock--;f.dispensed++;m.stats.dispensed++;
      f.revenue+=PHARMACY.unitCost;s.cash+=PHARMACY.unitCost;s.metrics.revenue+=PHARMACY.unitCost;
      c.prescription.status='院内药房已核对发药';c.prescription.dispensedAt=s.time;
      clinicalNote(p,s.time,'药师核对并发放续配药品，说明用药和后续监测；院内库存扣减一份。');
      arrangeFollowup(s,p,30);closeClinical(s,p,'已完成院内取药 · 继续长期管理');orderMedicines(s);
    }
    return true;
  }
  if(['nursing','sampling'].includes(p.phase)){
    if(c.stage==='assessment'){
      c.assessmentAt=s.time;c.findings.push(CLINICAL_CASES[c.type].assessment);m.stats.assessed++;
      clinicalNote(p,s.time,'完成到院评估与测量，记录症状、病史及警示信息。');queueClinical(s,p,'consult');
    }else{
      m.stats.sampled++;spendClinical(s,18,'consumables');spendClinical(s,m.lab==='priority'?180:100,'external');
      c.report={status:'已送检',sampledAt:s.time,expectedAt:s.time+LAB_HOURS[m.lab]*HOUR,contract:m.lab};
      clinicalNote(p,s.time,'在院内采样位完成标本核对与采样；标本交合作实验室分析，心电检查另由合作机构完成，等待回传。');
      if(scheduleClinical(s,p,'report',LAB_HOURS[m.lab]*HOUR))closeClinical(s,p,'已完成采样 · 等待外部报告');
      else closeClinical(s,p,'后续名额已满 · 交接合作机构',true);
    }return true;
  }
  if(p.phase!=='consultation')return false;
  c.diagnosis=CLINICAL_CASES[c.type].diagnosis;
  clinicalNote(p,s.time,c.stage==='review'?'医生复核外部报告。':c.stage==='followup'?'医生完成随访复评。':'医生完成问诊、相关体格检查与资料核对。');
  if(c.stage==='review'){
    m.stats.reviewed++;const lag=s.time-c.report.receivedAt;c.delay=lag;
    if(lag>30*MINUTE){m.stats.lateReviews++;clinicalNote(p,s.time,'报告返回至复核超过本院30分钟流程目标；此为流程信号，不直接推断医疗损害。');}
    if(c.report.abnormal){c.diagnosis='检查异常 · 需进一步评估';c.plan=['解释异常，安排上级机构进一步评估；不据单份报告自动加药。'];closeClinical(s,p,'检查异常 · 已安排专科评估',true);}
    else {c.plan=['已复核当前检查资料，继续既往管理并安排随访。'];prescribe(s,p);releaseRoomAfterQueue(s,p,'pharmacy');return true;}
  }else if(c.stage==='followup'){
    if(c.type==='screening'){c.diagnosis='血压持续偏高 · 需完善确认';c.plan=['结合家庭记录安排进一步确认与风险评估，未凭一次读数开药。'];m.stats.unresolved++;closeClinical(s,p,'需进一步确认 · 已接续评估',true);}
    else if(c.variation.persistent){c.diagnosis=c.type==='respiratory'?'症状尚未明显改善':'血压控制仍需调整';c.plan=['复核病程、用药和新出现的症状；安排后续评估，不把未改善自动归为医护失误。'];m.stats.unresolved++;closeClinical(s,p,'复评后需继续管理');}
    else{m.stats.improved++;c.plan=['当前反馈改善，保留后续注意事项与长期管理安排。'];closeClinical(s,p,c.type==='respiratory'?'随访反馈改善':'随访控制平稳');}
  }else if(c.type==='workup'){
    c.plan=[CLINICAL_CASES.workup.plan];clinicalNote(p,s.time,'根据本次评估开具检查安排。');
    if(s.venture&&!s.venture.plan.services.includes('sampling')){
      spendClinical(s,m.lab==='priority'?180:100,'external');
      c.report={status:'合作机构待采样与检查',orderedAt:s.time,expectedAt:s.time+LAB_HOURS[m.lab]*HOUR,contract:m.lab,source:'external'};
      clinicalNote(p,s.time,'本院未开设采样，已交接合作机构完成采样和检查；报告按合作安排回传。');
      if(!scheduleClinical(s,p,'report',LAB_HOURS[m.lab]*HOUR))clinicalNote(p,s.time,'本院自动回传容量已满，由合作机构继续检查与复核。');closeClinical(s,p,'已安排合作机构检查');releaseRoom(p);return true;
    }
    releaseRoomAfterQueue(s,p,'sample');return true;
  }else{
    c.plan=[CLINICAL_CASES[c.type].plan];
    if(c.type==='pressure'){prescribe(s,p);releaseRoomAfterQueue(s,p,'pharmacy');return true;}
    arrangeFollowup(s,p,c.type==='respiratory'?7:c.type==='screening'?7:30);
    closeClinical(s,p,c.type==='pressure'?'续配方案已审核 · 等待药房接续':c.type==='screening'?'尚未确诊 · 已约非同日复测':'已说明照护方案 · 安排随访');
  }
  releaseRoom(p);return true;
}
function releaseRoomAfterQueue(s,p,stage){const room=p.room;queueClinical(s,p,stage);p.room=room;releaseRoom(p);}
function dispatchClinical(s){if(!s.medical)return;
  if(!s.patients.some(p=>p.phase==='pharmacy')){
    const p=s.patients.filter(p=>p.phase==='waiting'&&p.clinical?.stage==='pharmacy'&&atDestination(p,s.time)).sort((a,b)=>a.clinical.waitSince-b.clinical.waitSince)[0];
    if(p){
      if(s.medical.pharmacy.enabled&&s.medical.pharmacy.stock>0){p.clinical.prescription.status='院内药师审核中';enter(p,'pharmacy',s.time,90_000);}
      else {
        p.clinical.prescription.status=s.medical.pharmacy.enabled?'院内暂缺 · 已交接合作药房':'合作药房待审核';s.medical.pharmacy.external++;
        clinicalNote(p,s.time,s.medical.pharmacy.enabled?'院内续配库存不足，已告知患者并交接合作药房，未在院内发药。':'本院未开设药房，处方已交接合作药房审核与续配。');
        if(!scheduleClinical(s,p,'dispense',HOUR))clinicalNote(p,s.time,'自动回传名额已满，处方交由患者选择的药房接续。');
        arrangeFollowup(s,p,30);closeClinical(s,p,s.medical.pharmacy.enabled?'院内缺货 · 等待合作药房接续':'已安排合作药房续配');orderMedicines(s);
      }
    }
  }
  const urgent=s.patients.some(p=>p.phase==='urgent');
  for(const p of s.patients){
    if(urgent&&(p.phase==='nursing'||p.phase==='consultation'&&p.room===1)&&!p.pausedForUrgent){
      p.remainingService=Math.max(0,p.due-s.time);p.due=null;p.pausedForUrgent=true;
    }else if(!urgent&&p.pausedForUrgent){p.pausedForUrgent=false;p.due=s.time+p.remainingService;delete p.remainingService;if(p.phase==='nursing'){p.serviceAt=s.time;p.staffAligned=false;}}
  }
  const waiting=s.patients.filter(p=>p.phase==='waiting'&&p.clinical&&['assessment','sample'].includes(p.clinical.stage)&&atDestination(p,s.time)&&(p.clinical.readyAt??0)<=s.time)
    .sort((a,b)=>a.clinical.priority-b.clinical.priority||a.clinical.waitSince-b.clinical.waitSince);
  if(!urgent&&!s.patients.some(p=>p.phase==='nursing')){
    const p=waiting.find(p=>p.clinical.stage==='assessment'||!s.medical.annex);
    if(p)startNursing(s,p,'nursing');
  }
  if(s.medical.annex&&!s.patients.some(p=>p.phase==='sampling')){
    const p=waiting.find(p=>p.phase==='waiting'&&p.clinical.stage==='sample');if(p)startNursing(s,p,'sampling');
  }
}
function startNursing(s,p,phase){
  const sample=p.clinical.stage==='sample';
  if(sample){s.medical.stats.sampleWait+=s.time-p.clinical.waitSince;s.medical.stats.sampleCount++;}
  p.annexAccess=Boolean(s.medical.annex);enter(p,phase,s.time,sample?3*MINUTE:p.clinical.type==='respiratory'?45000:2*MINUTE);p.staffAligned=false;
}
function alignClinicalStaff(s){for(const p of s.patients){
  if(!p.clinical||!['nursing','sampling','urgent'].includes(p.phase)||p.pausedForUrgent||p.staffAligned)continue;
  const task=p.phase==='sampling'?s.sampleTask:s.nurseTask;if(task?.patientId!==p.id){if(p.phase==='urgent'){const active=s.patients.find(q=>q.id===task?.patientId);if(active?.due)p.due=Math.max(p.due,active.due+2*MINUTE);}continue;}
  const start=Math.max(p.serviceAt,task.motion.ready);p.due+=start-p.serviceAt;p.serviceAt=start;p.staffAligned=true;
}}
function returnPatient(s,e){
  const c=e.clinical;c.visit++;c.outcome=null;c.waitSince=s.time;c.readyAt=s.time;
  const p={...e.patient,id:c.episodeId+'-v'+c.visit,clinical:c,arrivedAt:s.time,phase:'arriving',phaseAt:s.time,due:null,room:null,seat:null,waitStarted:null,annexAccess:Boolean(s.medical.annex)};
  p.queueSlot=freeSlot(s,['arriving','registerQueue']);p.motion=settledMotion(ENTRY,s.time);movePatient(p,'arriving',s.time,registrationSlot(p.queueSlot),0);s.patients.push(p);
  note(s,'已安排复诊',p.name+(c.stage==='review'?'返回诊所复核报告。':'按约定返回，团队继续跟进此前的就诊。'));
}
function orderMedicines(s){const f=s.medical.pharmacy;
  if(!f.enabled||f.stock>PHARMACY.reorderAt||f.order||s.cash<PHARMACY.batch*PHARMACY.unitCost+PHARMACY.reserve)return;
  const cost=PHARMACY.batch*PHARMACY.unitCost;s.cash-=cost;s.metrics.operating+=cost;f.procurement+=cost;
  f.order={due:s.time+PHARMACY.delivery,quantity:PHARMACY.batch};
  note(s,'药房已安排补货','续配库存达到补货线，采购24份，预计4小时后交接入库。','management');
}
function advanceClinical(s){const m=s.medical;if(!m)return;
  if(m.pharmacy.project?.completesAt===s.time){m.pharmacy.enabled=true;m.pharmacy.project=null;m.pharmacy.stock=PHARMACY.initialStock;if(s.venture&&!s.venture.plan.services.includes('pharmacy'))s.venture.plan.services.push('pharmacy');note(s,'院内药房开始服务','陆承安已到岗，药柜与首批库存完成交接，可承接模型范围内的续配处方。','management');}
  if(m.pharmacy.order?.due===s.time){m.pharmacy.stock+=m.pharmacy.order.quantity;m.pharmacy.order=null;note(s,'药房补货已入库','药师完成到货核对，续配库存已补充。','management');}

  if(m.annexProject?.completesAt===s.time){m.annex=true;m.annexProject=null;syncNurseTask(s);note(s,'相邻采样单元投入使用',(s.venture?'沈宁':'许禾')+'已到岗，采样不再占用原护理位；新增工资、租金与维护支出开始计入。','management');}
  for(const e of [...m.pending].filter(e=>e.due===s.time)){
    if(s.venture&&['return','followup'].includes(e.kind)&&!acceptingAt(s)){e.due=Math.max(s.time+60000,nextAdmission(s,s.time));continue;}
    if(['return','followup'].includes(e.kind)&&s.patients.filter(p=>p.phase!=='leaving').length>=16){e.due+=30*MINUTE;continue;}
    m.pending=m.pending.filter(q=>q!==e);const c=e.clinical,p={...e.patient,clinical:c};
    if(e.kind==='report'){
      m.stats.reported++;c.report={...c.report,status:'已返回 · 待医生复核',receivedAt:s.time,abnormal:c.variation.abnormalReport,
        summary:c.variation.abnormalReport?'肾功能相关结果异常，需结合临床进一步评估。':'本次检查未见明显异常，仍需医师结合病史复核。'};
      c.findings.push(c.report.summary);c.stage='review';c.priority=c.report.abnormal?1:2;clinicalNote(p,s.time,'外部检查资料已齐，进入医生复核队列。');recordPatient(s,p);m.pending.push({...e,kind:'return',due:s.time});
    }else if(e.kind==='return'){returnPatient(s,e);
    }else if(e.kind==='dispense'){
      m.stats.dispensed++;c.prescription.status='合作药房已核对发药';clinicalNote(p,s.time,'合作药房回传：已核对处方并发药，完成用药说明。');
      const existing=m.records.find(r=>r.id===c.episodeId);if(existing){existing.clinical.prescription=c.prescription;existing.clinical.trail.push({at:s.time,text:'合作药房已核对发药并说明用药。'});existing.clinical.trail=existing.clinical.trail.slice(-24);existing.at=s.time;}
      for(const q of m.pending)if(q.clinical.episodeId===c.episodeId)q.clinical.prescription=c.prescription;
      for(const q of s.patients)if(q.clinical?.episodeId===c.episodeId)q.clinical.prescription=c.prescription;
      note(s,'药房回传已发药',p.name+'的续配处方已由合作药房核对接续。');
    }else if(e.kind==='followup'){
      if(c.type==='respiratory'&&!c.variation.persistent){c.outcome='随访反馈：症状改善';m.stats.improved++;clinicalNote(p,s.time,'随访联系收到改善反馈，未将其记为医生即时治愈。');recordPatient(s,p);note(s,'收到随访反馈',p.name+'反馈症状改善。');}
      else {c.stage='followup';c.findings.push(c.type==='screening'?'带回非同日家庭记录，需进一步确认。':c.variation.persistent?'随访反馈未达到预期，已安排复评。':'随访记录较平稳，按约定复诊。');returnPatient(s,e);}
    }else {c.outcome='接收方已接续 · 诊所尚无长期结局';clinicalNote(p,s.time,'收到接续确认；外部完整病程尚未回传，不推断治疗成功或失败。');recordPatient(s,p);note(s,'收到转诊接续确认',p.name+'已由接收方继续诊疗。','referral');}
  }
  if(m.nextAudit===s.time){
    orderMedicines(s);
    const waiting=s.patients.filter(p=>p.clinical?.stage==='sample'&&p.phase==='waiting');
    const pressure=waiting.some(p=>s.time-p.clinical.waitSince>5*MINUTE);
    m.pressureChecks=pressure?m.pressureChecks+1:0;
    m.observation=m.annex?'采样单元已运行，继续比较等待与新增成本。':m.pressureChecks>=2?'采样连续两次复盘出现长等待，建议租下相邻单元并安排专职护士。':'继续观察采样等待，尚无持续扩建依据。';
    if(m.pressureChecks>=2&&s.authority&&!m.annex&&!m.annexProject)clinicalInvestment(s,'buildAnnex','director');
    m.nextAudit+=30*MINUTE;
  }
}
function clinicalInvestment(s,action,actor){const m=s.medical;
  const issue=investmentAllowed(s,action);if(issue)return {ok:false,reason:issue};
  if(!m)return {ok:false,reason:'医疗服务尚未启用'};
  if(!['investor','director'].includes(actor)||actor==='director'&&!s.authority)return {ok:false,reason:'超出投资授权'};
  if(action==='openPharmacy'){
    const f=m.pharmacy;
    if(f.enabled||f.project)return {ok:false,reason:'药房已启用或正在筹备'};
    if(s.cash<PHARMACY.cost+PHARMACY.reserve)return {ok:false,reason:'需保留 ¥30,000 运营储备'};
    s.cash-=PHARMACY.cost;s.metrics.investment+=PHARMACY.cost;f.project={startedAt:s.time,completesAt:s.time+PHARMACY.duration};
    note(s,'筹备院内药房','投入 ¥9,500 改造原行政房间、配置药柜及首批24份续配库存，药师30分钟后到岗。','management');
  }else if(action==='buildAnnex'){
    if(m.annex||m.annexProject)return {ok:false,reason:'相邻单元已启用或正在准备'};
    if(s.cash<ANNEX.cost+ANNEX.reserve)return {ok:false,reason:'需保留 ¥30,000 运营储备'};
    s.cash-=ANNEX.cost;s.metrics.investment+=ANNEX.cost;m.annexProject={startedAt:s.time,completesAt:s.time+ANNEX.duration,actor};
    note(s,'租下相邻单元','投入 ¥24,000，准备独立采样位并安排护士；1 小时后启用，原门诊继续运行。','management');
  }else{
    const lab=action==='priorityLab'?'priority':'standard';if(m.lab===lab)return {ok:false,reason:'已采用该合作安排'};
    m.lab=lab;note(s,'调整外检合作',lab==='priority'?'新送检采用优先合作：1 小时回传，单次外部成本 ¥180。':'新送检恢复常规合作：4 小时回传，单次外部成本 ¥100。','management');
  }
  return {ok:true};
}
