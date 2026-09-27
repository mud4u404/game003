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
// Explain the current dependency, without inventing a finish time for a queue.
export function careNextStep(p,time) {
  const c=p.clinical;if(!c)return '';
  if(p.pausedForUrgent)return '团队正在优先处理急症，结束后自动继续本次服务。';
  if(['arriving','registerQueue','registration'].includes(p.phase))return c.priority===0?'急症优先交接，不等待常规登记。':'接待登记后，由护士评估，再安排医生接诊。';
  if(p.phase==='waiting'&&c.stage==='assessment')return c.readyAt>time?'正在完成测压前静息，结束后由护士叫号测量，再进入医生接诊。':'等待护理位；护士完成当前工作后自动叫号。';
  if(['nursing','sampling'].includes(p.phase))return c.stage==='assessment'?'护士评估完成后进入医生候诊队列。':'完成采样与交接后离院，报告返回后安排医生复核。';
  if(p.phase==='waiting')return {consult:'等待诊室空出，按紧急程度和候诊顺序自动叫号。',review:'等待医生复核检查资料。',followup:'等待医生完成随访复评。',sample:'等待采样位，护理团队按顺序叫号。',pharmacy:'等待药师核对处方；未开药房或缺货时安排合作药房接续。'}[c.stage]||'';
  if(p.phase==='consultation')return '医生正在接诊，结束后按本次方案安排检查、药事接续或离院随访。';
  if(p.phase==='pharmacy')return '药师审核、核对发药并说明用药后离院。';
  if(p.phase==='urgent')return '团队联系急救接收方并照护，完成交接后继续跟踪回传。';
  return '';
}
export function destinationLabel(p) {
  if(p.phase==='pharmacy')return '药房';
  if(p.clinical?.stage==='pharmacy'&&p.phase==='waiting')return '候药';
  if(p.phase==='urgent')return '急救接续';
  if(p.phase==='sampling')return '采样单元';
  if(p.clinical&&p.phase==='nursing')return p.clinical.stage==='sample'?'采样':'评估';
  return {arriving:'登记',registerQueue:'登记',registration:'登记',waiting:'候诊',consultation:`0${p.room} 诊室`,nursingQueue:'护理',nursing:'护理',leaving:'离院'}[p.phase] || '';
}
