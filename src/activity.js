// Presentation reads factual assignments and time; it never spawns demand or awards progress.
export function staffActivity(s, id) {
  const phase=id==='reception'?'registration':id==='nurse'?'nursing':'consultation';
  const p=s.patients.find(p=>p.phase===phase && (!id.startsWith('doctor') || p.room===(id==='doctor1'?1:2)));
  if(id==='director') return {mode:'review',label:s.project?'跟进诊室筹备':'查看运营记录',frame:0};
  if(p) {
    if(s.time<p.serviceAt) return {mode:'calling',label:id==='nurse'?'准备护理位':'等候患者就位',frame:2,patientId:p.id};
    const elapsed=s.time-p.serviceAt,cycle=elapsed%14000;
    if(id==='nurse') return {mode:'care',label:'护理中',patientId:p.id};
    if(id==='reception') return {mode:'working',label:cycle<9000?'核对登记资料':'说明就诊安排',frame:cycle<9000?Math.floor(elapsed/850)%2:2,patientId:p.id};
    const recording=cycle>=5500&&cycle<11000;
    return {mode:'working',label:recording?'记录病情':'问诊交流',frame:recording?Math.floor(elapsed/900)%2:2,patientId:p.id};
  }
  if(id==='nurse') {
    const phase=s.nurseTask?.phase;
    return {mode:phase==='preparing'?'preparing':'available',label:{supplyWalk:'前往备物',preparing:'整理护理物品',returning:'返回护理岗位'}[phase]||'护理待命'};
  }
  const cycle=(s.time-s.startedAt+(id==='doctor2'?6000:0))%24000;
  return {mode:cycle<6000?'preparing':'available',label:cycle<6000?(id==='reception'?'整理登记资料':id==='nurse'?'检查护理物品':'整理接诊记录'):(id==='reception'?'等候来访':id==='nurse'?'护理待命':'等候叫号'),frame:Math.floor(cycle/1200)%2};
}
export function patientIntent(p,time) {
  const traveling=p.motion&&time<p.motion.ready;
  return { arriving:'到前台登记',registerQueue:'排队登记',registration:traveling?'到前台登记':'登记中',
    waiting:traveling?'前往候诊席':'等候叫号',consultation:traveling?`前往 0${p.room} 诊室`:'问诊中',
    nursingQueue:'等候护理',nursing:traveling?'前往护理位':'护理中',leaving:'接诊结束 · 离院' }[p.phase] || '';
}
export function destinationLabel(p) {
  return {arriving:'登记',registerQueue:'登记',registration:'登记',waiting:'候诊',consultation:`0${p.room} 诊室`,nursingQueue:'护理',nursing:'护理',leaving:'离院'}[p.phase] || '';
}
