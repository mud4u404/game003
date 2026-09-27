#!/usr/bin/env node
// 用默认配置模拟一个营业日并打印摘要：node tools/sim-day.mjs [种子] [检查策略] [接诊范围]
import { Engine } from '../v2/src/sim/engine.js';
import { daySummary } from '../v2/src/sim/stats.js';
import { loadData } from '../v2/src/sim/load-node.js';
const [seed = '1', strategy = 'standard', scope = 'refer'] = process.argv.slice(2);
const { kb, config } = loadData();
const start = Date.UTC(2026, 8, 28, 0, 0) - config.timezoneOffsetMinutes * 60000; // 当地 0:00
const e = new Engine(kb, config, { seed: Number(seed), startMs: start });
e.setRule('examStrategy', strategy); e.setRule('scope', scope);
e.advanceTo(start + 24 * 3600000);
const s = daySummary(e, '2026-09-28');
const byDisease = {};
for (const id of s.lists.all) { const r = e.record(id); byDisease[kb.diseases.find(d => d.id === r.truth).name] = (byDisease[kb.diseases.find(d => d.id === r.truth).name] || 0) + 1; }
const wrong = s.lists.all.map(id => e.record(id)).filter(r => r.correct === false).length;
console.log(`日期 ${s.date}｜策略 ${strategy}｜范围 ${scope}`);
console.log(`接诊 ${s.arrivals}｜处置离院 ${s.treated}｜转诊 ${s.referred}｜未就诊离开 ${s.left}｜平均候诊 ${s.avgWait} 分｜最长 ${s.maxWait} 分｜收入 ¥${s.revenue}`);
console.log('转诊原因', s.referralReasons);
console.log('病种', byDisease);
console.log(`实际误诊（上帝视角，汇报里看不到）${wrong} 例`);
for (const id of [s.lists.treated[0], s.lists.referred[0], s.lists.all.find(i => e.record(i).exams.length > 1)].filter(Boolean)) {
  const r = e.record(id);
  console.log(`\n—— 病历 ${r.id} ${r.name} ${r.sex === 'male' ? '男' : '女'} ${r.age}岁 ${['', 'I', 'II', 'III', 'IV'][r.triageLevel]}级`);
  console.log(`主诉：${r.complaint}｜症状：${r.symptoms.join('、')}`);
  console.log(`接诊：${r.doctorName}｜初步考虑：${r.suspicion?.name}｜诊断：${r.diagnosis?.name}`);
  for (const x of r.exams) console.log(`  检查 ${x.name}：${x.finding}`);
  console.log(`处置：${r.treatment?.text}｜去向：${r.disposition}${r.referralReason ? '（' + r.referralReason + '）' : ''}｜费用 ¥${r.cost}`);
  console.log('经过：' + r.timeline.map(t => { const l = e.local(t.t); return `${String(l.hour).padStart(2, '0')}:${String(l.minute).padStart(2, '0')} ${t.text}`; }).join(' → '));
}
