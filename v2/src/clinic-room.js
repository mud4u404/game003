// T004 uses the same projection, geometry sorter, renderer, camera and picker as the game.
// This explicit art preview has no simulation and never reads/writes a player save.
import {buildScene} from './catalog.js';
import {sortNodes} from './depth.js';
import {render} from './renderer.js';
import {loadSprites,spriteNode} from './sprites.js';
import {pickPerson} from './picking.js';
import {bindCamera,invalidator} from './camera.js';

const $=s=>document.querySelector(s),canvas=$('#scene'),ctx=canvas.getContext('2d');
const scene={clean:true,rooms:[
 {id:'consult',name:'内科诊室',x:0,y:0,w:4,d:4,color:'#f7f9f8',grid:'rgba(121,153,145,.15)',label:[.7,3.8]},
 {id:'hall',name:'候诊走廊',x:0,y:4,w:4,d:1.6,color:'#f7f9f8',grid:'rgba(121,153,145,.21)',label:[2.8,5.4]},
],walls:[
 {id:'north',axis:'x',x:0,y:0,length:4,height:1.6,dado:true},
 {id:'west',axis:'y',x:0,y:0,length:4,height:1.6,dado:true},
 {id:'front',axis:'x',x:0,y:4,length:4,height:.17,dado:true},
],doors:[{id:'door',wall:'front',offset:2.8,width:.95}],people:[],furniture:[],outdoors:{trees:[],cars:[]}};
const people=[
 {id:'preview-doctor',name:'陈医生',role:'医生',x:2.1,y:1.12,pose:'seat',asset:'doctor-seat-front'},
 {id:'preview-patient',name:'就诊患者',role:'患者',x:2.1,y:2.48,pose:'seat',asset:'patient-seat-back'},
 {id:'preview-waiting',name:'候诊患者',role:'患者',x:3.25,y:4.65,pose:'stand',asset:'patient-stand-front'},
];
const items=[
 ['desk',2.1,1.8],['monitor',2.3,1.75,.52],['doctor-chair',2.1,1.07],['patient-chair',2.1,2.45],
 ['exam-bed',.65,1.6],['cabinet',2,.3],['sink',3.3,.35],['plant',3.5,2.8],['lightbox',1.5,.02,1],
 ['patient-chair',.8,4.8],['patient-chair',1.5,4.8],
];
let width=0,height=0,dpr=1,camera,selected=null,nodes=[];
const invalidate=invalidator(()=>{render(ctx,scene,nodes,camera,width,height,dpr,selected);canvas.dataset.frames=String(Number(canvas.dataset.frames||0)+1)});
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=devicePixelRatio||1;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const scale=Math.min(width/390,height/724);camera={x:width*.56,y:height*.33,zoom:1.42*scale,base:scale,bounds:[0,0,4,5.6]};invalidate()}
function close(){selected=null;$('#panel').hidden=true;invalidate()}
bindCamera(canvas,()=>camera,()=>({width,height}),invalidate,p=>{
 const hit=pickPerson(p,camera,nodes);if(!hit)return close();selected=hit;
 $('#panel-body').innerHTML=`<h2>${hit.name}</h2><p>${hit.role} · ${hit.pose==='seat'?'就坐':'站立候诊'}</p><p>诊室美术预览人物。正式病历请返回医院查看。</p>`;
 $('#back').hidden=true;$('#panel').hidden=false;invalidate();
});
$('#close').onclick=close;
for(const b of document.querySelectorAll('[data-panel]'))b.onclick=()=>location.assign('/v2/');
$('#clock').textContent='诊室美术预览';$('#status').textContent='风格验证';$('#cash').textContent='—';
$('.help').textContent='拖动查看 · 双指缩放 · 点人物查看';
const banner=$('#banner');banner.hidden=false;banner.textContent='正在加载诊室素材…';
resize();new ResizeObserver(resize).observe(canvas);
try{
 const assets=await loadSprites();
 nodes=sortNodes([...buildScene(scene),...items.map(([asset,x,y,z=0],i)=>spriteNode(assets.get(asset),{id:`sprite-${i}`,x,y,z})),...people.map(p=>spriteNode(assets.get(p.asset),{...p,person:p}))]);
 banner.textContent='美术预览 · 不影响医院存档';invalidate();
}catch(e){banner.textContent=`素材加载失败：${e.message}`;throw e}
