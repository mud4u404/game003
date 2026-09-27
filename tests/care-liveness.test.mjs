import test from 'node:test';
import assert from 'node:assert/strict';
import {createVenture,advanceTo,restoreState,MINUTE,HOUR} from '../src/simulation.js';
import {configureDraft,launchVenture} from '../src/business.js';
import {atDestination} from '../src/movement.js';
import {clinicalStatus} from '../src/medical.js';
import {careNextStep} from '../src/activity.js';
const START=Date.parse('2026-09-27T23:30:00+08:00');
function open(seed,services){
 const s=createVenture(START,seed);
 for(const [kind,id] of [['site','station'],['model','general'],...services.map(v=>['service',v]),...['gu','xu','he',...(services.includes('pharmacy')?['lu']:[])].map(v=>['staff',v])])assert.equal(configureDraft(s,kind,id).ok,true);
 assert.equal(launchVenture(s).ok,true);return s;
}
// Completion totals alone can conceal one permanently stranded patient. Inspect each admission.
test('all admitted patients make progress across a full opening day, service combinations and population seeds',()=>{
 const coverage=new Set();
 for(const services of [[],['chronic'],['chronic','sampling','pharmacy']])for(const seed of [1,3,7,19,741,20260926]){
  let s=open(seed,services);const admitted=new Set(),departed=new Set();
  for(let minute=1;minute<=9*60;minute++){
   const before=new Set(s.patients.map(p=>p.id));
   const result=advanceTo(s,START+minute*MINUTE,1000);
   const context=`seed=${seed} services=${services} minute=${minute}`;
   assert.equal(result.caughtUp,true,`event loop cannot advance: ${context}`);
   for(const id of before)if(!s.patients.some(p=>p.id===id))departed.add(id);
   for(const p of s.patients){
    admitted.add(p.id);coverage.add(p.phase+':'+p.clinical.stage);
    assert.ok(s.time-p.arrivedAt<90*MINUTE,`stranded ${p.id} ${p.phase}/${p.clinical.stage}: ${context}`);
    assert.ok(p.due===null||p.due>=s.time,`overdue service: ${context}`);
   }
   for(const phase of ['registration','consultation','nursing','pharmacy'])assert.ok(s.patients.filter(p=>p.phase===phase).length<=1,`double-booked ${phase}: ${context}`);
   const urgent=s.patients.some(p=>p.phase==='urgent');
   if(!urgent&&!s.patients.some(p=>p.phase==='nursing'))assert.ok(!s.patients.some(p=>p.phase==='waiting'&&atDestination(p,s.time)&&['assessment','sample'].includes(p.clinical.stage)&&(p.clinical.readyAt??0)<=s.time),`idle nursing with ready patient: ${context}`);
   if(!urgent&&!s.patients.some(p=>p.phase==='consultation'||p.roomReleasedAt>s.time))assert.ok(!s.patients.some(p=>p.phase==='waiting'&&atDestination(p,s.time)&&['consult','review','followup'].includes(p.clinical.stage)),`idle doctor with ready patient: ${context}`);
   if(minute%17===0)s=restoreState(JSON.stringify(s));
  }
  assert.equal(s.patients.length,0,'after closing, every admitted patient leaves');
  assert.ok(admitted.size>5);assert.deepEqual(departed,admitted);assert.ok(s.metrics.completed>0);
 }
 for(const stage of ['registration:assessment','waiting:assessment','nursing:assessment','consultation:consult','nursing:sample','pharmacy:pharmacy','pharmacy:dispense','urgent:urgent','consultation:review'])assert.ok(coverage.has(stage),`missing pathway ${stage}`);
});

test('measurement rest has a visible reason and ends in assessment and doctor care without investor input',()=>{
 const s=open(20260926,['chronic','sampling','pharmacy']),id=s.venture.openingRequests[0].id;
 advanceTo(s,START+MINUTE);const p=s.patients.find(p=>p.id===id);assert.equal(p.clinical.type,'workup');
 assert.equal(p.phase,'waiting');assert.match(clinicalStatus(p,s.time),/静息.*还需 [1-5] 分钟/);assert.match(careNextStep(p,s.time),/护士.*医生/);
 const ready=p.clinical.readyAt;advanceTo(s,ready-1);assert.equal(p.phase,'waiting');
 advanceTo(s,ready);assert.equal(p.phase,'nursing');assert.doesNotMatch(clinicalStatus(p,s.time),/静息/);
 advanceTo(s,START+9*MINUTE);assert.equal(p.phase,'consultation');
 advanceTo(s,START+25*MINUTE);assert.ok(!s.patients.some(p=>p.id===id));assert.ok(s.medical.records.some(r=>r.id===id));
});

test('refresh during each opening care stage neither resets care nor duplicates billing',()=>{
 const uninterrupted=open(20260926,['chronic','sampling','pharmacy']);let refreshed=structuredClone(uninterrupted);
 for(let elapsed=5000;elapsed<=HOUR;elapsed+=5000){
  assert.equal(advanceTo(uninterrupted,START+elapsed,1000).caughtUp,true);
  assert.equal(advanceTo(refreshed,START+elapsed,1000).caughtUp,true);
  refreshed=restoreState(JSON.stringify(refreshed));assert.deepEqual(refreshed,uninterrupted);
 }
 assert.ok(uninterrupted.medical.stats.sampled>0);assert.ok(uninterrupted.medical.stats.dispensed>0);
});
