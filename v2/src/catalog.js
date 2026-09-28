import { project, shade } from './iso.js';
import { hull, wallSegments, sortNodes } from './depth.js';
import { inPolygon } from './picking.js';
import { appearances } from './layout.js';

// Reusable furniture types build separate physical parts, never hard-coded sort keys.
export function buildScene(scene) {
  const nodes=[];
  let owner='',part=0,ox=0,oy=0,orientation=0;
  const at=(x,y)=>orientation?{x:ox+y,y:oy+x}:{x:ox+x,y:oy+y};
  const add=(bounds,draw,extra={})=>{const points=hull(bounds);nodes.push({id:`${owner}:${part++}`,bounds,draw,hit:p=>inPolygon(p,points),...extra});};
  const box=(x,y,z,w,d,h,color,options={})=>{
    const p=at(x,y);if(orientation)[w,d]=[d,w];
    add({...p,z,w,d,h},r=>r.box(p.x,p.y,z,w,d,h,color,options));
  };
  const surface=(x,y,z,w,d,color)=>box(x,y,z,w,d,.005,color,{top:color});
  const detail=(bounds,draw)=>{const p=at(bounds.x,bounds.y);add({...bounds,...p},draw);};
  const plant=()=>{
    box(0,0,0,.45,.45,.25,'#c79a66');
    const p=at(.22,.22),s=project(p.x,p.y,.25);
    add({...p,x:p.x-.14,y:p.y-.14,w:.28,d:.28,z:.25,h:.4},r=>{r.ell(s.x,s.y-6,7,5,'#4f9446','rgba(45,52,64,.75)',.4);r.ell(s.x-2,s.y-8,3,2.5,'#6fb65e');});
  };
  for(const wall of scene.walls) {
    owner=wall.id;part=0;ox=wall.x;oy=wall.y;orientation=0;
    for(const segment of wallSegments(wall,scene.doors)) {
      const a=segment.offset,l=segment.length,h=wall.height,axis=wall.axis;
      const x=wall.x+(axis==='x'?a:-.14),y=wall.y+(axis==='y'?a:-.14),w=axis==='x'?l:.14,d=axis==='y'?l:.14;
      add({x,y,w,d,z:0,h},r=>{
        r.box(x,y,0,w,d,h,'#eef0f2',scene.clean?{left:'#f7faf9',right:'#d9e6e2',top:'#ffffff'}:{left:axis==='x'?'#e9ebee':'#e3e6e9',right:'#dfe2e6',top:'#5a626d'});
        const face=(lo,hi,z0,z1,color,stroke)=>r.poly((axis==='x'?[[x+lo,wall.y,z0],[x+hi,wall.y,z0],[x+hi,wall.y,z1],[x+lo,wall.y,z1]]:[[wall.x,y+lo,z0],[wall.x,y+hi,z0],[wall.x,y+hi,z1],[wall.x,y+lo,z1]]).map(p=>r.S(...p)),color,stroke,.4);
        if(wall.dado&&h>.6)face(0,l,0,scene.clean?.18:.38,scene.clean?'#229f91':'#cfe3de');
        if(wall.windows?.some(([start,end])=>a>=start&&a<end))face(.08,l-.08,.55,1.02,'#a9cfe6','rgba(60,90,110,.6)');
      });
    }
  }
  if(scene.clean)for(const door of scene.doors) {
    const wall=scene.walls.find(w=>w.id===door.wall);owner=door.id;part=0;orientation=0;
    ox=wall.x+(wall.axis==='x'?door.offset:0);oy=wall.y+(wall.axis==='y'?door.offset:0);
    if(wall.axis==='x') {box(0,0,0,.08,.14,1.6,'#74c8bb');box(door.width-.08,0,0,.08,.14,1.6,'#74c8bb');box(0,0,1.5,door.width,.14,.1,'#85d4c8');}
    else {box(0,0,0,.14,.08,1.6,'#74c8bb');box(0,door.width-.08,0,.14,.08,1.6,'#74c8bb');box(0,0,1.5,.14,door.width,.1,'#85d4c8');}
  }
  for(const door of scene.doors.filter(d=>d.type==='glass')) {
    const wall=scene.walls.find(w=>w.id===door.wall);owner=door.id;part=0;ox=wall.x-.05;oy=wall.y+door.offset;orientation=wall.axis==='x'?1:0;
    box(0,0,0,.1,.12,door.height,'#9aa3ad');box(0,door.width-.12,0,.1,.12,door.height,'#9aa3ad');box(0,0,door.height,.1,door.width,.035,'#9aa3ad');
    // Glass is transparent to hit testing, so visible people behind it remain selectable.
    const p=at(.05,.12),q=at(.05,door.width-.12);
    add({x:p.x,y:p.y,w:.01,d:door.width-.24,z:0,h:door.height},r=>r.poly([r.S(p.x,p.y),r.S(q.x,q.y),r.S(q.x,q.y,door.height),r.S(p.x,p.y,door.height)],'rgba(160,205,230,.45)','rgba(60,90,110,.5)',.4),{hit:()=>false});
  }
  for(const f of scene.furniture) {
    owner=f.id;part=0;ox=f.x;oy=f.y;orientation=f.orientation;
    switch(f.type) {
      case 'cabinet':box(0,0,0,f.w,f.d,f.h,f.color||'#e8eaed');break;
      case 'sink':box(0,0,0,.7,.4,.42,'#e8eaed');surface(.15,.07,.425,.4,.26,'#a9c7da');break;
      case 'exam-bed':box(0,0,0,.6,1.8,.3,'#2f4a6e',{top:'#3a5a86'});box(.05,.05,.3,.5,.45,.06,'#f7f9fb');break;
      case 'desk':box(0,0,0,1.4,.65,.42,'#f4f3ef',{top:'#fbfaf6'});box(.25,.05,.42,.08,.4,.3,'#2e3440',{right:'#5d8fb3'});surface(.8,.25,.43,.35,.25,'#fbf8f0');break;
      case 'stool':box(0,0,0,.45,.45,.2,'#2f4a6e');break;
      case 'plant':plant();break;
      case 'lab-counter':
        box(0,0,0,3.2,.45,.42,'#f3f5f7',{top:'#fbfcfd'});box(.2,.05,.42,.25,.25,.28,'#3b4452');
        ['#d9573f','#6fa3c9','#d6a23f','#7b9a58'].forEach((c,i)=>box(.8+i*.16,.13,.42,.1,.1,.2,c));
        box(1.8,.05,.42,.45,.3,.18,'#dfe3e8');break;
      case 'fridge':box(0,0,0,.8,.55,1.05,'#eef0f2');box(.8,.15,.88,.01,.3,.025,'#8a96a6');break;
      case 'lab-table':box(0,0,0,2,.6,.42,'#f3f5f7',{top:'#fbfcfd'});box(.3,.05,.42,.45,.35,.22,'#e3e7ec');surface(.38,.1,.645,.28,.2,'#7fbf8f');box(1.3,.15,.42,.5,.3,.05,'#b9cfdf');break;
      case 'sample-chair':box(0,0,0,.5,.5,.22,'#2f4a6e');box(.5,.05,.22,.3,.1,.05,'#eef0f2');break;
      case 'reception':box(0,0,0,2.2,.55,.46,'#f4f3ef',{top:'#fbfaf6'});box(.4,.02,.46,.08,.35,.26,'#2e3440',{right:'#5d8fb3'});break;
      case 'chair':box(0,0,0,.48,.45,.18,'#2f4a6e',{top:'#3a5a86'});box(0,0,.18,.48,.1,.3,'#2f4a6e',{top:'#3a5a86'});break;
      case 'water':box(0,0,0,.4,.3,.85,'#eef0f2');box(.4,.05,.45,.01,.2,.25,'#6fa3c9');break;
      case 'xray-bed':box(0,0,0,2,.75,.36,'#eef0f2');surface(.1,.05,.37,1.8,.6,'#2f4a6e');surface(.15,.1,.38,.45,.5,'#f7f9fb');break;
      case 'xray-machine':box(1.6,0,0,.25,.25,1.25,'#e3e7ec');box(0,.05,1.1,1.85,.2,.12,'#e3e7ec');box(.2,.6,.78,.45,.45,.32,'#f5f7f9');break;
      case 'xray-control':
        box(0,0,0,1.05,.08,.34,'#dfe2e6');
        detail({x:0,y:.08,w:1.05,d:.01,z:.34,h:.61},r=>r.poly([r.S(f.x,f.y+.08,.34),r.S(f.x+1.05,f.y+.08,.34),r.S(f.x+1.05,f.y+.08,.95),r.S(f.x,f.y+.08,.95)],'rgba(150,200,225,.5)','rgba(60,90,110,.6)',.4));
        nodes.at(-1).hit=()=>false;
        box(.2,.4,0,.8,.4,.38,'#f4f3ef');box(.4,.42,.38,.06,.3,.24,'#2e3440',{right:'#5d8fb3'});break;
      case 'warning':box(0,0,.34,.5,.06,.1,'#e0644a');break;
      case 'bed':box(0,0,0,.75,1.5,.36,'#eef0f2');box(.1,.08,.36,.55,.38,.08,'#fbfcfd');box(.05,.6,.36,.65,.85,.06,'#7fb3d9',{top:'#9cc6e3'});break;
      case 'iv':box(-.02,-.02,0,.04,.04,1.1,'#9aa3ad');box(-.05,-.03,.85,.1,.06,.2,'#d6ecf7');break;
      default:throw new Error(`Unknown furniture: ${f.type}`);
    }
  }
  for(const person of scene.people) {
    owner=person.id;part=0;const p=project(person.x,person.y,person.z||0),look=appearances[person.appearance];
    const seated=person.pose==='seat',lying=person.pose==='lie';
    add({x:person.x-.09,y:person.y-.09,w:.18,d:.18,z:lying?.45:seated?.21:0,h:lying?.1:seated?.65:1.05},r=>{
      if(lying){r.ell(p.x,p.y-1,4.6,4.2,look.hair,'rgba(45,52,64,.75)',.4);r.ell(p.x-.3,p.y+.4,3.6,2.8,look.skin);}
      else r.person(p.x,p.y,{...look,pose:person.pose,back:person.back,walk:person.pose==='walk'});
    },{person,screenBounds:{left:p.x-8,right:p.x+8,top:p.y-(lying?6:seated?28:34),bottom:p.y+2}});
  }
  for(const car of scene.outdoors.cars) {
    owner=car.id;part=0;ox=car.x;oy=car.y;orientation=0;
    if(car.type==='ambulance') {
      box(0,0,0,1.9,.8,.62,'#f7f9fb');box(1.5,.05,.1,.4,.7,.42,'#e8ecf0',{top:'#a9cfe6'});
      box(0,.8,.25,1.5,.008,.08,'#e0644a');box(1.9,0,.25,.008,.8,.08,'#e0644a');box(.6,.3,.62,.3,.2,.1,'#5f9ccc');
      const p=project(ox+.6,oy+.4,.63);
      detail({x:.48,y:.34,w:.24,d:.12,z:.63,h:.02},r=>{r.rr(p.x-3,p.y-1,6,2,0,'#e0644a');r.rr(p.x-1,p.y-3,2,6,0,'#e0644a');});
      for(const x of [.3,1.5]) {const q=project(ox+x,oy+.8,.08);detail({x:x-.05,y:.8,w:.1,d:.1,z:0,h:.2},r=>{r.ell(q.x,q.y,3.2,3.6,'#2e3038');r.ell(q.x,q.y,1.4,1.6,'#9aa3ad');});}
    } else {
      orientation=car.orientation;box(0,0,0,.7,1.4,.32,car.color);box(.08,.3,.32,.54,.75,.22,'#bcd3e2',{top:shade(car.color,1.1)});
    }
  }
  for(const tree of scene.outdoors.trees) {
    owner=tree.id;part=0;const p=project(tree.x,tree.y),s=tree.scale;
    add({x:tree.x-.25,y:tree.y-.25,w:.5,d:.5,z:0,h:1.2*s},r=>{r.rr(p.x-1.5*s,p.y-12*s,3*s,12*s,1,'#7a5536');r.ell(p.x,p.y-22*s,12*s,11*s,'#3f7a3c','rgba(45,52,64,.75)',.4);r.ell(p.x-4*s,p.y-19*s,7*s,6*s,'#4a8c44');r.ell(p.x+3*s,p.y-26*s,6*s,5*s,'#5aa351');r.ell(p.x-3*s,p.y-27*s,3.5*s,3*s,'#76bf66');},{
      screenBounds:{left:p.x-12*s,right:p.x+12*s,top:p.y-33*s,bottom:p.y},
      hit:q=>((q.x-p.x)/(12*s))**2+((q.y-p.y+22*s)/(11*s))**2<=1||Math.abs(q.x-p.x)<=1.5*s&&q.y>=p.y-12*s&&q.y<=p.y,
    });
  }
  return sortNodes(nodes);
}
