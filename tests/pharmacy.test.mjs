import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,advanceTo,restoreState,applyManagementAction,MINUTE,HOUR} from '../src/simulation.js';
import {newClinicalCase,PHARMACY,DAY} from '../src/medical.js';
import {patientAppearance} from '../src/appearance.js';
import {patientSex,GIVEN_PROFILES} from '../src/identity.js';
import {patientPose,PHARMACY_POS,isWalkable,WALK_SPEED} from '../src/movement.js';
import {staffActivity} from '../src/activity.js';
const START=1790000000000;
function single(enabled=true){const s=createState(START);s.patients=[s.patients[0]];s.patients[0].clinical=newClinicalCase(s.patients[0],'pressure');s.nextArrival=START+40*DAY;s.nextReview=START+40*DAY;s.authority=false;s.medical.pharmacy.enabled=enabled;s.medical.pharmacy.stock=enabled?24:0;return s;}
function run(s,at){while(!advanceTo(s,at).caughtUp){}return s;}
test('fictional names and sprites share sex and age; identity survives repeat-visit IDs and saves',()=>{
  for(let seed=0;seed<150;seed++)for(const p of createState(START,seed).patients){
    assert.equal(p.sex,GIVEN_PROFILES.find(([given])=>p.name.endsWith(given))[1]);
    const look=patientAppearance(p),sex=patientSex(p);
    assert.ok((sex==='female'?[6,7,10]:[5,8,9,11]).includes(look.index));
    if(p.age>=60)assert.ok([5,6].includes(look.index));
    assert.deepEqual(patientAppearance({...p,id:p.id+'-v2'}),look);
    const legacy={...p};delete legacy.sex;assert.deepEqual(patientAppearance(legacy),look);
  }
});
test('a pharmacy requires explicit capital and preparation; no staff cost or free stock before opening',()=>{
  const s=single(false);s.patients=[];assert.equal(s.medical.pharmacy.stock,0);
  assert.equal(applyManagementAction(s,{action:'openPharmacy'},'investor').ok,true);
  assert.equal(s.cash,180000-PHARMACY.cost);assert.equal(applyManagementAction(s,{action:'openPharmacy'},'investor').ok,false);
  run(s,START+29*MINUTE);assert.equal(s.medical.pharmacy.enabled,false);assert.equal(s.medical.pharmacy.operating,0);
  run(s,START+31*MINUTE);assert.equal(s.medical.pharmacy.enabled,true);assert.equal(s.medical.pharmacy.stock,24);assert.ok(s.medical.pharmacy.operating>0);
  const poor=single(false);poor.cash=PHARMACY.cost+PHARMACY.reserve-1;assert.equal(applyManagementAction(poor,{action:'openPharmacy'},'investor').ok,false);
});
test('patient walks to the actual counter, waits for review then dispensing, and reload preserves work',()=>{
  const s=single();const seen=new Set();let prior;
  for(let at=START;at<START+25*MINUTE;at+=500){advanceTo(s,at);const p=s.patients[0];
    if(p){const pose=patientPose(p,at);assert.ok(isWalkable(...pose.position));if(prior)assert.ok(Math.hypot(pose.position[0]-prior[0],pose.position[1]-prior[1])<=WALK_SPEED*.5+.01);prior=pose.position;
      if(p.phase==='pharmacy'){seen.add(p.clinical.stage);assert.deepEqual(p.motion.points.at(-1),PHARMACY_POS);assert.equal(s.medical.stats.dispensed,0);assert.equal(staffActivity(s,'pharmacist').patientId,p.id);assert.equal(s.patients.filter(q=>q.phase==='pharmacy').length,1);}}
    assert.deepEqual(restoreState(JSON.stringify(s)),s);
  }
  assert.deepEqual([...seen],['pharmacy','dispense']);assert.equal(s.medical.stats.dispensed,1);assert.equal(s.medical.pharmacy.stock,23);assert.equal(s.metrics.completed,1);
  assert.match(s.medical.records[0].clinical.prescription.status,/院内药房已核对发药/);
  assert.equal(s.medical.pending.some(e=>e.kind==='dispense'),false);assert.equal(s.cash,180000+s.metrics.revenue-s.metrics.operating-s.metrics.investment);
});
test('stock-out produces external handoff and paid delayed replenishment, not invisible immediate dispensing',()=>{
  const s=single();s.medical.pharmacy.stock=0;run(s,START+30*MINUTE);
  assert.equal(s.medical.stats.dispensed,0);assert.equal(s.medical.pharmacy.external,1);assert.ok(s.medical.pharmacy.order);assert.equal(s.medical.pharmacy.procurement,480);
  run(s,START+2*HOUR);assert.equal(s.medical.stats.dispensed,1);assert.equal(s.medical.pharmacy.dispensed,0);assert.equal(s.medical.pharmacy.stock,0);
  run(s,START+5*HOUR);assert.equal(s.medical.pharmacy.stock,24);assert.equal(s.medical.pharmacy.order,null);
});
test('optional pharmacy preserves demand, segmented offline equivalence and old external orders',()=>{
  const a=createState(START),b=createState(START),c=createState(START);for(const s of [a,b])applyManagementAction(s,{action:'openPharmacy'},'investor');
  run(a,START+DAY);for(let at=START+19000;at<START+DAY;at+=19000)advanceTo(b,at);run(b,START+DAY);run(c,START+DAY);assert.deepEqual(a,b);assert.deepEqual(a.demandTrace,c.demandTrace);
  const old=single(false);run(old,START+30*MINUTE);const pending=structuredClone(old.medical.pending);delete old.medical.pharmacy;
  const restored=restoreState(JSON.stringify(old));assert.equal(restored.cash,old.cash);assert.equal(restored.medical.pharmacy.enabled,false);assert.deepEqual(restored.medical.pending,pending);
  const malformed=structuredClone(a);malformed.medical.pharmacy.stock=-1;assert.throws(()=>restoreState(JSON.stringify(malformed)));
});
