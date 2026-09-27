import { fromScreen, project, toScreen } from './iso.js';
import { inPolygon } from './picking.js';
export function defaultCamera(width,height) { const scale=Math.min(width/390,height/724);return {x:width/2,y:190*scale,zoom:scale,base:scale}; }
export function constrain(camera,width,height) {
  camera.zoom=Math.max(camera.base*.65,Math.min(camera.base*3.5,camera.zoom));
  // Clamp against the hospital diamond, not its rectangular bounding box: the
  // corners of that box are empty and could otherwise leave the building lost.
  const margin=Math.min(100,width*.3,height*.3),center={x:width/2,y:height/2};
  const polygon=[[0,0],[9,0],[9,9],[0,9]].map(([x,y])=>toScreen(project(x,y),camera));
  if(!inPolygon(center,polygon)) {
    let nearest=null,distance=Infinity;
    for(let i=0;i<4;i++) {
      const a=polygon[i],b=polygon[(i+1)%4],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((center.x-a.x)*dx+(center.y-a.y)*dy)/(dx*dx+dy*dy)));
      const p={x:a.x+t*dx,y:a.y+t*dy},d=Math.hypot(p.x-center.x,p.y-center.y);
      if(d<distance){nearest=p;distance=d;}
    }
    camera.x+=Math.max(margin,Math.min(width-margin,nearest.x))-nearest.x;
    camera.y+=Math.max(margin,Math.min(height-margin,nearest.y))-nearest.y;
  }
  return camera;
}
export function zoomAt(camera,point,factor,width,height) {
  const world=fromScreen(point,camera);
  camera.zoom=Math.max(camera.base*.65,Math.min(camera.base*3.5,camera.zoom*factor));
  camera.x=point.x-world.x*camera.zoom;camera.y=point.y-world.y*camera.zoom;
  return constrain(camera,width,height);
}
// Coalesce events into one frame, with no self-scheduling animation loop.
export function invalidator(draw,request=cb=>requestAnimationFrame(cb)) {
  let pending=false;
  return ()=>{if(pending)return;pending=true;request(()=>{pending=false;draw();});};
}
export function bindCamera(canvas,getCamera,size,invalidate,onSelect) {
  const pointers=new Map();let last=null,gesture=false,moved=false,start=null;
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  const snapshot=()=>{
    const ps=[...pointers.values()];if(ps.length===1)return {...ps[0],distance:0};
    return {x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2,distance:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)};
  };
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    const p=point(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
    if(pointers.size===1){start=p;moved=false;gesture=false;}else{gesture=true;moved=true;}
    last=snapshot();
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,point(e));const next=snapshot(),c=getCamera(),{width,height}=size();
    if(Math.hypot(next.x-start.x,next.y-start.y)>6)moved=true;
    if(next.distance&&last.distance)zoomAt(c,last,next.distance/last.distance,width,height);
    if(moved){c.x+=next.x-last.x;c.y+=next.y-last.y;constrain(c,width,height);invalidate();}
    last=next;
  });
  const end=(e,cancelled=false)=>{
    if(!pointers.has(e.pointerId))return;
    if(!cancelled&&!moved&&!gesture)onSelect(point(e));
    pointers.delete(e.pointerId);if(cancelled)gesture=true;
    last=pointers.size?snapshot():null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup',e=>end(e));canvas.addEventListener('pointercancel',e=>end(e,true));
  canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))end(e,true);});
  canvas.addEventListener('wheel',e=>{e.preventDefault();const {width,height}=size();zoomAt(getCamera(),point(e),Math.exp(-e.deltaY*.0015),width,height);invalidate();},{passive:false});
}
