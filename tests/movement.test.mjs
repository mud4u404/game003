import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, advanceTo, restoreState, CASES, HOUR, phaseLabel } from '../src/simulation.js';
import { planRoute, isWalkable, seatFeet, ENTRY, DESK, ROOM_POS, NURSING_POS, registrationSlot,
  nursingSlot, movePatient, settledMotion, patientPose, WALK_SPEED, STAND_MS, SIT_MS } from '../src/movement.js';
const START=1_790_000_000_000;
test('every route between patient facilities clears walls, furniture and chair footprints',()=>{
  const anchors=[ENTRY,DESK,...Object.values(ROOM_POS),NURSING_POS,
    ...Array.from({length:16},(_,i)=>seatFeet(i)),...Array.from({length:4},(_,i)=>registrationSlot(i)),
    ...Array.from({length:4},(_,i)=>nursingSlot(i))];
  for(const a of anchors)for(const b of anchors){
    assert.ok(isWalkable(...a));const points=planRoute(a,b);
    assert.deepEqual(points[0],a);assert.deepEqual(points.at(-1),b);
    for(let k=1;k<points.length;k++){
      const [x,y]=points[k-1],dx=points[k][0]-x,dy=points[k][1]-y,n=Math.ceil(Math.hypot(dx,dy)*2);
      for(let i=0;i<=n;i++)assert.ok(isWalkable(x+dx*i/(n||1),y+dy*i/(n||1)),`Blocked route ${a} → ${b}`);
    }
  }
});
test('a phase change starts at the actual position, with standing and sitting completed before service',()=>{
  const p={phase:'waiting',motion:settledMotion(seatFeet(0),START,true)};
  movePatient(p,'consultation',START,ROOM_POS[1],95000);
  assert.deepEqual(patientPose(p,START).position,seatFeet(0));
  assert.equal(p.motion.start-START,STAND_MS);assert.equal(patientPose(p,START+300).moving,false);
  assert.equal(p.serviceAt-p.motion.end,SIT_MS);assert.equal(p.due-p.serviceAt,95000);
  assert.equal(phaseLabel(p,START),'起身中');
  const time=START+2400,pos=patientPose(p,time).position;
  movePatient(p,'leaving',time,ENTRY,0);
  assert.deepEqual(patientPose(p,time).position,pos);
});
test('complete care journey has continuous transitions, constant walking speed and correctly timed work',()=>{
  const s=createState(START);s.patients[0].kind='care';const id=s.patients[0].id;const phases=new Set();let last;
  for(let at=START;at<START+12*60000;at+=100){
    advanceTo(s,at);const p=s.patients.find(p=>p.id===id);if(!p)break;
    phases.add(p.phase);const pose=patientPose(p,at);assert.ok(isWalkable(...pose.position));
    if(last) assert.ok(Math.hypot(pose.position[0]-last[0],pose.position[1]-last[1])<=WALK_SPEED*.1+.001,'No teleport at any phase boundary');
    last=pose.position;
    if(['registration','consultation','nursing'].includes(p.phase)){
      const duration=p.phase==='registration'?14000:p.phase==='nursing'?42000:CASES.find(c=>c.id===p.kind).consultation;
      assert.equal(p.due-p.serviceAt,duration);
      if(at>=p.serviceAt)assert.ok(pose.arrived);
    }
    if(p.phase==='nursing'&&pose.arrived){assert.deepEqual(pose.position,NURSING_POS);assert.equal(pose.sit,1);}
  }
  for(const phase of ['arriving','registration','consultation','nursingQueue','nursing','leaving'])assert.ok(phases.has(phase),phase);
  assert.ok(s.history.some(p=>p.id===id));
});
test('rooms are not reassigned until the outgoing patient has cleared the doorway',()=>{
  const s=createState(START);
  for(let at=START;at<START+HOUR;at+=500){
    advanceTo(s,at);
    for(const p of s.patients.filter(p=>p.roomReleasedAt>at))
      assert.equal(s.patients.some(q=>q.id!==p.id&&q.phase==='consultation'&&q.room===p.room),false);
  }
});
test('legacy saves migrate without resetting money, progress or remaining clinical service',()=>{
  const s=createState(START);advanceTo(s,START+72000);s.version=1;
  for(const p of s.patients){delete p.motion;delete p.serviceAt;delete p.motionDue;delete p.roomReleasedAt;delete p.queueSlot;}
  const restored=restoreState(JSON.stringify(s));assert.equal(restored.version,2);
  assert.equal(restored.cash,s.cash);assert.deepEqual(restored.metrics,s.metrics);
  assert.deepEqual(restored.patients.map(p=>p.due),s.patients.map(p=>p.due));
  advanceTo(restored,START+HOUR);assert.ok(restored.metrics.completed>s.metrics.completed);
});
test('malformed motion cannot reintroduce past events or non-finite paths',()=>{
  for(const mutate of [p=>p.motionDue=START-1,p=>p.motion.points[0][0]=null,p=>p.motion.end=p.motion.start-1]){
    const s=createState(START);mutate(s.patients[0]);assert.throws(()=>restoreState(JSON.stringify(s)));
  }
});

test('an available doctor calls directly from reception instead of making the patient sit and immediately stand',()=>{
  const s=createState(START);s.patients=[s.patients[0]];
  for(let t=START;t<START+60000;t+=100){advanceTo(s,t);const p=s.patients[0];if(p.phase==='consultation'){
    assert.deepEqual(p.motion.points[0],DESK);assert.equal(p.motion.fromSeated,false);return;
  }}
  assert.fail('Patient never reached consultation');
});

test('two-hour mixed patient traffic stays clear of furniture, including mid-walk calls',()=>{
  const s=createState(START);let previous=new Map();
  for(let t=START;t<START+2*HOUR;t+=500){advanceTo(s,t);const next=new Map();
    for(const p of s.patients){const pos=patientPose(p,t).position;assert.ok(isWalkable(...pos),p.id+' '+p.phase);
      if(previous.has(p.id)){const old=previous.get(p.id);assert.ok(Math.hypot(pos[0]-old[0],pos[1]-old[1])<=WALK_SPEED*.5+.001,p.id+' teleport');}
      next.set(p.id,pos);
    }previous=next;
  }
});
