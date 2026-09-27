import { clinicalStatus } from './medical.js';
// Presentation reads factual assignments and time; it never spawns demand or awards progress.
export function staffActivity(s, id) {
  if(id==='pharmacist'){
    const p=s.patients.find(p=>p.phase==='pharmacy');
    return p?{mode:s.time<p.serviceAt?'calling':'working',label:s.time<p.serviceAt?'等候患者到取药台':p.clinical.stage==='dispense'?'核对发药与用药说明':'审核续配处方',frame:p.clinical.stage==='dispense'?2:Math.floor((s.time-p.serviceAt)/900)%2,patientId:p.id}:{mode:'preparing',label:'核对库存与处方记录',frame:0};
  }
  if(id==='doctor1'&&s.patients.some(p=>p.phase==='urgent'))return {mode:'working',label:'协调急救接续',frame:2};
  const phase=id==='nurse2'?'sampling':id==='reception'?'registration':id==='nurse'?'nursing':'consultation';
  const p=(id==='nurse'?s.patients.find(p=>p.phase==='urgent'):null)||s.patients.find(p=>p.phase===phase && (!id.startsWith('doctor') || p.room===(id==='doctor1'?1:2)));
  if(id==='director') return {mode:'review',label:s.project?'跟进诊室筹备':'查看运营记录',frame:0};
  if(p?.pausedForUrgent)return {mode:'available',label:'等候急救协作结束',frame:0};
  if(p) {
    if(s.time<p.serviceAt) return {mode:'calling',label:id==='nurse'?'准备护理位':'等候患者就位',frame:2,patientId:p.id};
    const elapsed=s.time-p.serviceAt,cycle=elapsed%14000;
    if(id.startsWith('nurse')) return {mode:'care',label:p.clinical?clinicalStatus(p,s.time):'护理中',patientId:p.id,clinicalRow:p.clinical&&p.phase!=='urgent'?(p.clinical.stage==='sample'?1:0):null,frame:Math.floor(elapsed/1700)%3};
    if(id==='reception') return {mode:'working',label:cycle<9000?'核对登记资料':'说明就诊安排',frame:cycle<9000?Math.floor(elapsed/850)%2:2,patientId:p.id};
    const recording=cycle>=5500&&cycle<11000;
    return {mode:'working',label:p.clinical?.stage==='review'?'复核检查结果':p.clinical?.stage==='followup'?'随访复评':recording?'记录病情':'问诊交流',frame:recording?Math.floor(elapsed/900)%2:2,patientId:p.id};
  }
  if(id==='nurse2')return {mode:'available',label:s.sampleTask?.phase==='returning'?'返回采样岗位':'采样待命'};
  if(id==='nurse') {
    const phase=s.nurseTask?.phase;
    return {mode:phase==='preparing'?'preparing':'available',label:{supplyWalk:'前往备物',preparing:'整理护理物品',returning:'返回护理岗位'}[phase]||'护理待命'};
  }
  const cycle=(s.time-s.startedAt+(id==='doctor2'?6000:0))%24000;
  return {mode:cycle<6000?'preparing':'available',label:cycle<6000?(id==='reception'?'整理登记资料':id==='nurse'?'检查护理物品':'整理接诊记录'):(id==='reception'?'等候来访':id==='nurse'?'护理待命':'等候叫号'),frame:Math.floor(cycle/1200)%2};
}
export function patientIntent(p,time) {
  if(p.clinical){const label=clinicalStatus(p,time);return time<p.motion?.ready&&p.phase!=='leaving'?'前往 · '+label:label;}
  const traveling=p.motion&&time<p.motion.ready;
  return { arriving:'到前台登记',registerQueue:'排队登记',registration:traveling?'到前台登记':'登记中',
    waiting:traveling?'前往候诊席':'等候叫号',consultation:traveling?`前往 0${p.room} 诊室`:'问诊中',
    nursingQueue:'等候护理',nursing:traveling?'前往护理位':'护理中',leaving:'接诊结束 · 离院' }[p.phase] || '';
}
export function destinationLabel(p) {
  if(p.phase==='pharmacy')return '药房';
  if(p.clinical?.stage==='pharmacy'&&p.phase==='waiting')return '候药';
  if(p.phase==='urgent')return '急救接续';
  if(p.phase==='sampling')return '采样单元';
  if(p.clinical&&p.phase==='nursing')return p.clinical.stage==='sample'?'采样':'评估';
  return {arriving:'登记',registerQueue:'登记',registration:'登记',waiting:'候诊',consultation:`0${p.room} 诊室`,nursingQueue:'护理',nursing:'护理',leaving:'离院'}[p.phase] || '';
}
