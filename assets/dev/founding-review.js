// Isolated visual fixture. Never imports app.js or reads/writes browser storage.
import {createVenture,advanceTo,applyManagementAction} from '../../src/simulation.js';
import {configureDraft,signPlan,openVenture,enableService,hireOperating,relocate} from '../../src/business.js';
import {FoundingUI,businessPanel} from '../../src/founding-ui.js';
import {ClinicScene} from '../../src/scene.js';
const $=id=>document.getElementById(id),s=createVenture(Date.parse('2026-09-28T08:00:00+08:00'),741),ui=new FoundingUI($('founding'));
const scene=new ClinicScene($('scene'),id=>{if(id?.startsWith('site:'))configureDraft(s,'site',id.slice(5));render();},()=>{});
let business=false;
function run(to){while(!advanceTo(s,to).caughtUp){}render();}
function render(){const planning=!['open','moving'].includes(s.venture.stage);$('game').classList.toggle('is-planning',planning);$('founding').hidden=!planning;$('cash').textContent='¥'+s.cash.toLocaleString();$('clock').textContent=new Date(s.time).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai'});$('live-label').textContent=s.venture.stage;$('panel').hidden=planning||!business;if(planning)ui.render(s,true,false);else $('panel').innerHTML=businessPanel(s,true,false);}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;let result;
 if(b.dataset.planStep!==undefined)ui.go(b.dataset.planStep);
 if(b.dataset.planKind)result=configureDraft(s,b.dataset.planKind,b.dataset.planValue);
 if(b.dataset.ventureAction){const a=b.dataset.ventureAction;result=a==='sign'?signPlan(s):a==='open'?openVenture(s):a==='service'?enableService(s,b.dataset.value):a==='hire'?hireOperating(s,b.dataset.value):relocate(s,b.dataset.value);}
 if(b.dataset.action)result=applyManagementAction(s,{action:b.dataset.action==='expand'?'openSecondRoom':b.dataset.action},'investor');
 if(b.dataset.panel)business=!business;
 if(result&&!result.ok){$('notice').hidden=false;$('notice').textContent=result.reason;}
 render();
});
$('ready-test').onclick=()=>{if(s.venture.stage==='fitting')run(s.venture.readyAt);};
$('operate-test').onclick=()=>{if(s.venture.stage==='open')run(Math.max(s.time,Date.parse('2026-09-28T11:00:00+08:00')));};
function frame(tick){scene.draw(s,tick);requestAnimationFrame(frame);}render();requestAnimationFrame(frame);
