// A bounded adult primary-care model. See docs/MEDICAL_MODEL.md for evidence and abstractions.
// Clinical variation is fixed at arrival; rendering, investment and frame rate never draw it again.
export const DAY=86400000, LAB_HOURS={standard:4,priority:1};
export const PHARMACY={cost:9500,duration:30*60000,initialStock:24,reorderAt:6,batch:24,unitCost:20,delivery:4*3600000,operating:4,reserve:30000};
export function createPharmacy(){return {enabled:false,project:null,stock:0,order:null,dispensed:0,external:0,procurement:0,operating:0,revenue:0};}
export const ANNEX={cost:24000,duration:3600000,operating:6,reserve:30000};
export const CLINICAL_CASES={
  respiratory:{label:'成人呼吸道不适',complaint:'鼻塞、咽部不适，偶有咳嗽。',assessment:'生命体征平稳，当前评估未见急症警示。',diagnosis:'普通上呼吸道感染倾向',plan:'对症照护与病程说明；出现新警示症状及时复评。不常规开抗菌药。'},
  pressure:{label:'高血压复诊',complaint:'已有高血压病史，带既往处方复诊。',assessment:'复测血压与家庭记录一致，当前控制平稳。',diagnosis:'已知高血压 · 稳定随诊',plan:'核对既往处方、过敏史、用药与近期评估，安排继续管理。'},
  workup:{label:'高血压检查评估',complaint:'已有高血压病史，按约定来做检查评估。',assessment:'当前生命体征平稳，需要补充既定检查资料。',diagnosis:'已知高血压 · 检查待完善',plan:'安排血尿采样外检及合作机构心电检查，报告齐全后复核。'},
  screening:{label:'血压升高待确认',complaint:'最近自测血压偏高，想确认原因。',assessment:'本次复测偏高，当前评估未见急症警示。',diagnosis:'血压升高 · 尚未确诊',plan:'记录家庭血压，安排非同日复测；不凭本次读数确诊或自动开药。'},
  urgent:{label:'需紧急评估',complaint:'突发胸部不适，伴明显气促。',assessment:'识别到胸部不适伴气促的警示症状。',diagnosis:'急症警示 · 病因未明',plan:'立即联系急救接续并照护等候，常规登记不延误转运。'}
};
export function caseHash(p){let h=2166136261;for(const ch of `${p.id}:${p.name}:${p.appearance}`)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h;}
export function newClinicalCase(p,type){const h=caseHash(p),r=h%100;
  type??=r<40?'respiratory':r<65?'pressure':r<85?'workup':r<97?'screening':'urgent';
  return {type,priority:type==='urgent'?0:2,stage:'assessment',visit:0,episodeId:p.id,
    findings:[],plan:[],diagnosis:null,prescription:null,report:null,trail:[],
    variation:{abnormalReport:(h>>>8)%5===0,persistent:(h>>>13)%4===0},
    outcome:null,assessmentAt:null,waitSince:p.arrivedAt,delay:0};
}
export function createMedical(at){return {version:1,pharmacy:createPharmacy(),annex:false,annexProject:null,lab:'standard',pending:[],records:[],
  stats:{assessed:0,sampled:0,reported:0,reviewed:0,prescribed:0,dispensed:0,improved:0,unresolved:0,urgent:0,lateReviews:0,sampleWait:0,sampleCount:0},
  costs:{consumables:0,external:0,staffSpace:0},nextAudit:at+1800000,pressureChecks:0,observation:'先观察评估与采样的实际负荷。'};}
export function clinicalNote(p,at,text){p.clinical.trail.push({at,text});if(p.clinical.trail.length>24)p.clinical.trail.shift();}
export function clinicalStatus(p,time=Infinity){const c=p.clinical;if(!c)return null;
  if(p.pausedForUrgent)return '等候急救协作结束';
  if(p.phase==='waiting'&&c.stage==='assessment'&&c.readyAt>time)return '静息后测量血压';
  if(p.phase==='pharmacy')return c.stage==='dispense'?'药师核对发药与用药说明':'药师审核处方';
  if(p.phase==='urgent')return '急救接续 · 团队照护中';
  if(p.phase==='sampling')return '采样与交接';
  if(p.phase==='nursing')return c.stage==='sample'?'采样与交接':'到院评估与测量';
  if(p.phase==='waiting')return {assessment:'等候评估',sample:'等候采样',review:'等候报告复核',followup:'等候复诊',pharmacy:'等候药师叫号'}[c.stage]||'等候医生';
  if(p.phase==='consultation')return c.stage==='review'?'医生复核报告':c.stage==='followup'?'随访复评':'医生问诊与检查';
  if(p.phase==='leaving')return c.outcome||'本次就诊结束';
  return c.priority===0?'急症警示 · 优先接续':'到院登记';
}
export function recordPatient(s,p){if(!p.clinical)return;const m=s.medical;
  const record={id:p.clinical.episodeId,name:p.name,age:p.age,sex:p.sex,at:s.time,clinical:structuredClone(p.clinical)};
  const index=m.records.findIndex(r=>r.id===record.id);if(index>=0)m.records.splice(index,1);
  m.records.unshift(record);m.records.length=Math.min(120,m.records.length);
}
export function scheduleClinical(s,p,kind,delay){
  const m=s.medical;
  // Pending care is never discarded. A finite panel hands further follow-up to a partner.
  if(m.pending.length>=2048)return false;
  m.pending.push({id:p.clinical.episodeId+':'+kind+':'+p.clinical.visit,kind,due:s.time+delay,
    patient:{id:p.id,name:p.name,sex:p.sex,identityId:p.clinical.episodeId,age:p.age,color:p.color,appearance:p.appearance,kind:p.kind,thought:p.thought},
    clinical:structuredClone(p.clinical)});return true;
}
export function medicalDue(s){return s.medical?Math.min(s.medical.nextAudit,s.medical.pharmacy?.order?.due??Infinity,s.medical.pharmacy?.project?.completesAt??Infinity,s.medical.annexProject?.completesAt??Infinity,...s.medical.pending.map(e=>e.due),...s.patients.filter(p=>p.phase==='waiting'&&p.clinical?.stage==='assessment'&&p.clinical.readyAt>s.time).map(p=>p.clinical.readyAt)):Infinity;}
export function validateMedical(s){const m=s.medical;if(m===null)return;
  const finite=Number.isFinite,integer=n=>Number.isSafeInteger(n)&&n>=0;
  if(!m||m.version!==1||typeof m.annex!=='boolean'||!['standard','priority'].includes(m.lab)||!finite(m.nextAudit)||m.nextAudit<s.time||!integer(m.pressureChecks)||
    !Array.isArray(m.pending)||m.pending.length>2048||!Array.isArray(m.records)||m.records.length>120||
    !Object.values(m.stats||{}).every(integer)||!Object.values(m.costs||{}).every(integer)||
    !['assessed','sampled','reported','reviewed','prescribed','dispensed','improved','unresolved','urgent','lateReviews','sampleWait','sampleCount'].every(k=>integer(m.stats?.[k]))||
    !['consumables','external','staffSpace'].every(k=>integer(m.costs?.[k])))throw Error('医疗存档不完整');
  if(m.annexProject&&(m.annex||!finite(m.annexProject.completesAt)||m.annexProject.completesAt<s.time||m.annexProject.completesAt-m.annexProject.startedAt!==ANNEX.duration))throw Error('扩建时间不完整');
  const pharmacy=m.pharmacy;
  if(!pharmacy||typeof pharmacy.enabled!=='boolean'||(pharmacy.project&&(pharmacy.enabled||!finite(pharmacy.project.startedAt)||!finite(pharmacy.project.completesAt)||pharmacy.project.completesAt<s.time||pharmacy.project.completesAt-pharmacy.project.startedAt!==PHARMACY.duration))||!['stock','dispensed','external','procurement','operating','revenue'].every(k=>integer(pharmacy[k]))||(pharmacy.order&&(!finite(pharmacy.order.due)||pharmacy.order.due<s.time||pharmacy.order.quantity!==PHARMACY.batch)))throw Error('药房存档不完整');
  const strings=a=>Array.isArray(a)&&a.length<=48&&a.every(x=>typeof x==='string');
  const valid=c=>c&&CLINICAL_CASES[c.type]&&['assessment','consult','sample','review','followup','urgent','pharmacy','dispense'].includes(c.stage)&&[0,1,2].includes(c.priority)&&integer(c.visit)&&typeof c.episodeId==='string'&&strings(c.findings)&&strings(c.plan)&&Array.isArray(c.trail)&&c.trail.length<=24&&c.trail.every(e=>e&&finite(e.at)&&typeof e.text==='string')&&(c.diagnosis===null||typeof c.diagnosis==='string')&&(c.outcome===null||typeof c.outcome==='string')&&(!c.prescription||typeof c.prescription.status==='string')&&(!c.report||(typeof c.report.status==='string'&&(finite(c.report.sampledAt)||c.report.source==='external'&&finite(c.report.orderedAt))&&finite(c.report.expectedAt)&&(c.report.receivedAt===undefined||finite(c.report.receivedAt))))&&c.variation&&typeof c.variation.abnormalReport==='boolean'&&typeof c.variation.persistent==='boolean'&&finite(c.waitSince)&&integer(c.delay);
  for(const p of s.patients)if(p.clinical&&(!valid(p.clinical)||(p.phase==='sampling'&&!m.annex)||(p.phase==='pharmacy'&&(!pharmacy.enabled||!p.clinical.prescription||!['pharmacy','dispense'].includes(p.clinical.stage)))))throw Error('患者医疗信息不完整');
  for(const e of m.pending)if(!['report','return','dispense','followup','transfer'].includes(e.kind)||!finite(e.due)||e.due<s.time||!valid(e.clinical)||!e.patient||typeof e.patient.id!=='string'||typeof e.patient.name!=='string'||!integer(e.patient.age)||!integer(e.patient.appearance))throw Error('医疗后续任务不完整');
  for(const r of m.records)if(!valid(r.clinical)||!finite(r.at)||typeof r.id!=='string'||typeof r.name!=='string')throw Error('病历记录不完整');
}
