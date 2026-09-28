import test from 'node:test';
import assert from 'node:assert/strict';
import { Actors, STAFF_HOME, route } from '../../v2/src/actors.js';
const patient = (stage='wait_doctor') => ({ id:'P1', name:'测试', sex:'male', stage, staffId:'doctor-1' });
const view = p => ({ patients:[p], staff:[] });
test('起身留在座位，步态随路程前进，落座后停止动画', () => {
  const actors=new Actors();actors.sync(view(patient()));actors.settle();
  const a=actors.list.get('P1'), start={x:a.x,y:a.y};
  actors.sync(view(patient('consult')));
  assert.equal(a.transition.kind,'rise');assert.equal(a.sex,'male');
  actors.step(.16);assert.equal(a.x,start.x);assert.equal(a.y,start.y);
  actors.step(.4);assert.ok(a.walkDistance>0);assert.equal(a.pose,'walk');
  for(let n=0;n<200&&a.path.length;n++)actors.step(.05);
  assert.equal(a.transition.kind,'sit');assert.equal(a.x,a.target.x);assert.equal(a.y,a.target.y);
  actors.step(.4);assert.equal(a.pose,'seat');assert.equal(actors.moving(),false);
  const distance=a.walkDistance;actors.step(10);assert.equal(a.walkDistance,distance);
});
test('恢复存档直接就位，重复同步不会再次起身或重画', () => {
  const actors=new Actors();actors.sync(view(patient('consult')));actors.settle();
  assert.equal(actors.moving(),false);assert.equal(actors.sync(view(patient('consult'))),false);
  assert.equal(STAFF_HOME['doctor-1'].pose,'seat');
});

test('诊室与处置室/化验室之间的行走路线避开两排候诊椅', () => {
  for (const [from,to] of [[{x:2.28,y:2.4},{x:7,y:6.6}],[{x:6.2,y:3.1},{x:2.28,y:2.4}]]) {
    const pts=[from,...route(from,to)];
    for(let i=1;i<pts.length;i++)for(let step=0;step<=100;step++) {
      const t=step/100,x=pts[i-1].x+(pts[i].x-pts[i-1].x)*t,y=pts[i-1].y+(pts[i].y-pts[i-1].y)*t;
      assert.ok(!(x>4.2&&x<7.5&&((y>4.35&&y<4.85)||(y>5.2&&y<5.7))),`穿过座椅 ${x},${y}`);
    }
  }
});
