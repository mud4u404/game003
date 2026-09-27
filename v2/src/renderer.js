import { primitives } from './primitives.js';
import { project } from './iso.js';
export function render(ctx,scene,nodes,camera,width,height,dpr,selected) {
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#86b36a';ctx.fillRect(0,0,width,height);
  ctx.translate(camera.x,camera.y);ctx.scale(camera.zoom,camera.zoom);ctx.lineJoin='round';ctx.lineCap='round';
  const r=primitives(ctx),{quad,poly,S,ell,rr}=r;
  // World-anchored grass: panning never makes the pattern swim over the ground.
  for(let i=0;i<400;i++) {const x=(i*71.3)%1000-500,y=(i*43.7)%1200-500;poly([[x,y],[x-1,y-3]],null,'rgba(70,120,55,.5)',.6);poly([[x+1.5,y],[x+2.2,y-2.6]],null,'rgba(70,120,55,.5)',.6);}
  const road=scene.outdoors.road,park=scene.outdoors.parking;
  quad(road.x,road.y,road.w,road.d,0,'#50555e');quad(road.x-.5,road.y,.5,road.d,0,'#cfccc4');quad(road.x+road.w,road.y,.5,road.d,0,'#cfccc4');
  for(let y=road.y;y<road.y+road.d;y+=1.6)quad(road.x+1.23,y,.14,.8,0,'#e8e5dc');
  quad(park.x,park.y,park.w,park.d,0,'#6a6f78');for(let y=park.y+.5;y<park.y+park.d;y+=1.4)quad(park.x,y,1.8,.07,0,'#e8e5dc');
  for(const p of scene.outdoors.paving)quad(p.x,p.y,p.w,p.d,0,'#d9d6ce');
  for(let x=9.4;x<12.3;x+=.7)quad(x,2.6,.02,4.2,0,'rgba(0,0,0,.08)');
  quad(10,3,2.1,.08,0,'#e0644a');quad(10,6.3,2.1,.08,0,'#e0644a');
  for(const room of scene.rooms) {
    const {x,y,w,d}=room;quad(x,y,w,d,0,room.color);
    for(let a=.5;a<w;a+=.5)poly([S(x+a,y),S(x+a,y+d)],null,room.grid,.35);
    for(let b=.5;b<d;b+=.5)poly([S(x,y+b),S(x+w,y+b)],null,room.grid,.35);
  }
  poly([S(.3,5.1),S(8.7,5.1)],null,'#5f9ccc',1.2);poly([S(.3,5.35),S(3.5,5.35)],null,'#6fbf8a',1.2);
  for(const f of scene.furniture){const n=nodes.find(n=>n.id.startsWith(f.id+':'));if(n){const b=n.bounds;r.shadowQ(b.x,b.y,b.w,b.d);}}
  for(const t of scene.outdoors.trees){const p=project(t.x,t.y);ell(p.x+3,p.y+1,12*t.scale,5*t.scale,'rgba(25,35,25,.22)');}
  for(const c of scene.outdoors.cars)r.shadowQ(c.x,c.y,c.type==='ambulance'?1.9:1.4,c.type==='ambulance'?.8:.7);
  if(selected) {const p=project(selected.x,selected.y,selected.z||0);ell(p.x,p.y,14,6,'rgba(242,201,76,.28)','#f2c94c',.9);}
  for(const node of nodes)node.draw(r);
  function chip(x,y,z,text,bg='rgba(31,40,52,.85)') {
    const p=project(x,y,z);ctx.font='9px system-ui, sans-serif';const w=ctx.measureText(text).width+10;
    rr(p.x-w/2,p.y-8,w,14,7,bg);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p.x,p.y-1);
  }
  for(const room of scene.rooms)chip(...room.label,0,room.name);
  chip(10.9,6.4,0,'急诊入口','rgba(224,100,74,.9)');
  if(selected)chip(selected.x,selected.y,selected.pose==='lie'?1:1.55,`${selected.name} · ${selected.role}`,'#d86548');
}
