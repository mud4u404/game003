// Isolated visual fixture. Never imports app.js or reads/writes browser storage.
import {createVenture,advanceTo,applyManagementAction,setAuthority,restoreState} from '../../src/simulation.js';
import {configureDraft,signPlan,openVenture,enableService,hireOperating,relocate,launchVenture,clinicAt} from '../../src/business.js';
import {FoundingUI,businessPanel} from '../../src/founding-ui.js';
import {ClinicScene} from '../../src/scene.js';
const $=id=>document.getElementById(id),ui=new FoundingUI($('founding'));
let s=createVenture(Date.parse('2026-09-27T23:30:00+08:00'),741);
if(new URLSearchParams(location.search).get('case')==='old-fitting'){
 for(const [kind,id] of [['site','willow'],['model','general'],['staff','lin'],['staff','chen'],['staff','he']])configureDraft(s,kind,id);
 signPlan(s);s.venture.version=1;s.venture.stage='fitting';s.venture.readyAt=s.time+30*60000;delete s.venture.clockOffset;delete s.venture.openingDue;delete s.venture.openingRequests;s=restoreState(JSON.stringify(s));
}
const scene=new ClinicScene($('scene'),id=>{if(id?.startsWith('site:'))configureDraft(s,'site',id.slice(5));render();},()=>{});
let business=false;
function run(to){while(!advanceTo(s,to).caughtUp){}render();}
function render(){const planning=!['open','moving'].includes(s.venture.stage);$('game').classList.toggle('is-planning',planning);$('founding').hidden=!planning;$('cash').textContent='¥'+s.cash.toLocaleString();$('clock').textContent=new Date(clinicAt(s)).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai'});$('live-label').textContent=s.venture.stage==='ready'?'可以开业':s.venture.stage==='open'?'接诊中':'方案配置中';$('panel').hidden=planning||!business;if(planning)ui.render(s,true,false);else $('panel').innerHTML=businessPanel(s,true,false);}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;let result;
 if(b.dataset.planStep!==undefined)ui.go(b.dataset.planStep);
 if(b.dataset.planKind)result=configureDraft(s,b.dataset.planKind,b.dataset.planValue);
 if(b.dataset.ventureAction){const a=b.dataset.ventureAction;result=a==='sign'?launchVenture(s):a==='open'?openVenture(s):a==='service'?enableService(s,b.dataset.value):a==='hire'?hireOperating(s,b.dataset.value):relocate(s,b.dataset.value);}
 if(b.dataset.action==='authority'){setAuthority(s,!s.authority);render();return;}
 if(b.dataset.action)result=applyManagementAction(s,{action:b.dataset.action==='expand'?'openSecondRoom':b.dataset.action},'investor');
 if(b.dataset.panel)business=!business;
 if(result&&!result.ok){$('notice').hidden=false;$('notice').textContent=result.reason;}
 render();
});
$('operate-test').onclick=()=>{if(s.venture.stage==='open')run(s.time+2*60000);};
function frame(tick){if(s.venture.openingDue===s.time)run(s.time+1);scene.draw(s,tick);requestAnimationFrame(frame);}render();requestAnimationFrame(frame);
