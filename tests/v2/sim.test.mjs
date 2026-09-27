import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../v2/src/sim/engine.js';
import { daySummary, periodSummary } from '../../v2/src/sim/stats.js';
import { loadData } from '../../v2/src/sim/load-node.js';

const { kb, config } = loadData();
const DAY0 = Date.UTC(2026, 8, 28) - config.timezoneOffsetMinutes * 60000; // 当地 2026-09-28 0:00
const H = 3600000;
const make = (seed, rules = {}) => { const e = new Engine(kb, config, { seed, startMs: DAY0 }); for (const [k, v] of Object.entries(rules)) e.setRule(k, v); return e; };

test('一个营业日里每个到院患者最终都有去向，没有卡住的患者', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const e = make(seed);
    e.advanceTo(DAY0 + 20 * H);
    const recs = e.s.records.filter(r => e.local(r.arrivedAt).date === '2026-09-28');
    assert.ok(recs.length > 15, `seed ${seed} 到院人数过少：${recs.length}`);
    for (const r of recs) assert.ok(['treated', 'referred', 'left', 'closed'].includes(r.disposition), `seed ${seed} ${r.id} 没有去向：${r.disposition}`);
    assert.equal(Object.keys(e.s.patients).length, 0, '下班后仍有患者滞留');
    for (const st of e.s.staff) assert.equal(st.task, null);
  }
});

test('一次推进与逐分钟推进结果完全一致', () => {
  const a = make(3), b = make(3);
  a.advanceTo(DAY0 + 14 * H);
  for (let t = DAY0; t <= DAY0 + 14 * H; t += 60000) b.advanceTo(t);
  assert.equal(a.serialize(), b.serialize());
});

test('存档后恢复继续推进，与不中断一致（跨夜离线补算）', () => {
  const a = make(5), b = make(5);
  a.advanceTo(DAY0 + 11 * H + 17 * 60000);
  const saved = a.serialize();
  const c = Engine.restore(kb, config, saved);
  c.advanceTo(DAY0 + 40 * H);           // 离线到次日下午
  b.advanceTo(DAY0 + 40 * H);
  assert.equal(c.serialize(), b.serialize());
});

test('“精简”检查策略的误诊率高于“规范”', () => {
  const rate = strategy => {
    let wrong = 0, seen = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const e = make(seed, { examStrategy: strategy });
      e.advanceTo(DAY0 + 20 * H);
      for (const r of e.s.records) if (r.correct !== null) { seen++; if (!r.correct) wrong++; }
    }
    return wrong / seen;
  };
  const lean = rate('lean'), standard = rate('standard');
  assert.ok(lean > standard + 0.03, `精简 ${lean.toFixed(3)} 应明显高于规范 ${standard.toFixed(3)}`);
});

test('能力外直接转诊：本院做不了的病立即转出，病历写明原因', () => {
  let found = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const e = make(seed);
    e.advanceTo(DAY0 + 20 * H);
    for (const r of e.s.records) {
      if (r.suspicion?.id !== 'acute_appendicitis' || r.disposition === 'left' || r.disposition === 'closed') continue;
      found++;
      assert.equal(r.disposition, 'referred');
      assert.ok(r.referralReason && r.referralReason.length > 2, '缺少转诊原因');
      assert.ok(!r.exams.some(x => x.doneAt != null && x.room), '能力外直接转诊不应先排队做检查');
    }
  }
  assert.ok(found > 0, '样本里没有疑似阑尾炎患者');
});

test('尽量处理：同类患者会先做本院能做的检查，再转诊', () => {
  let found = 0;
  for (let seed = 1; seed <= 40 && !found; seed++) {
    const e = make(seed, { scope: 'try' });
    e.advanceTo(DAY0 + 20 * H);
    const r = e.s.records.find(x => x.suspicion?.id === 'acute_appendicitis' && x.triageLevel >= 3 && x.disposition === 'referred');
    if (r) { found++; assert.ok(r.exams.some(x => x.id === 'cbc' && x.doneAt != null), '应先做血常规'); }
  }
  assert.ok(found, '未找到样本');
});

test('病历内容完整：主诉、接诊医生、诊断、处置、费用、经过', () => {
  const e = make(2);
  e.advanceTo(DAY0 + 20 * H);
  const treated = e.s.records.filter(r => r.disposition === 'treated');
  assert.ok(treated.length);
  for (const r of treated) {
    assert.ok(r.complaint && r.symptoms.length && r.doctorName && r.suspicion && r.diagnosis && r.treatment?.text);
    assert.ok(r.cost > 0 && r.timeline.length >= 5 && r.outcome?.revealAt > r.finishedAt);
  }
});

test('误诊患者返诊后，原病历补标“初诊误诊”，并出现在汇报里', () => {
  let flagged = 0;
  for (let seed = 1; seed <= 12 && !flagged; seed++) {
    const e = make(seed, { examStrategy: 'lean' });
    e.advanceTo(DAY0 + 5 * 24 * H);
    for (const r of e.s.records.filter(x => x.flags.some(f => f.type === 'misdiagnosis'))) {
      flagged++;
      assert.equal(r.correct, false);
      const back = e.record(r.returnedAs);
      assert.equal(back.returnOf, r.id);
      assert.ok(daySummary(e, e.local(r.arrivedAt).date).lists.misdiagnosed.includes(r.id));
    }
  }
  assert.ok(flagged > 0, '多日模拟中应出现返诊纠正的误诊');
});

test('汇报与离线简报的数字可以追溯到病历', () => {
  const e = make(4);
  e.advanceTo(DAY0 + 20 * H);
  const s = daySummary(e, '2026-09-28');
  assert.equal(s.lists.all.length, s.arrivals);
  assert.equal(s.treated + s.referred + s.left + s.inProgress, s.arrivals);
  for (const id of s.lists.referred) assert.equal(e.record(id).disposition, 'referred');
  const p = periodSummary(e, e.s.startMinute, e.s.minute);
  assert.equal(p.arrivals, s.arrivals);
  assert.ok(p.revenue > 0);
});

test('视图接口给出每个在院患者的环节、房间和负责人员', () => {
  const e = make(6);
  e.advanceTo(DAY0 + 10 * H + 30 * 60000);
  const v = e.view();
  assert.ok(v.open && v.patients.length > 0);
  const rooms = new Set(config.rooms.map(r => r.id));
  for (const p of v.patients) { assert.ok(p.stageLabel && rooms.has(p.room), `${p.id} ${p.stage} ${p.room}`); }
  for (const st of v.staff) assert.ok(st.status && st.roleLabel);
});

test('非营业时间没有新患者，并能给出下次开门时间', () => {
  const e = make(7);
  e.advanceTo(DAY0 + 7 * H);
  assert.equal(e.s.records.length, 0);
  assert.equal(e.view().open, false);
  assert.equal(e.local(e.nextOpening()).hour, config.openHour);
});

test('数据清单与病种文件一致（浏览器按清单加载）', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../../data/diseases/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
  const manifest = JSON.parse(readFileSync(new URL('../../data/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual([...manifest.diseases].sort(), files);
});
