import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../v2/src/sim/engine.js';
import { loadData } from '../../v2/src/sim/load-node.js';
import { Actors, roomAt, route, OUTSIDE } from '../../v2/src/actors.js';

const { kb, config } = loadData();
const DAY0 = Date.UTC(2026, 8, 28) - config.timezoneOffsetMinutes * 60000;

test('每个在院病人的目标位置都在其所在房间内，座位和病床不重复', () => {
  for (const seed of [2, 6]) {
    const e = new Engine(kb, config, { seed, startMs: DAY0 }), actors = new Actors();
    for (let t = DAY0 + 8 * 3600000; t < DAY0 + 19 * 3600000; t += 60000) {
      e.advanceTo(t);
      const v = e.view();
      actors.sync(v);
      const taken = new Set();
      for (const p of v.patients) {
        const a = actors.list.get(p.id), key = `${a.target.x},${a.target.y}`;
        assert.equal(roomAt(a.target), p.room, `${p.id} ${p.stage} 应在 ${p.room}，目标在 ${roomAt(a.target)}`);
        if (a.target.pose === 'seat' || a.target.pose === 'lie') { assert.ok(!taken.has(key), `${p.id} 与他人抢同一个位置 ${key}`); taken.add(key); }
      }
      actors.step(60);   // 每分钟走完
    }
  }
});

test('离院病人走出大门后从场景中移除', () => {
  const e = new Engine(kb, config, { seed: 3, startMs: DAY0 }), actors = new Actors();
  e.advanceTo(DAY0 + 11 * 3600000); actors.sync(e.view()); actors.settle();
  e.advanceTo(DAY0 + 20 * 3600000); actors.sync(e.view());
  assert.ok(actors.people().some(a => a.leaving));
  actors.step(60);
  assert.ok(!actors.people().some(a => a.kind === 'patient'));
});

test('跨房间路线经过门口', () => {
  const r = route({ x: 2.3, y: 2.4 }, { x: 1.6, y: 7.27 });
  assert.deepEqual(r.slice(0, 2), [{ x: 2, y: 4 }, { x: 2.5, y: 6 }]);
  assert.equal(roomAt(OUTSIDE), 'outside');
  assert.deepEqual(route({ x: 5, y: 5 }, OUTSIDE).at(-1), OUTSIDE);
});
