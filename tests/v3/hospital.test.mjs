import test from 'node:test';
import assert from 'node:assert/strict';
import { createHospital, addCorridor, placeRoom, roomStatus, equip, assign, admit, advance } from '../../v3/src/hospital.js';

function setup() {
  const h = createHospital();
  for (let x = 1; x < 14; x++) addCorridor(h, x, 5);
  return h;
}
function build(h, type, x, staff, fixtures) {
  const result = placeRoom(h, type, x, 2, 3, 3, { x: x + 1, y: 4 });
  assert.equal(result.ok, true);
  for (const item of fixtures) assert.equal(equip(h, result.room.id, item), true);
  assert.equal(assign(h, result.room.id, staff), true);
  return result.room;
}

test('rooms cannot overlap or hide a corridor; a door must face a reachable hallway', () => {
  const h = setup();
  const a = placeRoom(h, 'consult', 1, 2, 3, 3, { x: 2, y: 4 });
  assert.equal(a.ok, true);
  assert.equal(placeRoom(h, 'lab', 2, 2, 3, 3, { x: 3, y: 4 }).ok, false);
  assert.equal(placeRoom(h, 'lab', 5, 4, 3, 3, { x: 6, y: 4 }).ok, false);
  assert.equal(placeRoom(h, 'lab', 5, 2, 3, 3, { x: 6, y: 3 }).ok, false);
  const detached = placeRoom(h, 'lab', 5, 8, 3, 3, { x: 6, y: 8 }).room;
  assert.deepEqual(roomStatus(h, detached).missing.includes('入口不连通'), true);
});

test('missing staff or required equipment blocks care and does not silently process patients', () => {
  const h = setup();
  const room = placeRoom(h, 'consult', 1, 2, 3, 3, { x: 2, y: 4 }).room;
  const p = admit(h, ['consult']);
  advance(h, 30); assert.equal(p.state, 'waiting');
  assert.deepEqual(roomStatus(h, room).missing, ['desk', 'examCouch', 'doctor']);
  equip(h, room.id, 'desk'); equip(h, room.id, 'examCouch');
  assign(h, room.id, { id: 'd1', role: 'doctor' });
  advance(h, 9); assert.equal(p.state, 'discharged');
  assert.deepEqual(p.history.map(v => v.event), ['arrived', 'started:consult', 'finished:consult']);
});

test('a test result returns to consultation, and a shared doctor serves one patient at a time', () => {
  const h = setup();
  const clinic = build(h, 'consult', 1, { id: 'd1', role: 'doctor' }, ['desk', 'examCouch']);
  build(h, 'lab', 5, { id: 't1', role: 'technician' }, ['analyzer']);
  const a = admit(h, ['consult', 'lab', 'consult']);
  const b = admit(h, ['consult']);
  advance(h, 1); assert.equal(a.state, 'inService'); assert.equal(b.state, 'waiting');
  assert.equal(clinic.busy.patientId, a.id);
  advance(h, 30);
  assert.equal(a.state, 'discharged'); assert.equal(b.state, 'discharged');
  assert.deepEqual(a.history.map(v => v.event), ['arrived', 'started:consult', 'finished:consult', 'started:lab', 'finished:lab', 'started:consult', 'finished:consult']);
  assert.ok(a.history.every((event, i, arr) => i === 0 || event.minute >= arr[i - 1].minute));
});

test('deterministic simulated time supports pause and chunked speed without real clocks', () => {
  const make = () => { const h = setup(); build(h, 'consult', 1, { id: 'd1', role: 'doctor' }, ['desk', 'examCouch']); admit(h, ['consult']); return h; };
  const paused = make(); advance(paused, 0); assert.equal(paused.minute, 0);
  const single = make(), chunks = make(); advance(single, 20); for (let i = 0; i < 4; i++) advance(chunks, 5);
  assert.deepEqual(chunks, single);
  assert.throws(() => advance(single, 1.5));
});
