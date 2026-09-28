import test from 'node:test';
import assert from 'node:assert/strict';
import {alphaHit,spriteNode} from '../../v2/src/sprites.js';
import {pickPerson} from '../../v2/src/picking.js';
import {sortNodes} from '../../v2/src/depth.js';
const asset={pixelWidth:2,pixelHeight:2,alpha:new Uint8Array([0,255,255,0]),anchor:[.5,1],displayWidth:20,footprint:[.2,.2],height:1};
test('transparent pixels pass through, mirrored coordinates and image boundaries remain accurate',()=>{
 const rect={left:10,top:10,width:20,height:20};
 assert.equal(alphaHit(asset,rect,{x:12,y:12}),false);
 assert.equal(alphaHit(asset,rect,{x:22,y:12}),true);
 assert.equal(alphaHit(asset,rect,{x:12,y:12},true),true);
 assert.equal(alphaHit(asset,rect,{x:30,y:12}),false);
 assert.equal(alphaHit(asset,rect,{x:12,y:9}),false);
});
test('sprite foreground blocks a person only on opaque pixels',()=>{
 const p={id:'person',x:0,y:0};const node=spriteNode(asset,{id:'person',x:0,y:0,person:p});
 const front=spriteNode({...asset,alpha:new Uint8Array([255,0,0,255])},{id:'desk',x:0,y:0});
 assert.equal(pickPerson({x:5,y:-15},{x:0,y:0,zoom:1},[node,front]),p);
 assert.equal(pickPerson({x:-5,y:-15},{x:0,y:0,zoom:1},[node,front]),null);
});
test('wide sprite furniture sorts between people at its rear and front edges',()=>{
 const desk=spriteNode({...asset,footprint:[3,.6],displayWidth:90,height:.6},{id:'desk',x:1.5,y:.3});
 const behind=spriteNode(asset,{id:'behind',x:1.5,y:-.3,person:{}});
 const front=spriteNode(asset,{id:'front',x:1.5,y:1,person:{}});
 const nodes=sortNodes([front,desk,behind]);assert.ok(nodes.indexOf(behind)<nodes.indexOf(desk));assert.ok(nodes.indexOf(desk)<nodes.indexOf(front));
});
