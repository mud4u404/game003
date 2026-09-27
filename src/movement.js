import { FIXED_SEATS, waitingSeat, seatFloor } from './seating.js';
// Fixed-clinic navigation and deterministic choreography shared by the engine and renderer.
export const WALK_SPEED = 70;
export const STAND_MS = 650;
export const SIT_MS = 550;
export const ROOM_POS = { 1: [255, 270], 2: [515, 270] };
export const STAFF_POS = { doctor1: seatFloor(FIXED_SEATS.doctor1), doctor2: seatFloor(FIXED_SEATS.doctor2), nurse: [249, 543], reception: seatFloor(FIXED_SEATS.reception), director: [290, 765], pharmacist: [465, 537] };
export const PHARMACY_POS = [433, 621];
export const NURSING_POS = [201, 583];
export const NURSE_CARE_POS = [245, 590];
export const SAMPLE_POS = [815, 583], SAMPLE_STAFF_POS = [855,590], ANNEX_HOME = [865,543];
export const URGENT_POS = [287,748], URGENT_STAFF_POS = [245,748];
export const ENTRY = [335, 1008];
export const DESK = [190, 883];
export const seatPosition = i => { const s=waitingSeat(i); return [s.x,s.y]; };
export const seatFeet = i => { const [x,y] = seatPosition(i); return [x,y+27]; };
export const registrationSlot = i => [[255,880],[287,879],[287,845],[287,811]][Math.min(i,3)];
export const nursingSlot = i => [160 + i * 42, 692];
const BOXES = [
  // Room walls, including the side corridor walls missing from the old rendering.
  [54,327,212,357],[265,327,472,357],[525,327,584,357],
  [310,124,324,327],[572,124,584,357],
  [54,410,584,436],[310,436,324,637],[572,436,584,667],
  [54,637,221,667],[274,637,407,667],[460,637,584,667],
  // Clinical furniture footprints. Head/upper-body overlap is resolved by depth sorting.
  [70,190,136,301],[123,227,219,281],[226,153,303,194],
  [330,190,396,301],[383,227,479,281],[486,153,562,194],
  [83,492,149,610],[233,480,308,525],[260,585,303,618],
  [404,553,523,596],[523,470,570,517],
  [81,788,266,855],
  // Clinical chairs, approached from their open front edge.
  [234,233,276,256],[494,233,536,256],[180,546,222,569],
  ...Array.from({length:16},(_,i)=>{const [x,y]=seatPosition(i);return [x-21,y-9,x+21,y+14];})
];
export const ANNEX_BOXES=[[650,410,958,436],[947,436,959,667],[650,637,813,667],[866,637,959,667],[680,480,770,530],[794,546,836,569],[885,480,940,525]];
export const OBSTACLES = BOXES;
const RADIUS = 7, STEP = 8, COLS = 124, ROWS = 132;
export function isWalkable(x,y,margin=0,annex=false) {
  const inside = (x>=65+margin && x<=617-margin && y>=126+margin && y<=905-margin) ||
    (x>=297+margin && x<=371-margin && y>=900+margin && y<=1020-margin) || (x>=270 && x<=405 && y>=941 && y<=1032) ||
    (annex&&((x>=605&&x<=675&&y>=690+margin&&y<=755-margin)||(x>=650+margin&&x<=947-margin&&y>=436+margin&&y<=905-margin)));
  return inside && !(annex?[...BOXES,...ANNEX_BOXES]:BOXES).some(([l,t,r,b])=>x>l-RADIUS-margin&&x<r+RADIUS+margin&&y>t-RADIUS-margin&&y<b+RADIUS+margin);
}
const grids=[false,true].map(annex=>{const grid=new Uint8Array(COLS*ROWS);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)grid[y*COLS+x]=Number(isWalkable(x*STEP,y*STEP,1,annex));return grid;});
function nearest(point,walkable) {
  const gx=Math.round(point[0]/STEP),gy=Math.round(point[1]/STEP);
  let best=-1, distance=Infinity;
  for(let r=0;r<7;r++) {
    for(let y=gy-r;y<=gy+r;y++)for(let x=gx-r;x<=gx+r;x++) {
      if(x<0||y<0||x>=COLS||y>=ROWS||!walkable[y*COLS+x])continue;
      const d=Math.hypot(x*STEP-point[0],y*STEP-point[1]);
      if(d<distance){best=y*COLS+x;distance=d;}
    }
    if(best!==-1) return best;
  }
  throw new Error('No walkable clinic anchor at '+point.join(','));
}
const cache = new Map();
function clearLine(a,b,annex) {
  const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.5);
  for(let i=0;i<=steps;i++){const t=steps?i/steps:0;if(!isWalkable(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,1,annex))return false;}
  return true;
}
export function planRoute(from,to,annex=false) {
  if(Math.hypot(from[0]-to[0],from[1]-to[1])<.1)return [[...from],[...to]];
  const walkable=grids[Number(Boolean(annex))],start=nearest(from,walkable),end=nearest(to,walkable),key=Number(Boolean(annex))+':'+start+':'+end;
  let middle=cache.get(key);
  if(!middle) {
    // Breadth-first grid search is cached between the small set of facility anchors.
    const prev=new Int32Array(walkable.length).fill(-1),q=new Int32Array(walkable.length);
    let head=0,tail=0;q[tail++]=start;prev[start]=start;
    while(head<tail&&prev[end]===-1) {
      const n=q[head++],x=n%COLS,y=Math.floor(n/COLS);
      for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]) {
        const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=COLS||yy>=ROWS)continue;
        const next=yy*COLS+xx;if(!walkable[next]||prev[next]!==-1)continue;
        prev[next]=n;q[tail++]=next;
      }
    }
    if(prev[end]===-1)throw new Error('Clinic route is disconnected');
    middle=[];for(let n=end;;n=prev[n]){middle.push([(n%COLS)*STEP,Math.floor(n/COLS)*STEP]);if(n===start)break;}middle.reverse();
    // Remove grid corners only where a continuous segment clears every footprint.
    const smooth=[middle[0]];let i=0;
    while(i<middle.length-1){let j=middle.length-1;while(j>i+1&&!clearLine(middle[i],middle[j],annex))j--;smooth.push(middle[j]);i=j;}
    middle=smooth;cache.set(key,middle);
    if(cache.size>512)cache.delete(cache.keys().next().value);
  }
  const points=[[...from],...middle.map(p=>[...p]),[...to]];
  return points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.01);
}
export function routeLength(points) {return points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);}
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function sampleMotion(m,at) {
  if(!m)return {position:[...ENTRY],moving:false,sit:0,direction:[0,1],distance:0,arrived:true};
  let distance=Math.max(0,Math.min(m.length,(at-m.start)/1000*WALK_SPEED)),remaining=distance;
  let position=m.points.at(-1),direction=[0,1];
  for(let i=1;i<m.points.length;i++) {
    const a=m.points[i-1],b=m.points[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
    if(remaining<=length||i===m.points.length-1){const t=length?Math.min(1,remaining/length):1;position=[a[0]+dx*t,a[1]+dy*t];direction=[dx/(length||1),dy/(length||1)];break;}remaining-=length;
  }
  const sit=at<m.start ? (m.fromSeated?1-ease((at-m.at)/(m.start-m.at)):0) : at>=m.end&&m.toSeated ? ease((at-m.end)/SIT_MS) : 0;
  return {position,rising:at<m.start&&Boolean(m.fromSeated),moving:at>=m.start&&at<m.end&&m.length>.1,sit,direction,distance,arrived:at>=m.ready};
}
export function settledMotion(position,at,seated=false) {
  return {points:[[...position],[...position]],at:at-1000,start:at-1000,end:at-1000,ready:at-400,length:0,fromSeated:false,toSeated:seated};
}
export function movePatient(p,phase,at,target,serviceDuration=null) {
  const prior=sampleMotion(p.motion,at),fromSeated=prior.sit>.5;
  const points=planRoute(prior.position,target,p.annexAccess),length=routeLength(points);
  const toSeated=['waiting','consultation','nursing','sampling','urgent'].includes(phase);
  const start=at+(fromSeated&&length>.1?STAND_MS:0),end=start+Math.ceil(length/WALK_SPEED*1000);
  p.previousPhase=p.phase;p.phase=phase;p.phaseAt=at;
  p.motion={points,at,start,end,ready:end+(toSeated?SIT_MS:0),length,fromSeated,toSeated};
  p.serviceAt=p.motion.ready;
  p.motionDue=p.serviceAt>at?p.serviceAt:null;
  p.due=serviceDuration===null?null:p.serviceAt+serviceDuration;
}
export function patientPose(p,time) { return sampleMotion(p.motion,time); }
export function atDestination(p,time) {return !p.motion||time>=p.motion.ready;}
