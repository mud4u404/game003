import { fromScreen, project } from './iso.js';
export function inPolygon(p, points) {
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function personHit(person, point) {
  const p=project(person.x,person.y,person.z||0),x=(point.x-p.x)/1.7,y=(point.y-p.y)/1.7;
  if(person.pose==='lie') return ((point.x-p.x)/5)**2+((point.y-p.y)/4.7)**2<=1;
  const seated=person.pose==='seat',yb=seated?-9.5:-12.4,hy=yb-3.2;
  if((x/3.7)**2+((y-hy)/3.6)**2<=1)return true;
  return Math.abs(x)<=4.7&&y>=yb&&y<=yb+7.8 || !seated&&Math.abs(x)<=2.9&&y>=-5.8&&y<=.3;
}
// Reverse the same order used for painting; opaque foreground geometry blocks clicks.
export function pickPerson(screenPoint, camera, orderedNodes) {
  const p=fromScreen(screenPoint,camera);
  for(let i=orderedNodes.length-1;i>=0;i--) {
    const n=orderedNodes[i];
    if(n.person ? (n.pixelHit ? n.hit(p) : personHit(n.person,p)) : n.hit?.(p)) return n.person||null;
  }
  return null;
}
