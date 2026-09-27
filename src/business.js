// Fictional planning/economic parameters, not real rents, bank offers or licensing decisions.
// Regulatory and clinical scope: docs/FOUNDING.md. World time always advances 1:1.
export const DAY=86400000, MONTH=30*DAY, RESERVE=30000;
export const SITES=[
  {id:'willow',name:'柳岸街铺',area:96,rooms:3,rent:4800,deposit:9600,fitout:32000,access:48,prepare:30*60000,x:180,y:345,
    district:'老社区',note:'步行方便，周边已有社区卫生服务站。面积紧凑，第二诊室与药房只能选其一。',outlook:'稳定居住人群；能否建立随诊关系仍需观察。'},
  {id:'station',name:'站前医疗单元',area:148,rooms:4,rent:8500,deposit:17000,fitout:52000,access:65,prepare:60*60000,x:440,y:590,
    district:'交通节点',note:'公交可达，租金较高。可容纳第二诊室和独立药房。',outlook:'潜在到访更分散，便利性不等于固定客源。'},
  {id:'garden',name:'新苑底商',area:220,rooms:5,rent:12000,deposit:24000,fitout:83000,access:72,prepare:90*60000,x:470,y:285,
    district:'新建居住区',note:'可预留独立采样单元；前期资金占用大，周边入住仍在增长。',outlook:'预留更多容量，也承担更多空置成本。'}
];
export const MODELS=[
  {id:'general',name:'成人全科门诊',scope:'普通诊所 · 全科医疗方向',note:'常见症状评估与必要转诊；可逐步加入慢病随诊。',services:['consult']},
  {id:'continuity',name:'慢病随诊诊所',scope:'普通诊所 · 全科医疗方向',note:'围绕已知高血压随诊、资料复核与持续管理，保留基础门诊。',services:['consult','chronic']}
];
export const SERVICES=[
  {id:'consult',name:'成人基础门诊',note:'评估、问诊、照护建议及转诊。开局必需。',cost:0},
  {id:'chronic',name:'高血压随诊',note:'既往资料、复测、随访与必要检查合作。',cost:3500},
  {id:'sampling',name:'院内采样送检',note:'配采样物品与交接流程；标本分析仍由合作实验室完成。',cost:6500},
  {id:'pharmacy',name:'院内处方续配',note:'药师、药柜、储存与首批库存；未开设时由合作药房接续。',cost:9500}
];
export const CANDIDATES=[
  {id:'lin',slot:'doctor1',name:'林岚',role:'医学负责人 / 全科医师',monthly:14500,hire:4500,art:0,scope:'成人基础门诊、高血压随诊',note:'全科执业背景，重视连续照护。',services:['consult','chronic']},
  {id:'gu',slot:'doctor1',name:'顾宁',role:'医学负责人 / 全科医师',monthly:14500,hire:4500,art:1,scope:'成人基础门诊、高血压随诊',note:'全科执业背景，有社区门诊经历。',services:['consult','chronic']},
  {id:'chen',slot:'nurse',name:'陈雪',role:'护士',monthly:7500,hire:1500,art:2,scope:'测量评估、采样与护理交接',note:'负责评估与采样，岗位按顺序服务。'},
  {id:'xu',slot:'nurse',name:'许禾',role:'护士',monthly:7500,hire:1500,art:2,scope:'测量评估、采样与护理交接',note:'有门诊采样工作经历。'},
  {id:'he',slot:'reception',name:'何川',role:'接待与病案',monthly:5000,hire:800,art:4,scope:'登记、预约与转诊联络',note:'本版采用独立接待岗位，避免护理与登记同时占用一人。'},
  {id:'lu',slot:'pharmacist',name:'陆承安',role:'药师',monthly:9500,hire:2000,art:1,scope:'本版续配处方审核、核对与用药说明',note:'仅在选择院内药房后需要聘任。'}
];
export const LOANS=[
  {id:'none',name:'自有资金',amount:0,aprBps:0,months:0},
  {id:'small',name:'创业贷款 · 6万元',amount:60000,aprBps:600,months:12},
  {id:'large',name:'创业贷款 · 12万元',amount:120000,aprBps:700,months:12}
];
export const siteOf=id=>SITES.find(x=>x.id===id);
export const candidate=id=>CANDIDATES.find(x=>x.id===id);
export function initVenture(now){return {version:1,stage:'planning',draft:{site:null,model:null,services:[],staff:{},loan:'none'},plan:null,site:null,readyAt:null,openedAt:null,signedAt:null,nextBill:null,loan:null,relocation:null,ledger:[],serial:0,debtPaid:0,arrears:0,world:{outside:0,closed:0,unavailable:0},message:'先看场地和周边，再决定第一家诊所的方向。'};}
export function businessNote(s,title,detail){s.log.unshift({id:++s.eventSequence,at:s.time,title,detail,kind:'management'});s.log.length=Math.min(48,s.log.length);}
function entry(s,category,amount,label){const v=s.venture;v.ledger.unshift({id:++v.serial,at:s.time,category,amount,label});v.ledger.length=Math.min(100,v.ledger.length);}
export function cashOut(s,amount,label,category='investment'){
  s.cash-=amount;s.metrics[category==='investment'?'investment':'operating']+=amount;entry(s,category,-amount,label);
}
export function quotePlan(s){const d=s.venture.draft,site=siteOf(d.site),people=Object.values(d.staff).map(candidate).filter(Boolean),loan=LOANS.find(x=>x.id===d.loan)||LOANS[0];
  const rows=site?[['场地押金',site.deposit],['功能分区与基础装修',site.fitout],['诊室、测量与应急基础配置',17000],['病案、感染防控与转诊准备',6000]]:[];
  for(const x of SERVICES)if(d.services.includes(x.id)&&x.cost)rows.push([x.name+'配置',x.cost]);
  for(const p of people)rows.push([p.name+'招募与到岗',p.hire]);
  const upfront=rows.reduce((a,r)=>a+r[1],0),monthly=(site?.rent||0)+people.reduce((a,p)=>a+p.monthly,0)+2400;
  const payment=loan.amount?Math.ceil(loan.amount/loan.months+loan.amount*loan.aprBps/10000/12):0;
  const after=s.cash+loan.amount-upfront,monthlyOut=monthly+payment;
  return {rows,upfront,monthly,payment,after,loan,runway:monthlyOut?Math.max(0,after/monthlyOut):0,
    issues:[...(!site?['尚未选择场地']:[]),...(!MODELS.some(x=>x.id===d.model)?['尚未选择诊所定位']:[]),
      ...(!d.services.includes('consult')?['需配置成人基础门诊']:[]),
      ...['doctor1','nurse','reception'].filter(slot=>!candidate(d.staff[slot])).map(slot=>({doctor1:'尚未聘任医学负责人',nurse:'尚未聘任护士',reception:'尚未安排接待与病案岗位'}[slot])),
      ...(d.services.includes('pharmacy')&&!candidate(d.staff.pharmacist)?['院内药房尚未聘任药师']:[]),
      ...(d.services.includes('sampling')&&!d.services.includes('chronic')?['院内采样需与本版检查随诊服务配套']:[]),
      ...(after<RESERVE?['投入后不足3万元运营储备，可缩小方案或选择融资']:[])]};
}
export function configureDraft(s,kind,value){const v=s.venture;if(!v||v.stage!=='planning')return {ok:false,reason:'筹建方案已经签约'};
  const d=v.draft;
  if(kind==='site'&&siteOf(value))d.site=value;
  else if(kind==='model'&&MODELS.some(x=>x.id===value)){if(d.model===value)return {ok:true};d.model=value;d.services=[...MODELS.find(x=>x.id===value).services];delete d.staff.pharmacist;}
  else if(kind==='service'&&SERVICES.some(x=>x.id===value)&&value!=='consult'){
    if(d.services.includes(value)){d.services=d.services.filter(x=>x!==value);if(value==='chronic')d.services=d.services.filter(x=>x!=='sampling');if(value==='pharmacy')delete d.staff.pharmacist;}
    else {if(value==='sampling'&&!d.services.includes('chronic'))return {ok:false,reason:'先选择高血压随诊，才能配置对应采样服务'};d.services.push(value);}
  }else if(kind==='staff'&&candidate(value)){
    const p=candidate(value);if(p.slot==='pharmacist'&&!d.services.includes('pharmacy'))return {ok:false,reason:'先选择院内药房'};d.staff[p.slot]=value;
  }else if(kind==='loan'&&LOANS.some(x=>x.id===value))d.loan=value;
  else return {ok:false,reason:'无效的筹建选项'};
  return {ok:true};
}
export function signPlan(s){const v=s.venture;if(v.stage!=='planning')return {ok:false,reason:'已经签约，不能重复扣款'};
  const q=quotePlan(s);if(q.issues.length)return {ok:false,reason:q.issues[0]};
  const site=siteOf(v.draft.site);v.plan=structuredClone(v.draft);v.site=site.id;v.signedAt=s.time;v.readyAt=s.time+site.prepare;v.nextBill=s.time+DAY;v.stage='fitting';
  if(q.loan.amount){v.loan={offer:q.loan.id,original:q.loan.amount,principal:q.loan.amount,remaining:q.loan.months,nextDue:s.time+MONTH,interestPaid:0,interestDue:0,principalDue:0};s.cash+=q.loan.amount;entry(s,'borrowing',q.loan.amount,'创业贷款到账（模拟合同）');}
  for(const [label,amount] of q.rows)cashOut(s,amount,label);
  v.message='租约和筹建预算已确定，团队正在准备房间、设备与接续安排。';
  businessNote(s,'筹建方案已签约',site.name+'，'+MODELS.find(x=>x.id===v.plan.model).name+'。一次性投入 ¥'+q.upfront+'，准备结束后由你决定开业。');return {ok:true};
}
export function openVenture(s){const v=s.venture;if(v.stage!=='ready')return {ok:false,reason:'筹建尚未完成'};
  v.stage='open';v.openedAt=s.time;v.message='团队按已确定的范围自主接诊。营业时间：工作日 09:00—17:00。';
  businessNote(s,'梅奥开始接诊','房间、团队和服务已按方案启用。患者由城镇需求自然到访，营业时段外的新预约安排到下一工作日。');return {ok:true};
}
export function ventureDue(s){const v=s.venture;return v?Math.min(v.stage==='fitting'?v.readyAt:Infinity,v.nextBill??Infinity,v.loan?.nextDue??Infinity,v.relocation?.due??Infinity):Infinity;}
export function monthlyFixed(s){const v=s.venture;if(!v.plan)return 0;return siteOf(v.site).rent+Object.values(v.plan.staff).map(candidate).filter(Boolean).reduce((a,p)=>a+p.monthly,0)+2400+(s.secondRoom?16000:0)+(s.medical.annex?8500:0);}
export function advanceVenture(s){const v=s.venture;if(!v)return;
  if(v.stage==='fitting'&&v.readyAt===s.time){v.stage='ready';v.message='房间与团队准备就绪，开业前请复核配置和资金。';
    s.medical.pharmacy.enabled=v.plan.services.includes('pharmacy');s.medical.pharmacy.stock=s.medical.pharmacy.enabled?24:0;
    businessNote(s,'筹建准备完成','医学负责人已核对本版服务所需的团队、房间与外部接续。等待你决定开业；尚未产生营业收入。');}
  if(v.nextBill===s.time){const cost=Math.ceil(monthlyFixed(s)/30);cashOut(s,cost,'日结：租金、团队及基础维护','operating');v.nextBill+=DAY;}
  if(v.loan?.nextDue===s.time){
    const l=v.loan,offer=LOANS.find(x=>x.id===l.offer),interest=Math.ceil(l.principal*offer.aprBps/10000/12);
    l.interestDue+=interest;l.principalDue=Math.min(l.principal,l.principalDue+Math.ceil(l.original/offer.months));
    const interestPaid=Math.min(Math.max(0,s.cash),l.interestDue);s.cash-=interestPaid;s.metrics.operating+=interestPaid;l.interestDue-=interestPaid;l.interestPaid+=interestPaid;
    const principalPaid=Math.min(Math.max(0,s.cash),l.principalDue);s.cash-=principalPaid;l.principalDue-=principalPaid;l.principal-=principalPaid;v.debtPaid+=principalPaid;
    l.remaining=Math.max(0,l.remaining-1);v.arrears=l.principalDue+l.interestDue;
    entry(s,'repayment',-interestPaid-principalPaid,'到期还本付息');
    if(v.arrears){v.message='本期还款存在欠付，新增投资已受限。未还本金和利息继续保留。';businessNote(s,'还款存在欠付',v.message);}
    if(l.principal===0&&l.interestDue===0)v.loan=null;else l.nextDue+=MONTH;
  }
  if(v.relocation?.due===s.time){
    if(s.patients.length){v.relocation.due=s.time+60000;return;}
    const from=siteOf(v.site),to=siteOf(v.relocation.site);v.site=to.id;v.stage='open';v.relocation=null;s.cash+=from.deposit;entry(s,'depositReturn',from.deposit,'原场地押金退回（无损耗原型）');
    v.message='已迁入'+to.name+'，原病历、随访、团队和债务继续保留。';businessNote(s,'迁址交接完成',v.message);
  }
}
export function acceptingAt(s,at=s.time){if(!s.venture)return true;const v=s.venture;if(v.stage!=='open'||s.cash<0)return false;const d=new Date(at+8*3600000),h=d.getUTCHours(),day=d.getUTCDay();return day>=1&&day<=5&&h>=9&&h<17;}
export function nextAdmission(s,at){if(!s.venture)return at;const v=s.venture;let t=Math.max(at,v.relocation?.due??at);if(acceptingAt({...s,venture:{...v,stage:'open'}},t))return t;
  const d=new Date(t+8*3600000);let day=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),1);if(t>=day)day+=DAY;
  while([0,6].includes(new Date(day+8*3600000).getUTCDay()))day+=DAY;return day;
}
export function serviceAvailable(s,type){if(!s.venture)return true;const list=s.venture.plan?.services||[];return type==='urgent'||(type==='respiratory'?list.includes('consult'):list.includes('chronic'));}
export function staffFor(s,base,onSite=false){if(!s.venture)return base;const v=s.venture;if(!['open','moving'].includes(v.stage))return [];
  if(onSite&&!acceptingAt(s)&&!s.patients.length)return [];
  return base.filter(p=>p.id!=='director'&&(p.id==='doctor2'?s.secondRoom:p.id==='nurse2'?s.medical.annex:Boolean(v.plan.staff[p.id]))).map(p=>{const hired=candidate(v.plan.staff[p.id]);return hired?{...p,...hired,id:p.id}:p.id==='doctor2'?{...p,name:'周启明'}:p.id==='nurse2'?{...p,name:'沈宁'}:p;});
}
export function investmentAllowed(s,action){const v=s.venture;if(!v)return null;
  if(v.arrears)return '存在到期欠付，请先处理资金缺口';
  if(v.stage!=='open')return '营业前或迁址中不能追加院内扩建';
  const used=2+Number(s.secondRoom||s.project)+Number(s.medical.pharmacy.enabled||s.medical.pharmacy.project)+Number(s.medical.annex||s.medical.annexProject),site=siteOf(v.site);
  if(['openSecondRoom','openPharmacy','buildAnnex'].includes(action)&&used>=site.rooms)return '场地功能单元已满，请先考虑迁址';
  if(action==='openPharmacy'&&!v.plan.staff.pharmacist)return '请先在团队中聘任药师';
  if(action==='buildAnnex'&&!v.plan.services.includes('sampling'))return '本院尚未选择院内采样服务';
  return null;
}
export function hireOperating(s,id){const v=s.venture,p=candidate(id);if(!v||v.stage!=='open'||p?.slot!=='pharmacist')return {ok:false,reason:'当前仅支持新增药房的药师招募'};
  if(v.arrears)return {ok:false,reason:'请先处理到期欠付'};
  if(v.plan.staff.pharmacist)return {ok:false,reason:'药师已聘任'};if(s.cash<p.hire+RESERVE)return {ok:false,reason:'招募后需保留运营储备'};
  cashOut(s,p.hire,p.name+'招募到岗');v.plan.staff.pharmacist=id;businessNote(s,'药师已聘任','陆承安负责药事准备；房间配置完成前暂不提供院内发药。');return {ok:true};
}
export function enableService(s,id){
  const v=s.venture,service=SERVICES.find(x=>x.id===id);const issue=investmentAllowed(s,'service');
  if(issue)return {ok:false,reason:issue};
  if(!v||!['chronic','sampling'].includes(id)||!service)return {ok:false,reason:'当前不能配置该服务'};
  if(v.plan.services.includes(id))return {ok:false,reason:'已经配置该服务'};
  if(id==='sampling'&&!v.plan.services.includes('chronic'))return {ok:false,reason:'先建立随诊服务'};
  if(s.cash<service.cost+RESERVE)return {ok:false,reason:'配置后需保留运营储备'};
  cashOut(s,service.cost,service.name+'配置');v.plan.services.push(id);
  businessNote(s,'新增服务配置',service.name+'已配置，后续患者按新能力安排；已交接的外部检查保持原安排。');return {ok:true};
}
export function relocationQuote(s,id){const site=siteOf(id),current=siteOf(s.venture?.site);if(!site||!current)return null;return {site,cost:site.deposit+site.fitout+12000+current.rent,duration:DAY,refund:current.deposit};}
export function relocate(s,id){const v=s.venture,q=relocationQuote(s,id);if(!v||v.stage!=='open'||!q||id===v.site)return {ok:false,reason:'当前不能安排该迁址'};
  const needed=2+Number(s.secondRoom)+Number(s.medical.pharmacy.enabled)+Number(s.medical.annex);
  if(s.project||s.medical.annexProject||s.medical.pharmacy.project)return {ok:false,reason:'请先完成现有筹备项目'};
  if(q.site.rooms<needed)return {ok:false,reason:'新场地无法容纳当前服务配置'};
  if(v.arrears)return {ok:false,reason:'请先处理到期欠付'};
  if(s.cash<q.cost+RESERVE)return {ok:false,reason:'迁址预算不足，且需保留运营储备'};
  cashOut(s,q.cost,'迁址：新押金、适配装修、搬运与旧租约退出');v.stage='moving';v.relocation={site:id,startedAt:s.time,due:s.time+q.duration};
  v.message='迁址交接中：当前患者完成照护，暂停接收新患者；报告继续回传，复诊顺延到新址恢复营业。';businessNote(s,'已安排迁址',v.message);return {ok:true};
}
export function validateVenture(s){const v=s.venture;if(!v)return;const int=n=>Number.isSafeInteger(n)&&n>=0,finite=Number.isFinite;
  if(v.version!==1||!['planning','fitting','ready','open','moving'].includes(v.stage)||!v.draft||!Array.isArray(v.draft.services)||!Array.isArray(v.ledger)||v.ledger.length>100||!int(v.serial)||!int(v.debtPaid)||!int(v.arrears)||typeof v.message!=='string'||!v.world||!['outside','closed','unavailable'].every(k=>int(v.world[k])))throw Error('筹建档案不完整');
  const plan=p=>p&&(!p.site||siteOf(p.site))&&(!p.model||MODELS.some(x=>x.id===p.model))&&Array.isArray(p.services)&&new Set(p.services).size===p.services.length&&p.services.every(x=>SERVICES.some(y=>y.id===x))&&p.staff&&Object.entries(p.staff).every(([slot,id])=>candidate(id)?.slot===slot)&&LOANS.some(x=>x.id===p.loan);
  if(!plan(v.draft)||(v.stage!=='planning'&&(!plan(v.plan)||!siteOf(v.site)||!finite(v.signedAt)||!finite(v.readyAt)||!finite(v.nextBill)||v.nextBill<s.time))||v.stage==='fitting'&&v.readyAt<s.time)throw Error('筹建时间或配置不完整');
  if(v.stage!=='planning'&&(!v.plan.services.includes('consult')||!v.plan.model||!['doctor1','nurse','reception'].every(x=>candidate(v.plan.staff[x]))||v.plan.services.includes('pharmacy')&&!v.plan.staff.pharmacist||v.plan.services.includes('sampling')&&!v.plan.services.includes('chronic')))throw Error('营业配置缺少必要服务或岗位');
  if(v.loan){const l=v.loan,o=LOANS.find(x=>x.id===l.offer&&x.amount);if(!o||l.original!==o.amount||!int(l.principal)||l.principal>l.original||!int(l.remaining)||l.remaining>12||!int(l.interestPaid)||!int(l.interestDue)||!int(l.principalDue)||l.principalDue>l.principal||!finite(l.nextDue)||l.nextDue<s.time)throw Error('借款档案不完整');}
  if(v.stage==='moving'&&!v.relocation||v.relocation&&(v.stage!=='moving'||!siteOf(v.relocation.site)||!finite(v.relocation.due)||v.relocation.due<s.time))throw Error('迁址档案不完整');
  if(v.ledger.some(e=>!int(e.id)||!finite(e.at)||!finite(e.amount)||typeof e.label!=='string'||typeof e.category!=='string'))throw Error('筹建账本不完整');
}
