import { scene } from './layout.js';
import { buildScene } from './catalog.js';
import { render } from './renderer.js';
import { pickPerson } from './picking.js';
import { defaultCamera, constrain, bindCamera, invalidator } from './camera.js';
const canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
const panel=document.querySelector('#panel'),title=document.querySelector('#panel-title'),role=document.querySelector('#panel-role'),text=document.querySelector('#panel-text');
const nodes=buildScene(scene);
let camera,width=0,height=0,dpr=1,selected=null;
const invalidate=invalidator(()=>{
  render(ctx,scene,nodes,camera,width,height,dpr,selected);
  canvas.dataset.frames=String(Number(canvas.dataset.frames||0)+1);
});
function resize(){
  const rect=canvas.getBoundingClientRect(),nextDpr=window.devicePixelRatio||1;
  if(width===rect.width&&height===rect.height&&dpr===nextDpr)return;
  const oldWidth=width,oldHeight=height;width=rect.width;height=rect.height;dpr=nextDpr;
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  if(!camera)camera=defaultCamera(width,height);
  else{const next=defaultCamera(width,height);camera.x+= (width-oldWidth)/2;camera.y+=(height-oldHeight)/2;camera.zoom*=next.base/camera.base;camera.base=next.base;constrain(camera,width,height);}
  invalidate();
}
function active(name){for(const b of document.querySelectorAll('.nav button'))b.setAttribute('aria-pressed',String(b.dataset.panel===name));}
function close(){selected=null;panel.hidden=true;active('医院');invalidate();}
function select(point){
  selected=pickPerson(point,camera,nodes);active('医院');
  panel.hidden=!selected;
  if(selected){title.textContent=selected.name;role.textContent=selected.role+' · 人物资料';text.textContent='诊疗详情将在后续任务接入。';}
  invalidate();
}
bindCamera(canvas,()=>camera,()=>({width,height}),invalidate,select);
for(const button of document.querySelectorAll('[data-panel]'))button.addEventListener('click',()=>{
  const name=button.dataset.panel;if(name==='医院'){close();return;}
  selected=null;active(name);title.textContent=name;role.textContent='即将开放';text.textContent='此功能将在后续任务接入。';panel.hidden=false;invalidate();
});
document.querySelector('#close').addEventListener('click',close);
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize',resize);
// devicePixelRatio may change without a CSS resize when moving between displays.
function watchDpr(){const query=matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);query.addEventListener('change',()=>{resize();watchDpr();},{once:true});}
watchDpr();resize();
