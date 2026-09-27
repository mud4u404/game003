import {SITES} from './business.js';
// A small, selectable neighbourhood map using the established outlined 2D palette.
export function drawTown(scene,s,tick){const c=scene.ctx,w=scene.width,h=scene.height,scale=Math.min(w/690,h*(h<520?.34:.47)/620),ox=(w-690*scale)/2,oy=12;
  scene.townTransform={scale,ox,oy};scene.hits=[];scene.layers=[];
  c.setTransform(scene.dpr,0,0,scene.dpr,0,0);scene.box(0,0,w,h,'#a4b588');c.translate(ox,oy);c.scale(scale,scale);
  scene.box(0,0,690,620,'#a4b588');
  scene.box(0,405,690,67,'#81898b');scene.box(300,0,60,620,'#81898b');
  scene.box(0,393,690,12,'#d2d0c1');scene.box(0,472,690,12,'#d2d0c1');scene.box(287,0,13,620,'#d2d0c1');scene.box(360,0,13,620,'#d2d0c1');
  for(let x=5;x<690;x+=70)scene.box(x,437,28,3,'#e5e3d7');for(let y=10;y<620;y+=70)scene.box(328,y,3,28,'#e5e3d7');
  const building=(x,y,width,height,color)=>{scene.box(x+5,y+9,width,height,'#64747644',3);scene.box(x,y,width,height,'#65757d',3);scene.box(x+4,y-8,width-8,height-6,color,3);scene.line(x+9,y+5,x+width-9,y+5,'#eef0e780',3);for(let z=x+12;z<x+width-10;z+=24)scene.box(z,y+height-13,12,9,'#a7c0c3');};
  for(const [x,y,ww,hh] of [[27,35,90,57],[145,35,108,72],[402,30,83,72],[515,40,126,64],[36,157,82,60],[186,155,72,69],[399,131,88,64],[538,141,89,66],[34,510,89,62],[161,514,104,66],[420,510,80,70],[541,516,89,60]])building(x,y,ww,hh,'#c1c2b5');
  scene.text('青禾镇',50,124,23,'#435866','left',600);scene.text('社区卫生服务站',430,112,12,'#526873');
  const points={willow:[147,300],station:[451,355],garden:[548,269]};
  for(const [i,p] of SITES.entries()){const [x,y]=points[p.id],selected=s.venture.draft.site===p.id;building(x-55,y-30,110,68,selected?'#d9ddc7':'#b8c6b2');
    c.strokeStyle=selected?'#f9f4d9':'#4e6867';c.lineWidth=selected?4:2;c.strokeRect(x-61,y-43,122,92);
    scene.box(x-18,y-63,36,31,selected?'#385972':'#f0eee1',4);scene.text(String(i+1),x,y-41,18,selected?'#fff9e7':'#385972','center',600);
    scene.box(x-73,y+45,146,29,'#f1efdfed',3);scene.text(p.name,x,y+65,14,'#3f5867','center');
    scene.hits.push({id:'site:'+p.id,x,y:y+75,width:145,height:145,bottom:y+75});
  }
  for(const [x,y] of [[20,277],[75,373],[248,327],[612,354],[390,286],[664,536],[270,601],[652,160]])scene.tree(x,y,.42);
  const car=(tick/90)%760-60;scene.box(car,448,52,19,'#b9c8cc',5);scene.box(car+13,450,24,13,'#4e6977',3);
  scene.text('青禾路',340,615,11,'#536a63','center');
}
