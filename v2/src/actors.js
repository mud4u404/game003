// 把模拟状态变成场景里的人物：每个人该在哪、以什么姿势、怎么走过去。
// 纯逻辑，不依赖浏览器；位置单位与 layout.js 相同（一块地砖 0.5）。
const ROOMS = {
  consult: { x0: 0, y0: 0, x1: 4, y1: 4, door: { x: 2, y: 4 } },
  lab: { x0: 4, y0: 0, x1: 9, y1: 4, door: { x: 6.5, y: 4 } },
  hall: { x0: 0, y0: 4, x1: 9, y1: 6, door: null },
  xray: { x0: 0, y0: 6, x1: 4, y1: 9, door: { x: 2.5, y: 6 } },
  ward: { x0: 4, y0: 6, x1: 9, y1: 9, door: { x: 7, y: 6 } },
  outside: { x0: 9, y0: -99, x1: 99, y1: 99, door: { x: 9, y: 5.2 } },
};
export const OUTSIDE = { x: 10.1, y: 5.7, z: 0, pose: 'stand' };
const SEATS = [0, 1].flatMap(row => Array.from({ length: 6 }, (_, i) => ({ x: 4.45 + i * .55, y: [4.35, 5.2][row] + .32, z: 0, pose: 'seat' })));
const OVERFLOW = Array.from({ length: 10 }, (_, i) => ({ x: .5 + i * .38, y: 5.82, z: 0, pose: 'stand', back: true }));
const TRIAGE_AT = { x: 1.55, y: 5.4, z: 0, pose: 'stand', back: true };
const TRIAGE_QUEUE = Array.from({ length: 6 }, (_, i) => ({ x: 2.2 + i * .42, y: 5.55, z: 0, pose: 'stand', back: true }));
const BEDS = [4.5, 5.9, 7.3].map(x => ({ x: x + .37, y: 6.6, z: .45, pose: 'lie' }));
const SPOT = {
  'consult:doctor-1': { x: 2.28, y: 2.4, z: 0, pose: 'seat', back: true },
  'consult:doctor-2': { x: 6.9, y: 8.55, z: 0, pose: 'stand', back: true },
  'lab': { x: 4.6, y: 3.1, z: 0, pose: 'seat' },
  'xray': { x: 1.6, y: 7.27, z: .38, pose: 'lie' },
};
export const STAFF_HOME = {
  'doctor-1': { x: 2.28, y: 1.05, z: 0, pose: 'seat' },
  'doctor-2': { x: 7.75, y: 8.55, z: 0, pose: 'stand' },
  'triage': { x: 1.4, y: 4.35, z: 0, pose: 'stand' },
  'ward-nurse': { x: 6.4, y: 8.2, z: 0, pose: 'stand' },
  'lab-tech': { x: 6.2, y: 2.9, z: 0, pose: 'stand', back: true },
  'xray-tech': { x: 3.4, y: 8.85, z: 0, pose: 'stand', back: true },
};
const STAFF_WORK = { 'lab-tech': { x: 5.15, y: 3.05, z: 0, pose: 'stand' } };
const STAFF_LOOK = { 'doctor-1': 'doctor', 'doctor-2': 'doctor2', triage: 'nurse', 'ward-nurse': 'nurse', 'lab-tech': 'technician', 'xray-tech': 'technician' };
const PATIENT_LOOKS = ['red', 'blue', 'yellow', 'green', 'purple', 'teal'];
const SPEED = 1.4; // 地面单位 / 秒

export function roomAt(p) {
  for (const [id, r] of Object.entries(ROOMS)) if (id !== 'outside' && p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1) return id;
  return 'outside';
}
// Join room doors and seat fronts through the clear southern aisle.
// Bench footprints occupy x=4.2..7.5, y=4.35..4.85 and 5.2..5.7.
function toAisle(p, room) {
  if (room === 'lab') return [{ ...ROOMS.lab.door }, { x: 7.8, y: 4.1 }, { x: 7.8, y: 5.92 }];
  if (room === 'consult') return [{ ...ROOMS.consult.door }, { x: 3.65, y: 5.92 }];
  if (room === 'outside') return [{ x: 9.4, y: 5.3 }, { ...ROOMS.outside.door }, { x: 8, y: 5.92 }];
  if (room !== 'hall') return [{ ...ROOMS[room].door }];
  if (p.x >= 4.2 && p.x <= 7.5 && p.y < 4.35) return [{ x: 3.65, y: p.y }, { x: 3.65, y: 5.92 }];
  if (p.x >= 4.2 && p.x <= 7.5 && p.y < 5.2) return [{ x: p.x, y: 5.02 }, { x: 3.65, y: 5.02 }, { x: 3.65, y: 5.92 }];
  return [{ x: p.x, y: 5.92 }];
}
export function route(from, to) {
  const a = roomAt(from), b = roomAt(to);
  if (a === b && a !== 'hall') return [to];
  const pts = [...toAisle(from, a), ...toAisle(to, b).reverse(), to];
  return pts.filter((p,i) => !i || p.x !== pts[i-1].x || p.y !== pts[i-1].y);
}

export class Actors {
  constructor() { this.list = new Map(); this.seats = new Map(); this.beds = new Map(); this.overflow = new Map(); }

  // 根据模拟视图更新每个人的目标位置。返回是否有人需要移动。
  sync(view) {
    const present = new Set();
    const hallWaiting = new Set(['wait_doctor', 'exam_wait', 'result_wait', 'review_wait', 'treat_wait']);
    const triageQueue = view.patients.filter(p => p.stage === 'triage_wait').sort((a, b) => num(a.id) - num(b.id));
    for (const p of view.patients) {
      present.add(p.id);
      let spot;
      if (p.stage === 'triage_wait') spot = TRIAGE_QUEUE[Math.min(triageQueue.indexOf(p), TRIAGE_QUEUE.length - 1)];
      else if (p.stage === 'triage') spot = TRIAGE_AT;
      else if (hallWaiting.has(p.stage)) spot = this.claim(this.seats, SEATS, p.id) || this.claim(this.overflow, OVERFLOW, p.id) || TRIAGE_QUEUE.at(-1);
      else if (p.stage === 'consult' || p.stage === 'review') spot = SPOT[`consult:${p.staffId}`] || SPOT['consult:doctor-1'];
      else if (p.stage === 'exam' && p.room === 'lab') spot = SPOT.lab;
      else if (p.stage === 'exam' && p.room === 'xray') spot = SPOT.xray;
      else spot = this.claim(this.beds, BEDS, p.id) || SPOT['consult:doctor-2'];
      if (!hallWaiting.has(p.stage)) { this.seats.delete(p.id); this.overflow.delete(p.id); }
      if (!(p.stage === 'treatment' || (p.stage === 'exam' && p.room === 'ward'))) this.beds.delete(p.id);
      let a = this.list.get(p.id);
      if (!a) {
        a = { id: p.id, kind: 'patient', name: p.name, role: '患者', appearance: PATIENT_LOOKS[num(p.id) % PATIENT_LOOKS.length], ...OUTSIDE, target: null, path: [] };
        this.list.set(p.id, a);
      }
      a.stageLabel = p.stageLabel; a.level = p.level; a.sex = p.sex; a.stage = p.stage;
      this.goTo(a, spot);
    }
    for (const a of this.list.values()) {
      if (a.kind !== 'patient' || present.has(a.id) || a.leaving) continue;
      a.leaving = true; this.seats.delete(a.id); this.overflow.delete(a.id); this.beds.delete(a.id);
      a.stageLabel = '离院';
      this.goTo(a, OUTSIDE);
    }
    for (const st of view.staff) {
      let a = this.list.get(st.id);
      if (!a) { a = { id: st.id, kind: 'staff', name: st.name, role: st.roleLabel, appearance: STAFF_LOOK[st.id] || 'technician', ...(STAFF_HOME[st.id] || OUTSIDE), target: null, path: [] }; this.list.set(st.id, a); }
      a.status = st.status;
      const work = st.status !== '空闲' && STAFF_WORK[st.id];
      this.goTo(a, work || STAFF_HOME[st.id] || OUTSIDE);
    }
    return this.moving();
  }
  claim(map, spots, id) {
    if (map.has(id)) return spots[map.get(id)];
    const used = new Set(map.values());
    const i = spots.findIndex((_, k) => !used.has(k));
    if (i < 0) return null;
    map.set(id, i); return spots[i];
  }
  goTo(a, spot) {
    const t = a.target;
    if (t && t.x === spot.x && t.y === spot.y && t.z === spot.z && t.pose === spot.pose) return;
    a.target = { ...spot };
    a.path = route(a, spot);
    a.transition = a.pose === 'seat' ? { kind: 'rise', elapsed: 0, duration: .32 } : null;
    a.z = 0; if (!a.transition) a.pose = 'walk';
  }
  // 动作只随实际移动距离推进；坐下/起身在原地完成，不改变模拟时钟。
  step(dt) {
    for (const a of [...this.list.values()]) {
      let time = Math.max(0, dt);
      if (a.transition) {
        const t = a.transition, spent = Math.min(time, t.duration - t.elapsed);
        t.elapsed += spent; time -= spent;
        if (t.elapsed < t.duration) continue;
        a.transition = null;
        a.pose = t.kind === 'rise' ? 'walk' : 'seat';
      }
      if (!a.path.length) continue;
      let budget = SPEED * time;
      while (budget > 0 && a.path.length) {
        const n = a.path[0], dx = n.x - a.x, dy = n.y - a.y, d = Math.hypot(dx, dy);
        if (d > .00001) {
          // 正交地面方向投影到屏幕，四个方向由正背面与镜像组成。
          a.back = dx + dy < 0; a.mirror = a.back ? dx - dy < 0 : dx - dy > 0;
          a.walkDistance = (a.walkDistance || 0) + Math.min(d, budget);
        }
        if (d <= budget) { a.x = n.x; a.y = n.y; budget -= d; a.path.shift(); }
        else { a.x += dx / d * budget; a.y += dy / d * budget; budget = 0; }
      }
      if (a.path.length) a.pose = 'walk';
      else {
        Object.assign(a, { z: a.target.z || 0, pose: a.target.pose, back: !!a.target.back, mirror: false });
        if (a.leaving) this.list.delete(a.id);
        else if (a.target.pose === 'seat' && budget / SPEED < .32) a.transition = { kind: 'sit', elapsed: budget / SPEED, duration: .32 };
      }
    }
    return this.moving();
  }
  // 直接放到目标位置（首次载入、离线补算后，不播放走路）。
  settle() { for (const a of [...this.list.values()]) { if (a.leaving) { this.list.delete(a.id); continue; } if (a.target) Object.assign(a, { x: a.target.x, y: a.target.y, z: a.target.z || 0, pose: a.target.pose, back: !!a.target.back, path: [], transition: null, mirror: false }); } }
  moving() { for (const a of this.list.values()) if (a.path.length || a.transition) return true; return false; }
  people() { return [...this.list.values()]; }
}
function num(id) { return Number(String(id).replace(/\D/g, '')) || 0; }
