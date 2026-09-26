import { createState, advanceTo, restoreState, snapshot, STAFF, CASES, PROJECT, MINUTE, HOUR, phaseLabel, applyManagementAction, setAuthority } from './simulation.js';
import { ClinicScene } from './scene.js';
const $ = id => document.getElementById(id);
const KEY = 'meiao-clinic-v1';
const money = n => '¥' + Math.round(n).toLocaleString('zh-CN');
const time = n => new Date(n).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state, leader = false, catchingUp = false, currentPanel = null, selected = null, lastUI = 0, lastSave = 0, persistent = true, preservedBadSave = false;
let lastPanelHTML = '', lastPersonHTML = '', offlineBefore = null, startup = true;
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
function staffStatus(id) {
  if(id==='director')return '观察运营';
  if(id==='reception')return state.patients.some(p=>p.phase==='registration')?'登记中':'接待在岗';
  if(id==='nurse')return state.patients.some(p=>p.phase==='nursing')?'护理中':'护理在岗';
  return state.patients.some(p=>p.phase==='consultation'&&p.room===(id==='doctor1'?1:2))?'接诊中':'等待接诊';
}
function panelContent() {
  const m=state.metrics;
  if(currentPanel==='hospital') return panel('一间诊所的日常','从基础门诊开始，慢慢建立信任。',ledger([
    ['当前到院',state.patients.filter(p=>p.phase!=='leaving').length+' 人'],['正在候诊',state.patients.filter(p=>p.phase==='waiting').length+' 人'],['累计完成接诊',m.completed+' 次'],['专科转诊',m.referred+' 人'],['累计服务收入',money(m.revenue)],['运营与投入',money(m.operating+m.investment)],['现金储备',money(state.cash)]
  ])+`<p class="small-note">${m.capacityRedirected?`另有 ${m.capacityRedirected} 人因容量不足获外部就诊指引。<br>`:''}需求来自独立的小镇人群。新增诊室只改变接诊能力。<br>原型中的费用和诊疗时长尚未进行现实校准。</p>`);
  if(currentPanel==='team') return panel('在这里工作的人','日常接诊与协作，由他们负责。',STAFF.filter(p=>p.id!=='doctor2'||state.secondRoom).map(p=>`<button class="staff-row" data-person="${p.id}"><span class="avatar" style="--coat:${p.color}"></span><span><b>${p.name}</b><small>${p.role}</small></span><span>${staffStatus(p.id)} ›</span></button>`).join('')+'<p class="small-note">选择人物，在诊所里找到他。</p>');
  if(currentPanel==='director') {
    let project;
    if(state.secondRoom) project='<h3>第二诊室已启用</h3><p class="subtle">顾宁已到岗，与林岚共同接诊。持续观察容量与需求的匹配。</p>';
    else if(state.project) {
      const pct=Math.floor(100*(state.time-state.project.startedAt)/PROJECT.duration);
      project=`<h3>第二诊室 · 准备中</h3><div class="progress" role="progressbar" aria-label="第二诊室准备进度" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><p class="subtle">预计 ${Math.ceil((state.project.completesAt-state.time)/MINUTE)} 分钟后启用，离线时照常推进。</p>`;
    } else project=`<h3>预留空间 · 第二诊室</h3><p class="subtle">设施与人员到岗投入 ${money(PROJECT.cost)}<br>准备 20 分钟 · 运营支出增加 ¥7 / 分钟</p><button class="action" data-action="expand" ${!leader||catchingUp||state.cash<PROJECT.cost+PROJECT.reserve?'disabled':''}>决定启用第二诊室</button>`;
    return panel('周敏 · 执行院长','日常运行已经交给团队。',`<p class="quote">“${esc(state.directorThought)}”</p><p class="section-label">投资授权</p><div class="policy"><span>允许院长安排小额扩建</span><button class="switch" role="switch" aria-label="允许院长安排小额扩建" aria-checked="${state.authority}" data-action="authority" ${!leader||catchingUp?'disabled':''}></button></div><p class="small-note">连续观察到候诊积压时，可启用第二诊室；始终保留 ¥30,000 运营储备。</p><div class="project">${project}</div><p class="small-note">管理层当前使用规则决策，尚未接入 LLM。</p>`);
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
    if(p)html+=`<span class="eyebrow">来到诊所的人</span><h2>${esc(p.name)}<small>${p.age} 岁</small></h2><span class="tag">${phaseLabel(p)}</span><p>${esc(p.thought)}</p><p class="small-note">${p.phase==='waiting'?'已候诊 '+Math.floor((state.time-p.waitStarted)/MINUTE)+' 分钟':CASES.find(c=>c.id===p.kind).label}</p>`;
    else if(staff)html+=`<span class="eyebrow">${staff.role}</span><h2>${staff.name}</h2><span class="tag">${staffStatus(staff.id)}</span><p>${staff.id==='director'?esc(state.directorThought):staff.description}</p>`;
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
  if(b.dataset.action==='authority')mutate(()=>setAuthority(state,!state.authority));
  if(b.dataset.action==='expand')mutate(()=>{const result=applyManagementAction(state,{action:'openSecondRoom'},'investor');notice(result.ok?'已委托周敏准备第二诊室。20 分钟后开始接诊。':result.reason);});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){currentPanel=null;selectPerson(null);renderUI(true);}});
$('zoom-in').onclick=()=>scene.changeZoom(1.2);$('zoom-out').onclick=()=>scene.changeZoom(1/1.2);$('reset-view').onclick=()=>scene.reset();
window.addEventListener('storage',e=>{if(e.key===KEY&&!leader&&e.newValue){try{state=restoreState(e.newValue);renderUI(true);}catch{ /* Keep last valid snapshot. */ }}});
document.addEventListener('visibilitychange',()=>{if(leader&&document.hidden)save();if(!document.hidden&&leader&&!catchingUp){offlineBefore=snapshot(state);catchUp(Date.now());}});
window.addEventListener('pageshow',e=>{if(e.persisted)takeOwnership();});
state=load();takeOwnership();
setInterval(()=>{if(!leader)takeOwnership();},3000);
$('hint').textContent='拖动观察 · 双指缩放';
setTimeout(()=>$('hint').classList.add('faded'),18000);
function frame(tick) {
  if(state){if(leader&&!catchingUp){const result=advanceTo(state,Date.now(),1000);if(!result.caughtUp)catchUp(Date.now());if(Date.now()-lastSave>3000)save();}scene.draw(state,tick);renderUI();}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
