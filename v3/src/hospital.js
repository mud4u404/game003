// A small deterministic rules core. Coordinates are grid tiles, time is simulated minutes.
const SPECS = Object.freeze({
  consult: { fixtures: ['desk', 'examCouch'], role: 'doctor', duration: 8 },
  lab: { fixtures: ['analyzer'], role: 'technician', duration: 5 },
  xray: { fixtures: ['xrayTable'], role: 'technician', duration: 7 },
  ward: { fixtures: ['bed'], role: 'nurse', duration: 15 },
});
const key = (x, y) => `${x},${y}`;
const neighbors = ({ x, y }) => [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }];

export function createHospital(width = 14, height = 12, entry = { x: 0, y: 5 }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3 ||
      entry.x < 0 || entry.y < 0 || entry.x >= width || entry.y >= height) throw new Error('Invalid hospital bounds');
  return { width, height, entry: { ...entry }, corridors: new Set([key(entry.x, entry.y)]),
    rooms: [], patients: [], minute: 0, nextRoomId: 1, nextPatientId: 1, events: [] };
}
function inside(h, x, y) { return x >= 0 && y >= 0 && x < h.width && y < h.height; }
function occupied(h, x, y) { return h.rooms.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h); }

export function addCorridor(h, x, y) {
  if (!inside(h, x, y) || occupied(h, x, y)) return false;
  h.corridors.add(key(x, y)); return true;
}

export function placeRoom(h, type, x, y, w, height, door) {
  if (!SPECS[type]) throw new Error('Unknown room type');
  if (![x, y, w, height, door?.x, door?.y].every(Number.isInteger) || w < 2 || height < 2) return { ok: false, reason: '尺寸无效' };
  const edge = (door.x === x || door.x === x + w - 1) && door.y >= y && door.y < y + height ||
    (door.y === y || door.y === y + height - 1) && door.x >= x && door.x < x + w;
  if (!edge) return { ok: false, reason: '门必须在房间边缘' };
  for (let px = x; px < x + w; px++) for (let py = y; py < y + height; py++) {
    if (!inside(h, px, py) || occupied(h, px, py) || h.corridors.has(key(px, py)))
      return { ok: false, reason: '越界或占用' };
  }
  const room = { id: h.nextRoomId++, type, x, y, w, h: height, door: { ...door }, fixtures: [], staff: null, busy: null };
  h.rooms.push(room); return { ok: true, room };
}

export function corridorRoute(h, target) {
  const goal = key(target.x, target.y), start = key(h.entry.x, h.entry.y), queue = [[h.entry]], seen = new Set([start]);
  while (queue.length) {
    const path = queue.shift(), p = path.at(-1);
    if (key(p.x, p.y) === goal) return path;
    for (const n of neighbors(p)) {
      const k = key(n.x, n.y);
      if (h.corridors.has(k) && !seen.has(k)) { seen.add(k); queue.push([...path, n]); }
    }
  }
  return null;
}

export function roomStatus(h, room) {
  const requirements = SPECS[room.type];
  const missing = requirements.fixtures.filter(f => !room.fixtures.includes(f));
  if (!room.staff || room.staff.role !== requirements.role) missing.push(requirements.role);
  const corridorDoor = neighbors(room.door).find(p => h.corridors.has(key(p.x, p.y)));
  const route = corridorDoor && corridorRoute(h, corridorDoor);
  if (!route) missing.push('入口不连通');
  return { ready: missing.length === 0, missing, route };
}

export function equip(h, roomId, fixture) {
  const room = h.rooms.find(r => r.id === roomId);
  if (!room || !SPECS[room.type].fixtures.includes(fixture)) return false;
  if (!room.fixtures.includes(fixture)) room.fixtures.push(fixture);
  return true;
}
export function assign(h, roomId, staff) {
  const room = h.rooms.find(r => r.id === roomId);
  if (!room || !staff?.id || staff.role !== SPECS[room.type].role ||
      h.rooms.some(r => r.id !== roomId && r.staff?.id === staff.id)) return false;
  room.staff = { id: staff.id, role: staff.role }; return true;
}

// A case supplies a fixture route, e.g. ['consult', 'lab', 'consult']; authored medical data comes later.
export function admit(h, route) {
  if (!Array.isArray(route) || route.length === 0 || route.some(s => !SPECS[s])) throw new Error('Invalid route');
  const patient = { id: h.nextPatientId++, route: [...route], step: 0, state: 'waiting', roomId: null,
    history: [{ minute: h.minute, event: 'arrived' }] };
  h.patients.push(patient); return patient;
}
export function advance(h, minutes = 1) {
  if (!Number.isInteger(minutes) || minutes < 0) throw new Error('Use whole simulated minutes');
  for (let i = 0; i < minutes; i++) {
    h.minute++;
    for (const room of h.rooms) if (room.busy && room.busy.until <= h.minute) {
      const p = h.patients.find(v => v.id === room.busy.patientId);
      if (p) {
        p.history.push({ minute: h.minute, event: `finished:${room.type}` }); p.step++; p.roomId = null;
        p.state = p.step === p.route.length ? 'discharged' : 'waiting';
      }
      room.busy = null;
    }
    // Waiting order is arrival order, never an unexplained teleport to an unavailable service.
    for (const p of h.patients) {
      if (p.state !== 'waiting') continue;
      const next = p.route[p.step];
      const room = h.rooms.find(r => r.type === next && !r.busy && roomStatus(h, r).ready);
      if (!room) continue;
      p.state = 'inService'; p.roomId = room.id;
      room.busy = { patientId: p.id, until: h.minute + SPECS[next].duration };
      p.history.push({ minute: h.minute, event: `started:${next}`, roomId: room.id });
    }
  }
  return h;
}

export const ROOM_SPECS = SPECS;
