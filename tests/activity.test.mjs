import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, advanceTo, restoreState, HOUR } from '../src/simulation.js';
import { staffActivity, patientIntent } from '../src/activity.js';
import { actorSeat, FIXED_SEATS } from '../src/seating.js';
import { nursePose, syncNurseTask } from '../src/staff-behavior.js';
import { registrationSlot, isWalkable, WALK_SPEED } from '../src/movement.js';
const START=1790000000000;
test('front desk and every seated phase resolve a physical chair, including standing transitions',()=>{
  assert.deepEqual(actorSeat({id:'reception'}),FIXED_SEATS.reception);
  for(const phase of ['waiting','consultation','nursing']) {
    assert.ok(actorSeat({phase,seat:0,room:1}));
    assert.ok(actorSeat({phase:'leaving',previousPhase:phase,seat:0,room:1},true));
  }
  assert.equal(actorSeat({phase:'registration',seat:null}),null);
});
test('work gestures follow arrival and service rather than running on an unrelated visual clock',()=>{
  const s=createState(START),p=s.patients[0];Object.assign(p,{phase:'consultation',room:1,serviceAt:START+10000});
  s.time=START+9000;assert.equal(staffActivity(s,'doctor1').mode,'calling');
  s.time=START+11000;assert.equal(staffActivity(s,'doctor1').label,'问诊交流');
  s.time=START+17000;const before=structuredClone(s);assert.equal(staffActivity(s,'doctor1').label,'记录病情');
  assert.deepEqual(s,before);
  assert.match(patientIntent({...p,phase:'waiting'},s.time),/候诊|叫号/);
});
test('reception queue remains indoors and advances without overtaking',()=>{
  for(let i=0;i<4;i++){const p=registrationSlot(i);assert.ok(isWalkable(...p));assert.ok(p[1]<900);}
  const s=createState(START),served=[];
  for(let t=START;t<START+180000;t+=100){advanceTo(s,t);const p=s.patients.find(p=>p.phase==='registration');if(p&&!served.includes(p.id))served.push(p.id);}
  assert.deepEqual(served.slice(0,4),['patient-1','patient-2','patient-3','patient-4']);
});
test('nurse preparation, patient care and return trips remain continuous and avoid furniture',()=>{
  const s=createState(START);s.patients[0].kind='care';let previous;const phases=new Set();
  for(let t=START;t<START+2*HOUR;t+=100){advanceTo(s,t);const pose=nursePose(s);phases.add(s.nurseTask.phase);
    assert.ok(isWalkable(...pose.position),s.nurseTask.phase);
    if(previous)assert.ok(Math.hypot(pose.position[0]-previous[0],pose.position[1]-previous[1])<=WALK_SPEED*.1+.001,'Nurse teleported');
    previous=pose.position;
  }
  for(const p of ['available','supplyWalk','preparing','approach','care','returning'])assert.ok(phases.has(p),p);
});
test('a nursing assignment interrupts chores from the current position and survives reload',()=>{
  const s=createState(START);advanceTo(s,START+12500);const before=nursePose(s).position;
  s.patients[0].phase='nursing';syncNurseTask(s);assert.deepEqual(nursePose(s).position,before);
  assert.equal(s.nurseTask.phase,'approach');
  const clean=createState(START);advanceTo(clean,START+15000);assert.deepEqual(restoreState(JSON.stringify(clean)).nurseTask,clean.nurseTask);
  delete clean.nurseTask;const restored=restoreState(JSON.stringify(clean));assert.equal(restored.cash,clean.cash);assert.ok(restored.nurseTask);
});
