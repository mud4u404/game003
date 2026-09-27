import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,advanceTo,restoreState,applyManagementAction,HOUR,MINUTE} from '../src/simulation.js';
import {newClinicalCase,DAY,ANNEX} from '../src/medical.js';
import {patientPose,planRoute,isWalkable,ENTRY,SAMPLE_POS,NURSING_POS,WALK_SPEED} from '../src/movement.js';
import {nursePose} from '../src/staff-behavior.js';
const START=1790000000000;
function scenario(types){const s=createState(START);s.patients=s.patients.slice(0,types.length);s.nextArrival=START+365*DAY;s.nextReview=START+365*DAY;s.authority=false;
  s.patients.forEach((p,i)=>{p.clinical=newClinicalCase(p,types[i]);p.clinical.variation={abnormalReport:false,persistent:false};});return s;}
function run(s,at){while(!advanceTo(s,at,20000).caughtUp){}return s;}

test('ordinary respiratory care has no automatic laboratory or prescription and later receives a follow-up',()=>{
  const s=scenario(['respiratory']);run(s,START+HOUR);assert.equal(s.medical.stats.assessed,1);assert.equal(s.medical.stats.sampled,0);assert.equal(s.medical.stats.prescribed,0);assert.equal(s.medical.stats.improved,0);
  assert.match(s.medical.records[0].clinical.plan[0],/不常规开抗菌药/);run(s,START+8*DAY);assert.equal(s.medical.stats.improved,1);assert.equal(s.medical.pending.length,0);
});
test('first elevated pressure is not diagnosed or medicated from one encounter',()=>{
  const s=scenario(['screening']);run(s,START+HOUR);assert.equal(s.medical.stats.prescribed,0);assert.match(s.medical.records[0].clinical.diagnosis,/尚未确诊/);
  run(s,START+8*DAY);assert.ok(s.medical.records[0].clinical.visit>0);assert.equal(s.medical.stats.prescribed,0);assert.match(s.medical.records[0].clinical.outcome,/进一步确认/);
});
test('sampling, report arrival and doctor review are ordered; an abnormal result changes disposition',()=>{
  for(const abnormal of [false,true]){
    const s=scenario(['workup']);s.patients[0].clinical.variation.abnormalReport=abnormal;
    run(s,START+HOUR);assert.equal(s.medical.stats.sampled,1);assert.equal(s.medical.stats.reviewed,0);assert.equal(s.medical.stats.prescribed,0);
    const report=s.medical.pending.find(e=>e.kind==='report');assert.equal(report.clinical.report.status,'已送检');assert.equal(report.clinical.report.abnormal,undefined);
    run(s,START+6*HOUR);assert.equal(s.medical.stats.reported,1);assert.equal(s.medical.stats.reviewed,1);
    assert.equal(s.medical.stats.prescribed,abnormal?0:1);assert.equal(s.metrics.referred,abnormal?1:0);
    if(!abnormal){assert.equal(s.medical.stats.dispensed,1);assert.match(s.medical.records[0].clinical.prescription.status,/已核对发药/);}
  }
});
test('urgent transfer bypasses registration and pauses then resumes ordinary clinical resources',()=>{
  const s=scenario(['pressure']);run(s,START+7*MINUTE);
  assert.equal(s.patients[0].phase,'nursing');
  const urgent=createState(s.time,123).patients[1];urgent.id='urgent-test';urgent.clinical=newClinicalCase(urgent,'urgent');s.patients.push(urgent);
  let paused=false;
  for(let t=s.time;t<START+20*MINUTE;t+=500){advanceTo(s,t);paused ||= s.patients.some(p=>p.pausedForUrgent);assert.ok(s.patients.filter(p=>p.phase==='urgent').length<=1);restoreState(JSON.stringify(s));}
  assert.ok(paused);assert.equal(s.medical.stats.urgent,1);assert.equal(s.metrics.referred,1);assert.equal(s.medical.stats.prescribed,1);assert.equal(s.medical.stats.improved,0);
});
test('medical progression and independent demand are invariant across frame sizes and investment',()=>{
  const a=createState(START),b=createState(START);run(a,START+2*DAY);
  for(let t=START+17000;t<START+2*DAY;t+=17000)advanceTo(b,t);run(b,START+2*DAY);assert.deepEqual(a,b);
  const c=createState(START);applyManagementAction(c,{action:'buildAnnex'},'investor');applyManagementAction(c,{action:'priorityLab'},'investor');run(c,START+2*DAY);
  assert.deepEqual(c.demandTrace,a.demandTrace);assert.equal(c.metrics.demand,a.metrics.demand);assert.ok(c.medical.annex);
  const restored=restoreState(JSON.stringify(c));run(c,START+3*DAY);run(restored,START+3*DAY);assert.deepEqual(restored,c);
});
test('annex changes physical routes, adds a nurse, charges ongoing cost and preserves clinical timing',()=>{
  assert.equal(isWalkable(...SAMPLE_POS,0,false),false);
  for(const start of [ENTRY,NURSING_POS]){
    const path=planRoute(start,SAMPLE_POS,true);assert.deepEqual(path.at(-1),SAMPLE_POS);
    for(let k=1;k<path.length;k++){const a=path[k-1],b=path[k],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));for(let i=0;i<=n;i++)assert.ok(isWalkable(a[0]+(b[0]-a[0])*i/(n||1),a[1]+(b[1]-a[1])*i/(n||1),0,true));}
  }
  const s=createState(START);assert.ok(applyManagementAction(s,{action:'buildAnnex'},'investor').ok);assert.equal(applyManagementAction(s,{action:'buildAnnex'},'investor').ok,false);
  let seen=false,previous=new Map();
  for(let at=START;at<START+3*HOUR;at+=500){advanceTo(s,at);const now=new Map();
    for(const p of s.patients){const pose=patientPose(p,at);assert.ok(isWalkable(...pose.position,0,s.medical.annex));if(previous.has(p.id))assert.ok(Math.hypot(pose.position[0]-previous.get(p.id)[0],pose.position[1]-previous.get(p.id)[1])<=WALK_SPEED*.5+.01);now.set(p.id,pose.position);
      if(p.phase==='sampling'){seen=true;assert.ok(s.sampleTask);assert.ok(p.serviceAt>=s.sampleTask.motion.ready);}}
    if(s.medical.annex)assert.ok(isWalkable(...nursePose(s,'nurse2').position,0,true));previous=now;
  }
  assert.ok(seen);assert.ok(s.medical.costs.staffSpace>0);assert.equal(s.cash,180000+s.metrics.revenue-s.metrics.operating-s.metrics.investment);
  const poor=scenario([]);poor.cash=ANNEX.cost+ANNEX.reserve-1;assert.equal(applyManagementAction(poor,{action:'buildAnnex'},'investor').ok,false);
});
test('old saved progress gains future medical capability without rewriting existing encounters',()=>{
  const s=createState(START,123,{medical:false});run(s,START+5*MINUTE);delete s.medical;
  const r=restoreState(JSON.stringify(s));assert.equal(r.cash,s.cash);assert.deepEqual(r.patients,s.patients);assert.deepEqual(r.metrics,s.metrics);assert.ok(r.medical);run(r,START+HOUR);assert.ok(r.medical.stats.assessed>0);
  r.medical.pending.push({kind:'report',due:r.time-1});assert.throws(()=>restoreState(JSON.stringify(r)));
});
test('external contract only affects future orders, never re-rolls findings or issued schedules',()=>{
  const s=scenario(['workup']);run(s,START+HOUR);const report=structuredClone(s.medical.pending.find(e=>e.kind==='report'));
  applyManagementAction(s,{action:'priorityLab'},'investor');assert.deepEqual(s.medical.pending.find(e=>e.kind==='report'),report);
});

test('report delivery remains on time even when all visit slots are occupied',()=>{
  const s=scenario(['workup']);run(s,START+HOUR);const event=s.medical.pending.find(e=>e.kind==='report');const due=event.due;
  const filler=createState(s.time,123,{medical:false}).patients[0];s.patients=Array.from({length:16},(_,i)=>({...structuredClone(filler),id:'filler-'+i,phase:'waiting',waitStarted:s.time,due:null,motionDue:null,seat:i,room:null}));
  // Reserve both doctors throughout this test so capacity remains unavailable.
  for(let i=0;i<2;i++){s.patients[i].phase='consultation';s.patients[i].room=i+1;s.patients[i].due=due+HOUR;}s.secondRoom=true;
  run(s,due);assert.equal(s.medical.stats.reported,1);const returned=s.medical.pending.find(e=>e.kind==='return');assert.ok(returned);assert.equal(returned.clinical.report.receivedAt,due);assert.equal(returned.due,due+30*MINUTE);
});
test('medical records reject malformed visible data instead of crashing the renderer',()=>{
  const s=scenario(['respiratory']);run(s,START+HOUR);s.medical.records[0].clinical.findings.push(null);assert.throws(()=>restoreState(JSON.stringify(s)));
});

test('management does not mistake resting or waiting for assessment for a shortage of doctors',()=>{
  const s=createState(START);s.authority=true;s.patients.forEach(p=>{p.clinical=newClinicalCase(p,'pressure');});s.nextArrival=START+HOUR;
  run(s,START+6*MINUTE);assert.equal(s.project,null);assert.equal(s.pressureChecks,0);
});
