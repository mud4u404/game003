import test from 'node:test';
import assert from 'node:assert/strict';
import { project,unproject,toScreen,fromScreen } from '../../v2/src/iso.js';
import { sortNodes,depthKey,wallSegments } from '../../v2/src/depth.js';
import { inPolygon, pickPerson } from '../../v2/src/picking.js';
import { buildScene } from '../../v2/src/catalog.js';
import { scene } from '../../v2/src/layout.js';
import { defaultCamera,zoomAt,constrain,invalidator } from '../../v2/src/camera.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('projection / inverse and camera transforms round trip, including negative ground and height',()=>{
  for(const x of [-7,0,.25,9])for(const y of [-12,0,3.5,22])for(const z of [0,.3,1.2]) {
    const p=project(x,y,z),q=unproject(p.x,p.y,z);near(q.x,x);near(q.y,y);
    const c={x:123,y:-81,zoom:2.8},r=fromScreen(toScreen(p,c),c);near(r.x,p.x);near(r.y,p.y);
  }
});
const node=(id,x,y,w=.2,d=.2,h=1)=>({id,bounds:{x,y,w,d,h,z:0}});
test('depth key increases towards the front and physical extents govern long objects',()=>{
  assert.ok(depthKey(node('b',2,2).bounds)>depthKey(node('a',1,1).bounds));
  // At either end of a long counter, centre-depth alone gives the wrong answer.
  for(const x of [.3,3.5]) {
    const back=node('back',x,.65),counter=node('counter',0,1,4,.55,.46),front=node('front',x,1.7);
    for(const input of [[front,counter,back],[back,front,counter]])assert.deepEqual(sortNodes(input).map(n=>n.id),['back','counter','front']);
  }
});
test('long walls are split at half-grid and door boundaries without filling openings',()=>{
  const w={id:'w',length:4};const parts=wallSegments(w,[{wall:'w',offset:1.3,width:.9}]);
  assert.ok(parts.every(p=>p.length<=.5));near(parts.reduce((a,p)=>a+p.length,0),3.1);
  assert.ok(parts.every(p=>p.offset+p.length<=1.3+1e-8||p.offset>=2.2-1e-8));
});
test('picking matches visible people, overlapping foreground priority, and an opaque occluder',()=>{
  const back={id:'back',x:1,y:1,pose:'stand'},front={id:'front',x:1.1,y:1.1,pose:'stand'};
  const c={x:195,y:190,zoom:1},p=project(1.1,1.1);p.y-=17;
  const point=toScreen(p,c);
  assert.equal(pickPerson(point,c,[{person:back},{person:front}]).id,'front');
  assert.equal(pickPerson(point,c,[{person:front},{hit:()=>true}]),null);
  assert.equal(pickPerson({x:0,y:0},c,[{person:front}]),null);
});
test('all 19 scene people are separate selectable entities, including seated and lying patients',()=>{
  const nodes=buildScene(scene);assert.equal(scene.rooms.length,5);assert.equal(scene.people.length,19);
  assert.equal(nodes.filter(n=>n.person).length,19);
  const c={x:0,y:0,zoom:1};
  for(const person of scene.people) {
    const p=project(person.x,person.y,person.z||0);if(person.pose!=='lie')p.y-=person.pose==='seat'?21:26;
    assert.equal(pickPerson(p,c,nodes)?.id,person.id,`visible head of ${person.id}`);
  }
});
test('zoom stays anchored; extreme pan and zoom cannot lose the hospital',()=>{
  const c=defaultCamera(390,724),point={x:200,y:350},p=fromScreen(point,c);
  zoomAt(c,point,1.4,390,724);const q=fromScreen(point,c);near(q.x,p.x);near(q.y,p.y);
  c.x=-1e6;c.y=1e6;c.zoom=100;constrain(c,390,724);
  assert.equal(c.zoom,3.5);assert.ok(c.x+225*c.zoom>=100);assert.ok(c.y-36*c.zoom<=624);
});
test('invalidation coalesces events and does not schedule frames while idle',()=>{
  const queue=[];let paints=0;const invalidate=invalidator(()=>paints++,cb=>queue.push(cb));
  invalidate();invalidate();invalidate();assert.equal(queue.length,1);queue.shift()();assert.equal(paints,1);assert.equal(queue.length,0);
  invalidate();queue.shift()();assert.equal(paints,2);assert.equal(queue.length,0);
});

test('all extreme diagonal pans keep the actual hospital diamond within reach',()=>{
  for(const x of [-1e6,1e6])for(const y of [-1e6,1e6])for(const zoom of [.01,1,50]) {
    const c={...defaultCamera(390,724),x,y,zoom};constrain(c,390,724);
    const points=[[0,0],[9,0],[9,9],[0,9]].map(([x,y])=>toScreen(project(x,y),c));
    let visible=inPolygon({x:195,y:362},points);
    for(let i=0;i<4;i++)for(let t=0;t<=1;t+=.01){const a=points[i],b=points[(i+1)%4],x=a.x+t*(b.x-a.x),y=a.y+t*(b.y-a.y);if(x>=0&&x<=390&&y>=0&&y<=724)visible=true;}
    assert.ok(visible,JSON.stringify(c));
  }
});
