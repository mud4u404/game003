import { STAFF_POS, NURSE_CARE_POS, planRoute, routeLength, sampleMotion, settledMotion, WALK_SPEED } from './movement.js';
const SUPPLIES=[245,610];
export function createNurseTask(at) { return {phase:'available',patientId:null,motion:settledMotion(STAFF_POS.nurse,at),due:at+12000}; }
function travel(task,phase,target,at,patientId=null) {
  const from=sampleMotion(task.motion,at).position,points=planRoute(from,target),length=routeLength(points),end=at+Math.ceil(length/WALK_SPEED*1000);
  Object.assign(task,{phase,patientId,motion:{points,length,at,start:at,end,ready:end,fromSeated:false,toSeated:false},due:end});
}
export function advanceNurseTask(s) {
  const task=s.nurseTask;
  if(task.due!==s.time)return;
  if(task.phase==='available')travel(task,'supplyWalk',SUPPLIES,s.time);
  else if(task.phase==='supplyWalk'){task.phase='preparing';task.due=s.time+5000;}
  else if(task.phase==='preparing')travel(task,'returning',STAFF_POS.nurse,s.time);
  else if(task.phase==='returning'){task.phase='available';task.due=s.time+90000;}
  else if(task.phase==='approach'){task.phase='care';task.due=null;}
}
export function syncNurseTask(s) {
  const task=s.nurseTask,p=s.patients.find(p=>p.phase==='nursing');
  if(p && task.patientId!==p.id) travel(task,'approach',NURSE_CARE_POS,s.time,p.id);
  else if(!p && ['care','approach'].includes(task.phase))travel(task,'returning',STAFF_POS.nurse,s.time);
}
export function nursePose(s) { return sampleMotion(s.nurseTask.motion,s.time); }
