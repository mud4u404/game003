import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, advanceTo, restoreState, applyManagementAction, setAuthority, managerObservation, MINUTE, HOUR, PROJECT } from '../src/simulation.js';
const START = 1_790_000_000_000;
test('offline catch-up and many online updates produce identical histories and finances',()=>{
  const offline=createState(START),online=createState(START);
  advanceTo(offline,START+8*HOUR);
  for(let t=START+17000;t<START+8*HOUR;t+=17000)advanceTo(online,t);
  advanceTo(online,START+8*HOUR);
  assert.deepEqual(online,offline);
  assert.ok(offline.metrics.completed>100);assert.ok(offline.secondRoom);
});
test('enabling a new room cannot alter the underlying patient demand',()=>{
  const a=createState(START),b=createState(START);setAuthority(a,false);setAuthority(b,false);
  applyManagementAction(b,{action:'openSecondRoom'},'investor');
  advanceTo(a,START+3*HOUR);advanceTo(b,START+3*HOUR);
  assert.deepEqual(a.demandTrace,b.demandTrace);assert.equal(a.metrics.demand,b.metrics.demand);
  assert.ok(b.metrics.completed>a.metrics.completed);
});
test('management respects investment authority and is idempotent',()=>{
  const s=createState(START);setAuthority(s,false);
  assert.equal(applyManagementAction(s,{action:'openSecondRoom'}).ok,false);
  assert.equal(applyManagementAction(s,{action:'inventProcedure'},'investor').ok,false);
  const initial=s.cash;
  assert.equal(applyManagementAction(s,{action:'openSecondRoom'},'investor').ok,true);
  assert.equal(applyManagementAction(s,{action:'openSecondRoom'},'investor').ok,false);
  assert.equal(s.cash,initial-PROJECT.cost);
  advanceTo(s,START+PROJECT.duration);assert.ok(s.secondRoom);assert.equal(s.project,null);
});
test('investment cannot consume the protected operating reserve',()=>{
  const s=createState(START);s.cash=PROJECT.cost+PROJECT.reserve-1;
  assert.equal(applyManagementAction(s,{action:'openSecondRoom'},'investor').ok,false);assert.equal(s.project,null);
});
test('no intervention still creates continuous care and an autonomous expansion',()=>{
  const s=createState(START);advanceTo(s,START+2*HOUR);
  assert.ok(s.secondRoom);assert.equal(s.metrics.investment,PROJECT.cost);assert.ok(s.metrics.referred>0);assert.ok(s.metrics.completed>0);
});
test('restricted authority keeps routine care working without expansion',()=>{
  const s=createState(START);setAuthority(s,false);advanceTo(s,START+2*HOUR);
  assert.equal(s.secondRoom,false);assert.equal(s.project,null);assert.ok(s.metrics.completed>0);
});
test('a repeated or backwards timestamp cannot grant more progress',()=>{
  const s=createState(START);advanceTo(s,START+HOUR);const before=structuredClone(s);
  advanceTo(s,START);advanceTo(s,START+HOUR);assert.deepEqual(s,before);
});
test('event batching is bounded and resumes without changing results',()=>{
  const a=createState(START),b=createState(START),target=START+24*HOUR;
  let batches=0;while(!advanceTo(a,target,100).caughtUp)batches++;
  advanceTo(b,target);assert.ok(batches>1);assert.deepEqual(a,b);
});
test('patient accounting, capacity and staff exclusivity remain consistent',()=>{
  const s=createState(START);setAuthority(s,false);
  for(let t=START;t<=START+8*HOUR;t+=30000){
    advanceTo(s,t);
    const active=s.patients.filter(p=>p.phase!=='leaving');
    assert.equal(s.metrics.demand,s.metrics.completed+s.metrics.referred+s.metrics.capacityRedirected+active.length);
    assert.ok(active.length<=16);
    for(const phase of ['registration','nursing'])assert.ok(s.patients.filter(p=>p.phase===phase).length<=1);
    for(const room of [1,2])assert.ok(s.patients.filter(p=>p.phase==='consultation'&&p.room===room).length<=1);
    assert.equal(s.cash,180000+s.metrics.revenue-s.metrics.operating-s.metrics.investment);
  }
});
test('save round-trip preserves future results and rejects corrupted schedules',()=>{
  const a=createState(START);advanceTo(a,START+17*MINUTE);const b=restoreState(JSON.stringify(a));
  advanceTo(a,START+4*HOUR);advanceTo(b,START+4*HOUR);assert.deepEqual(a,b);
  assert.throws(()=>restoreState('{}'));assert.throws(()=>restoreState('broken'));
  b.nextArrival=b.time-1;assert.throws(()=>restoreState(JSON.stringify(b)));
});
test('observations cannot mutate project state',()=>{
  const s=createState(START);applyManagementAction(s,{action:'openSecondRoom'},'investor');
  const o=managerObservation(s);o.project.completesAt=0;assert.notEqual(s.project.completesAt,0);
  assert.throws(()=>{o.cash=0;});
});

test('malformed counters and non-progressing patient schedules are rejected',()=>{
  const s=createState(START);delete s.metrics.revenue;
  assert.throws(()=>restoreState(JSON.stringify(s)));
  const t=createState(START);t.patients[0].phase='waiting';t.patients[0].waitStarted=START;
  assert.throws(()=>restoreState(JSON.stringify(t)));
});
