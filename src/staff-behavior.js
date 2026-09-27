import { STAFF_POS, NURSE_CARE_POS, SAMPLE_STAFF_POS, ANNEX_HOME, URGENT_STAFF_POS, planRoute, routeLength, sampleMotion, settledMotion, WALK_SPEED } from './movement.js';
const SUPPLIES=[245,610];
export function createNurseTask(at) { return {phase:'available',patientId:null,motion:settledMotion(STAFF_POS.nurse,at),due:at+12000}; }
export function travel(task,phase,target,at,patientId=null,annex=false) {
  const from=sampleMotion(task.motion,at).position,points=planRoute(from,target,annex),length=routeLength(points),end=at+Math.ceil(length/WALK_SPEED*1000);
  Object.assign(task,{phase,patientId,motion:{points,length,at,start:at,end,ready:end,fromSeated:false,toSeated:false},due:end});
}
export function advanceNurseTask(s) {
  if(s.sampleTask?.due===s.time){s.sampleTask.phase='care';s.sampleTask.due=null;}
  const task=s.nurseTask;
  if(task.due!==s.time)return;
  if(task.phase==='available')travel(task,'supplyWalk',SUPPLIES,s.time);
  else if(task.phase==='supplyWalk'){task.phase='preparing';task.due=s.time+5000;}
  else if(task.phase==='preparing')travel(task,'returning',STAFF_POS.nurse,s.time);
  else if(task.phase==='returning'){task.phase='available';task.due=s.time+90000;}
  else if(task.phase==='approach'){task.phase='care';task.due=null;}
}
export function syncNurseTask(s) {
  const task=s.nurseTask,p=s.patients.find(p=>p.phase==='urgent')||s.patients.find(p=>p.phase==='nursing');
  if(p && task.patientId!==p.id) travel(task,'approach',p.phase==='urgent'?[URGENT_STAFF_POS[0]-(p.urgentSlot||0)*60,URGENT_STAFF_POS[1]]:NURSE_CARE_POS,s.time,p.id);
  else if(!p && ['care','approach'].includes(task.phase))travel(task,'returning',STAFF_POS.nurse,s.time);
  if(s.medical?.annex){
    s.sampleTask??={phase:'available',patientId:null,motion:settledMotion(ANNEX_HOME,s.time),due:null};
    const sample=s.patients.find(p=>p.phase==='sampling'),t=s.sampleTask;
    if(sample&&t.patientId!==sample.id)travel(t,'approach',SAMPLE_STAFF_POS,s.time,sample.id,true);
    else if(!sample&&t.patientId!==null)travel(t,'returning',ANNEX_HOME,s.time,null,true);
  }
}
export function nursePose(s,id='nurse') { return sampleMotion(id==='nurse2'?s.sampleTask?.motion||settledMotion(ANNEX_HOME,s.time):s.nurseTask.motion,s.time); }
