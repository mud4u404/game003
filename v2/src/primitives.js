import { project, shade } from './iso.js';
export function primitives(g) {
const S = (x,y,z=0) => { const p=project(x,y,z); return [p.x,p.y]; };
const OL='rgba(45,52,64,.75)';
function poly(pts,fill,stroke,lw){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=lw||.5;g.stroke();}}
function quad(x,y,w,d,z,fill,stroke,lw){poly([S(x,y,z),S(x+w,y,z),S(x+w,y+d,z),S(x,y+d,z)],fill,stroke,lw);}
function box(x,y,z,w,d,h,col,o={}){
 const top=o.top||shade(col,1.08),L=o.left||shade(col,.9),R=o.right||shade(col,.76);
 poly([S(x,y+d,z),S(x+w,y+d,z),S(x+w,y+d,z+h),S(x,y+d,z+h)],L,OL,.45);
 poly([S(x+w,y,z),S(x+w,y+d,z),S(x+w,y+d,z+h),S(x+w,y,z+h)],R,OL,.45);
 quad(x,y,w,d,z+h,top,OL,.45);
}
function shadowQ(x,y,w,d){quad(x+.08,y+.12,w+.12,d+.12,0,'rgba(30,40,50,.18)');}
function ell(x,y,rx,ry,fill,stroke,lw){g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=lw||.5;g.stroke();}}
function rr(x,y,w,h,r,fill,stroke,lw){g.beginPath();g.roundRect(x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=lw||.5;g.stroke();}}
// 人物（屏幕坐标，脚底）
function person(px,py,o){const x=px,y=py,sc=1.7;g.save();g.translate(x,y);g.scale(sc,sc);
 const seated=o.pose==='seat',back=o.back;const L2=.32;
 ell(0,0,4.3,1.8,'rgba(25,30,40,.25)');
 const yb=seated?-9.5:-12.4;
 if(!seated){const s=o.walk?1:0;rr(-2.5,-5.3-s*.6,2.1,5.2+s*.6,.9,o.pants,OL,L2);rr(.4,-5.3+s*.4,2.1,5-s*.4,.9,o.pants,OL,L2);
  rr(-2.8,-1.2-s*.6,2.6,1.4,.6,'#2e3038');rr(.3,-1.2,2.6,1.4,.6,'#2e3038');}
 else{rr(-3,yb+6.4,6,2.6,1.1,o.pants,OL,L2);}
 const coat=o.coat,top=coat||o.shirt;
 rr(-4.7,yb+1.2,1.8,5.3,.9,top,OL,L2);rr(2.9,yb+1.2,1.8,5.3,.9,top,OL,L2);
 if(!back){ell(-3.8,yb+6.7,.9,.9,o.skin);ell(3.8,yb+6.7,.9,.9,o.skin);}
 rr(-3.5,yb,7,coat&&!seated?8.9:7.2,2.4,top,OL,L2);
 g.fillStyle='rgba(0,0,0,.1)';g.beginPath();g.roundRect(1.2,yb+.6,2,coat&&!seated?7.9:6.2,1);g.fill();
 if(coat&&!back){g.beginPath();g.moveTo(-1.3,yb+.2);g.lineTo(0,yb+2.6);g.lineTo(1.3,yb+.2);g.fillStyle=o.shirt;g.fill();
  if(o.steth){g.strokeStyle='#3b4452';g.lineWidth=.35;g.beginPath();g.moveTo(-1.6,yb+.4);g.quadraticCurveTo(-2.2,yb+4,-.6,yb+4.4);g.stroke();ell(-.4,yb+4.5,.55,.55,'#8a96a6');}}
 if(o.cross&&!back){g.fillStyle='#fff';g.fillRect(-2.6,yb+2,1.6,.5);g.fillRect(-2.05,yb+1.45,.5,1.6);}
 const hy=yb-3.2;ell(0,hy,3.7,3.6,back?o.hair:o.skin,OL,L2);
 if(!back){g.beginPath();g.ellipse(0,hy-.5,3.7,3.1,0,Math.PI*1.02,Math.PI*1.98);g.quadraticCurveTo(2.4,hy-.6,1.2,hy-1.1);g.quadraticCurveTo(-.5,hy-.3,-3.6,hy-.2);g.fillStyle=o.hair;g.fill();g.strokeStyle=OL;g.lineWidth=L2;g.stroke();
  ell(-1.25,hy+.9,.42,.5,'#2a2522');ell(1.25,hy+.9,.42,.5,'#2a2522');}
 g.restore();}

return { S, poly, quad, box, shadowQ, ell, rr, person };
}
