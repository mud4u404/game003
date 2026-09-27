import { patientSex } from './identity.js';
import { CLINICAL_CASES, ANNEX, PHARMACY, clinicalStatus } from './medical.js';
import { ClinicAudio } from './audio.js';
import { staffActivity, patientIntent } from './activity.js';
import { createState, advanceTo, restoreState, snapshot, STAFF, CASES, PROJECT, MINUTE, HOUR, applyManagementAction, setAuthority } from './simulation.js';
import { ClinicScene } from './scene.js';
const $ = id => document.getElementById(id);
const KEY = 'meiao-clinic-v1';
const money = n => '¥' + Math.round(n).toLocaleString('zh-CN');
const time = n => new Date(n).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state, leader = false, catchingUp = false, currentPanel = null, selected = null, lastUI = 0, lastSave = 0, persistent = true, preservedBadSave = false;
let lastPanelHTML = '', lastPersonHTML = '', offlineBefore = null, startup = true;
const audio=new ClinicAudio();
const scene = new ClinicScene($('scene'), selectPerson, () => $('hint').classList.add('faded'));
function notice(message, sticky=false) {
  $('notice').replaceChildren(document.createTextNode(message)); $('notice').hidden = false;
  const close = document.createElement('button'); close.textContent = '知道了'; close.onclick = () => $('notice').hidden=true; $('notice').append(close);
  clearTimeout(notice.timer); if(!sticky) notice.timer=setTimeout(()=>$('notice').hidden=true,10000);
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createState();
    const saved = restoreState(raw); if(startup) offlineBefore = snapshot(saved); return saved;
  } catch(error) {
    // Keep the original slot untouched until the player can recover it. Never silently overwrite a broken save.
    persistent = false; preservedBadSave = true;
    notice('存档无法读取。原存档已保留，本次以临时诊所运行，不覆盖旧进度。',true);
    return createState();
  }
}
function save() {
  if (!leader || !persistent || catchingUp) return;
  try { localStorage.setItem(KEY,JSON.stringify(state)); lastSave=Date.now(); }
  catch(error) { persistent=false; notice('浏览器无法保存进度。本次仍可体验，关闭后可能丢失。',true); }
}
function reportOffline() {
  if (!offlineBefore || preservedBadSave) return;
  const gap=state.time-offlineBefore.time;
  if(gap>MINUTE) {
    const a=state.metrics, duration=gap>=HOUR?(gap/HOUR).toFixed(1)+' 小时':Math.floor(gap/MINUTE)+' 分钟';
    notice(`离开 ${duration}：完成 ${a.completed-offlineBefore.completed} 次接诊，转诊 ${a.referred-offlineBefore.referred} 人，收入 ${money(a.revenue-offlineBefore.revenue)}，支出 ${money(a.operating+a.investment-offlineBefore.operating-offlineBefore.investment)}。`,true);
  }
  offlineBefore=null;
}
async function catchUp(target) {
  catchingUp=true; renderUI(true);
  while(!advanceTo(state,target,1500).caughtUp) await new Promise(resolve=>setTimeout(resolve,0));
  catchingUp=false; reportOffline(); save(); renderUI(true);
}
async function takeOwnership() {
  if(leader) return;
  if(!navigator.locks) {
    // Browsers without Web Locks get observation-only mode; avoiding duplicate writers is more important than silently racing.
    notice('当前浏览器不支持存档互斥锁，暂以观察模式运行。请使用近期版本的浏览器打开。',true);
    state ??=load(); renderUI(true); return;
  }
  await navigator.locks.request('meiao-clinic-writer-v1',{ifAvailable:true}, async lock=>{
    if(!lock) {state=load();startup=false;renderUI(true);return;}
    state=load();startup=false;leader=true;
    if(state.time>Date.now()+5000) notice('设备时间早于存档时间，医院将等待时间追上，避免重复结算。',true);
    await catchUp(Date.now());
    await new Promise(resolve=>{window.addEventListener('pagehide',()=>{save();leader=false;resolve();},{once:true});});
  });
}
function mutate(action) {
  if(!leader||catchingUp)return;
  advanceTo(state,Date.now()); action(); save();renderUI(true);
}
function panel(title,subtitle,body) {return `<button class="close" data-close="panel" aria-label="关闭面板">×</button><span class="eyebrow">MEIAO / COMMUNITY CLINIC</span><h2>${title}</h2><p class="subtle">${subtitle}</p>${body}`;}
function ledger(rows) {return '<dl class="ledger">'+rows.map(([key,val])=>`<div><dt>${key}</dt><dd>${val}</dd></div>`).join('')+'</dl>';}
function patientRecordHTML(c,name,age,status,sex){return `<span class="eyebrow">诊疗记录 · ${esc(CLINICAL_CASES[c.type].label)}</span><h2>${esc(name)}<small>${sex?sex==='female'?'女 · ':'男 · ':''}${age} 岁</small></h2><span class="tag">${esc(status||c.outcome||'团队正在接诊')}</span><p>${esc(CLINICAL_CASES[c.type].complaint)}</p>${c.diagnosis?`<h3>${esc(c.diagnosis)}</h3>`:''}${c.findings.map(t=>`<p class="subtle">${esc(t.replace('本模型覆盖的',''))}</p>`).join('')}${c.report?`<p class="small-note">检查：${esc(c.report.status)}${c.report.status==='已送检'?' · 预计 '+time(c.report.expectedAt):''}</p>`:''}${c.plan.map(t=>`<p>${esc(t.replace('本模型覆盖的',''))}</p>`).join('')}${c.prescription?`<p class="small-note">处方：${esc(c.prescription.status)} · 既往方案续配</p>`:''}<ol class="care-trail">${c.trail.slice(-5).map(e=>`<li><time>${time(e.at)}</time> ${esc(e.text)}</li>`).join('')}</ol>`;}
function staffStatus(id) { return staffActivity(state,id).label; }
function panelContent() {
  const m=state.metrics,care=state.medical;
  if(currentPanel==='hospital'&&care)return panel('诊所正在照护的人','每次接诊之后，仍有需要跟进的事情。',ledger([['当前到院',state.patients.filter(p=>p.phase!=='leaving').length+' 人'],['已复核报告',care.stats.reviewed+' 份'],['随访反馈改善 / 平稳',care.stats.improved+' 人次'],['复评后仍需跟进',care.stats.unresolved+' 人次'],['待报告 / 随访等后续',care.pending.length+' 项'],['现金储备',money(state.cash)]])+`<h3>当前服务配置</h3>${ledger([['检查与采样室','护士评估、测量、采样'],['院内药房',care.pharmacy.enabled?'药师在岗 · 库存 '+care.pharmacy.stock+' 份':care.pharmacy.project?'筹备中 · 暂由合作药房接续':'未开设 · 合作药房接续'],['合作机构','标本分析、心电检查']])}<h3>正在接诊</h3>${state.patients.filter(p=>p.clinical&&p.phase!=='leaving').slice(0,12).map(p=>`<button class="case-row" data-person="${p.id}"><b>${esc(p.name)}</b><span>${esc(clinicalStatus(p,state.time))}</span></button>`).join('')||'<p class="subtle">此刻没有正在接诊的患者。</p>'}<h3>最近诊疗记录</h3>${care.records.slice(0,10).map(r=>`<button class="case-row" data-record="${r.id}"><b>${esc(r.name)}</b><span>${esc(r.clinical.outcome||'后续处理中')}</span></button>`).join('')||'<p class="subtle">团队完成评估后，记录会在这里保留。</p>'}<details><summary>服务范围与结果含义</summary><p class="small-note">首版仅覆盖有限成人门诊路径。完成接诊不等于治愈，转诊不等于失败；未改善需要复评。具体药品剂量与完整疾病鉴别尚未模拟，展示的费用、就诊时长及病例比例属于原型参数。</p></details>`);
  if(currentPanel==='hospital') return panel('一间诊所的日常','从基础门诊开始，慢慢建立信任。',ledger([
    ['当前到院',state.patients.filter(p=>p.phase!=='leaving').length+' 人'],['正在候诊',state.patients.filter(p=>p.phase==='waiting').length+' 人'],['累计完成接诊',m.completed+' 次'],['专科转诊',m.referred+' 人'],['累计服务收入',money(m.revenue)],['运营与投入',money(m.operating+m.investment)],['现金储备',money(state.cash)]
  ])+`<p class="small-note">${m.capacityRedirected?`另有 ${m.capacityRedirected} 人因容量不足获外部就诊指引。<br>`:''}需求来自独立的小镇人群。新增诊室只改变接诊能力。<br>原型中的费用和诊疗时长尚未进行现实校准。</p>`);
  if(currentPanel==='team') return panel('在这里工作的人','日常接诊与协作，由他们负责。',STAFF.filter(p=>(p.id!=='doctor2'||state.secondRoom)&&(p.id!=='nurse2'||care?.annex)&&(p.id!=='pharmacist'||care?.pharmacy.enabled)).map(p=>`<button class="staff-row" data-person="${p.id}"><span class="avatar" style="--coat:${p.color}"></span><span><b>${p.name}</b><small>${p.role}</small></span><span>${staffStatus(p.id)} ›</span></button>`).join('')+'<p class="small-note">选择人物，在诊所里找到他。</p>');
  if(currentPanel==='director') {
    let project;
    if(state.secondRoom) project='<h3>第二诊室已启用</h3><p class="subtle">顾宁已到岗，与林岚共同接诊。持续观察容量与需求的匹配。</p>';
    else if(state.project) {
      const pct=Math.floor(100*(state.time-state.project.startedAt)/PROJECT.duration);
      project=`<h3>第二诊室 · 准备中</h3><div class="progress" role="progressbar" aria-label="第二诊室准备进度" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><p class="subtle">预计 ${Math.ceil((state.project.completesAt-state.time)/MINUTE)} 分钟后启用，离线时照常推进。</p>`;
    } else project=`<h3>预留空间 · 第二诊室</h3><p class="subtle">设施与人员到岗投入 ${money(PROJECT.cost)}<br>准备 20 分钟 · 运营支出增加 ¥7 / 分钟</p><button class="action" data-action="expand" ${!leader||catchingUp||state.cash<PROJECT.cost+PROJECT.reserve?'disabled':''}>决定启用第二诊室</button>`;
    const medicalProject=care?`<div class="project"><h3>相邻单元 · 评估与采样能力</h3><p class="subtle">${esc(care.observation)}</p>${ledger([['已采样',care.stats.sampled+' 人次'],['采样平均等候',care.stats.sampleCount?Math.round(care.stats.sampleWait/care.stats.sampleCount/MINUTE)+' 分钟':'尚无样本'],['耗材 / 外部服务支出',money(care.costs.consumables)+' / '+money(care.costs.external)],['相邻单元累计运营支出',money(care.costs.staffSpace)]])}${care.annex?'<button class="action" data-action="viewAnnex">查看采样单元</button>':care.annexProject?`<p>装修与人员准备中 · 约 ${Math.ceil((care.annexProject.completesAt-state.time)/MINUTE)} 分钟</p><button class="action" data-action="viewAnnex">查看相邻空间</button>`:`<p class="subtle">租赁、装修及护士到岗 ¥24,000 · 准备 1 小时<br>启用后增加 ¥6 / 分钟运营支出。独立采样位释放原护理位，不增加患者需求。</p><button class="action" data-action="buildAnnex" ${!leader||catchingUp||state.cash<ANNEX.cost+ANNEX.reserve?'disabled':''}>委托租下相邻单元</button>`}<h3>外部检查合作</h3><p class="subtle">${care.lab==='priority'?'优先合作 · 预计 1 小时 · 单次成本 ¥180':'常规合作 · 预计 4 小时 · 单次成本 ¥100'}<br>仅影响新送检；已送检按原安排返回。</p><button class="action secondary" data-action="${care.lab==='priority'?'standardLab':'priorityLab'}" ${!leader||catchingUp?'disabled':''}>${care.lab==='priority'?'恢复常规合作':'采用优先外检合作'}</button></div>`:'';
    const pharmacy=care?.pharmacy;
    const pharmacyProject=pharmacy?`<div class="project"><h3>院内药房</h3>${pharmacy.enabled?ledger([['已配置','药柜、取药台、药师陆承安'],['续配库存',pharmacy.stock+' 份'],['院内发药 / 外部接续',pharmacy.dispensed+' / '+pharmacy.external+' 次'],['补货',pharmacy.order?'在途 · 约 '+Math.ceil((pharmacy.order.due-state.time)/MINUTE)+' 分钟':'按库存安排']]):pharmacy.project?`<p class="subtle">房间改造、药师及首批库存筹备中 · 约 ${Math.ceil((pharmacy.project.completesAt-state.time)/MINUTE)} 分钟</p>`:`<p class="subtle">目前由合作药房审核与发药。投入 ¥9,500，将原行政室改为药房，配置药柜、首批续配库存和一名药师。准备30分钟；新增运营 ¥4 / 分钟，补货另计。</p><button class="action" data-action="openPharmacy" ${!leader||catchingUp||state.cash<PHARMACY.cost+PHARMACY.reserve?'disabled':''}>决定筹备院内药房</button>`}<p class="small-note">当前仅承接已建模的既有方案续配。库存份数和费用是原型参数，不代表所有药物均可供应。</p></div>`:'';
    return panel('周敏 · 执行院长','日常运行已经交给团队。',`<p class="quote">“${esc(state.directorThought)}”</p><p class="section-label">投资授权</p><div class="policy"><span>允许院长安排小额扩建</span><button class="switch" role="switch" aria-label="允许院长安排小额扩建" aria-checked="${state.authority}" data-action="authority" ${!leader||catchingUp?'disabled':''}></button></div><p class="small-note">持续观察到候诊或采样积压时，可安排相应投入；始终保留 ¥30,000 运营储备。</p><div class="project">${project}</div>${pharmacyProject}${medicalProject}`);
  }
  if(currentPanel==='journal') return panel('院务记录','行动留下记录，变化有迹可循。',state.log.slice(0,18).map(e=>`<article class="journal-entry"><time>${time(e.at)}</time><h3>${esc(e.title)}</h3><p>${esc(e.detail)}</p></article>`).join(''));
  return '';
}
function selectPerson(id) {
  selected=id;scene.selected=id;lastPersonHTML='';
  if(id){currentPanel=null;lastPanelHTML='';}
  renderUI(true);
}
function renderUI(force=false) {
  if(!state)return;
  const now=performance.now();if(!force&&now-lastUI<600)return;lastUI=now;
  $('clock').textContent=time(state.time);$('day').textContent='第 '+(Math.floor((state.time-state.startedAt)/(24*HOUR))+1)+' 天';$('cash').textContent=money(state.cash);
  $('live-label').textContent=catchingUp?'整理离线进展':!leader?'观察模式':!persistent?'临时运行':'自主运行';$('director-dot').hidden=!state.project;
  document.querySelectorAll('[data-panel]').forEach(b=>{const active=b.dataset.panel===currentPanel;b.classList.toggle('active',active);b.setAttribute('aria-expanded',String(active));});
  $('panel').hidden=!currentPanel;
  if(currentPanel){const html=panelContent();if(html!==lastPanelHTML){const focus=document.activeElement?.dataset.action;const scroll=$('panel').scrollTop;$('panel').innerHTML=html;$('panel').scrollTop=scroll;if(focus)$('panel').querySelector(`[data-action="${focus}"]`)?.focus({preventScroll:true});lastPanelHTML=html;}}
  $('person').hidden=!selected;
  if(selected){
    const p=state.patients.find(p=>p.id===selected),staff=STAFF.find(p=>p.id===selected);
    let html='<button class="close" data-close="person" aria-label="关闭人物信息">×</button>';
    if(p?.clinical)html+=patientRecordHTML(p.clinical,p.name,p.age,patientIntent(p,state.time),patientSex(p));
    else if(p)html+=`<span class="eyebrow">来到诊所的人</span><h2>${esc(p.name)}<small>${p.age} 岁</small></h2><span class="tag">${patientIntent(p, state.time)}</span><p>${esc(p.thought)}</p><p class="small-note">${p.phase==='waiting'?'已候诊 '+Math.floor((state.time-p.waitStarted)/MINUTE)+' 分钟':CASES.find(c=>c.id===p.kind).label}</p>`;
    else if(staff)html+=`<span class="eyebrow">${staff.role}</span><h2>${staff.name}</h2><span class="tag">${staffStatus(staff.id)}</span><p>${staff.id==='director'?esc(state.directorThought):staff.description}</p>`;
    else if(selected.startsWith('case:')){const r=state.medical?.records.find(r=>r.id===selected.slice(5));html+=r?patientRecordHTML(r.clinical,r.name,r.age,null,r.sex):'<p>此记录已归档。</p>';}
    else {const past=state.history.find(p=>p.id===selected);html+=`<span class="eyebrow">本次到访已结束</span><h2>${esc(past?.name||'来访者')}</h2><p>${esc(past?.outcome||'已离开诊所')}，团队继续照护下一位患者。</p>`;}
    if(lastPersonHTML!==html){$('person').innerHTML=html;lastPersonHTML=html;}
  }
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.panel){currentPanel=currentPanel===b.dataset.panel?null:b.dataset.panel;lastPanelHTML='';selectPerson(null);renderUI(true);}
  if(b.dataset.close==='panel'){currentPanel=null;renderUI(true);}
  if(b.dataset.close==='person')selectPerson(null);
  if(b.dataset.person){selectPerson(b.dataset.person);scene.focus(b.dataset.person,state);}
  if(b.dataset.record)selectPerson('case:'+b.dataset.record);
  if(b.dataset.action==='viewAnnex'){currentPanel=null;selectPerson(null);scene.focusAnnex();}
  if(['buildAnnex','priorityLab','standardLab','openPharmacy'].includes(b.dataset.action))mutate(()=>{const result=applyManagementAction(state,{action:b.dataset.action},'investor');notice(result.ok?'已交由院长执行，后续进展写入院务记录。':result.reason);});
  if(b.dataset.action==='authority')mutate(()=>setAuthority(state,!state.authority));
  if(b.dataset.action==='expand')mutate(()=>{const result=applyManagementAction(state,{action:'openSecondRoom'},'investor');notice(result.ok?'已委托周敏准备第二诊室。20 分钟后开始接诊。':result.reason);});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){currentPanel=null;selectPerson(null);renderUI(true);}});
$('sound').onclick=async()=>{await audio.toggle();$('sound').textContent=audio.enabled?'♪':'♫';$('sound').setAttribute('aria-label',audio.enabled?'关闭声音':'开启声音');$('sound').setAttribute('aria-pressed',String(audio.enabled));};
$('zoom-in').onclick=()=>scene.changeZoom(1.2);$('zoom-out').onclick=()=>scene.changeZoom(1/1.2);$('reset-view').onclick=()=>scene.reset();
window.addEventListener('storage',e=>{if(e.key===KEY&&!leader&&e.newValue){try{state=restoreState(e.newValue);renderUI(true);}catch{ /* Keep last valid snapshot. */ }}});
document.addEventListener('visibilitychange',()=>{if(leader&&document.hidden)save();if(!document.hidden&&leader&&!catchingUp){offlineBefore=snapshot(state);catchUp(Date.now());}});
window.addEventListener('pageshow',e=>{if(e.persisted)takeOwnership();});
state=load();takeOwnership();
setInterval(()=>{if(!leader)takeOwnership();},3000);
$('hint').textContent='拖动观察 · 双指缩放';
setTimeout(()=>$('hint').classList.add('faded'),18000);
function frame(tick) {
  if(state){
    // Observer tabs advance their own deterministic view every frame. Only the lock
    // owner saves; waiting for three-second storage snapshots caused stop/start motion.
    if(!catchingUp){const result=advanceTo(state,Date.now(),1000);if(!result.caughtUp)catchUp(Date.now());if(leader&&Date.now()-lastSave>3000)save();}
    audio.observe(state,catchingUp||document.hidden);scene.draw(state,tick);renderUI();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
