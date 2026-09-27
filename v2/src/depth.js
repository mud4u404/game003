import { project } from './iso.js';
const EPS=1e-7;
export function depthKey(b) { return b.x + b.y + (b.w + b.d) / 2 + (b.z || 0) * .01; }
export function hull(b) {
  const {x,y,w,d}=b,z=b.z||0,h=b.h||0;
  return [[x,y,z+h],[x+w,y,z+h],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y+d,z+h]].map(([a,c,e])=>project(a,c,e));
}
function screenBounds(b) { const points=hull(b); return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}; }
// Disjoint world extents establish precedence, rather than an object's centre.
// This is essential for people at either end of a long desk or counter.
export function relation(a,b) {
  const before = a.x+a.w<=b.x+EPS || a.y+a.d<=b.y+EPS || (a.z||0)+a.h<=(b.z||0)+EPS;
  const after = b.x+b.w<=a.x+EPS || b.y+b.d<=a.y+EPS || (b.z||0)+b.h<=(a.z||0)+EPS;
  return before===after ? 0 : before ? -1 : 1;
}
export function sortNodes(nodes) {
  const base=[...nodes].sort((a,b)=>depthKey(a.bounds)-depthKey(b.bounds)||a.id.localeCompare(b.id));
  const rects=base.map(n=>n.screenBounds||screenBounds(n.bounds)), edges=base.map(()=>[]), counts=base.map(()=>0);
  for(let i=0;i<base.length;i++) for(let j=i+1;j<base.length;j++) {
    const a=rects[i],b=rects[j];
    if(a.right<b.left||b.right<a.left||a.bottom<b.top||b.bottom<a.top) continue;
    const r=relation(base[i].bounds,base[j].bounds);
    if(r) { const from=r<0?i:j,to=r<0?j:i; edges[from].push(to);counts[to]++; }
  }
  const result=[],remaining=new Set(base.map((_,i)=>i));
  while(remaining.size) {
    // Stable fallback for intersecting volumes/cycles. Long walls are split before here.
    const i=[...remaining].find(i=>counts[i]===0)??remaining.values().next().value;
    remaining.delete(i);result.push(base[i]);for(const j of edges[i])counts[j]--;
  }
  return result;
}
export function wallSegments(wall, doors, size=.5) {
  const openings=doors.filter(d=>d.wall===wall.id);
  const cuts=new Set([0,wall.length,...openings.flatMap(d=>[d.offset,d.offset+d.width])]);
  for(let a=size;a<wall.length;a+=size) cuts.add(a);
  const points=[...cuts].filter(a=>a>=0&&a<=wall.length).sort((a,b)=>a-b);
  return points.slice(0,-1).flatMap((a,i)=>openings.some(d=>a>=d.offset-EPS&&a<d.offset+d.width-EPS)?[]:[{offset:a,length:points[i+1]-a}]);
}
