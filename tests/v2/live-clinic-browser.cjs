// Fresh browser storage; test clock covers reproducible visual states, not the normal-clock gate.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const p=await c.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.PREVIEW_URL||'http://localhost:4173')+'/v2/?dev&at=2026-09-28T10:30&speed=0&seed=2');
 await p.waitForFunction(()=>window.__game);await p.waitForTimeout(200);
 const frames=()=>p.locator('canvas').getAttribute('data-frames');
 const before=await frames();await p.waitForTimeout(1200);assert.equal(await frames(),before);
 const at=await p.evaluate(()=>{const p=__game.screenOf('P11'), r=document.querySelector('canvas').getBoundingClientRect();return {x:p.x+r.x-4*__game.camera().zoom,y:p.y+r.y-29*__game.camera().zoom}});
 await p.touchscreen.tap(at.x,at.y);assert.match(await p.locator('#panel-body').innerText(),/主诉/);assert.equal(await p.locator('#panel').isVisible(),true);
 await p.locator('.nav [data-panel="医院"]').click();assert.equal(await p.locator('#panel').isVisible(),false);
 assert.equal(await p.locator('#view-clinic').count(),1);
 const z=await p.evaluate(()=>__game.camera().zoom);await p.locator('#view-hospital').click();assert.ok(await p.evaluate(()=>__game.camera().zoom)<z);
 await p.locator('#view-clinic').click();assert.equal(await p.evaluate(()=>__game.camera().zoom),z);
 const cdp=await c.newCDPSession(p), touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id,radiusX:3,radiusY:3,force:1}))});
 await touch('touchStart',[[130,430],[250,430]]);await touch('touchMove',[[105,430],[275,430]]);await touch('touchEnd',[]);await p.waitForTimeout(200);
 assert.ok(await p.evaluate(()=>__game.camera().zoom)>z);assert.equal(await p.locator('#panel').isVisible(),false);
 await p.locator('.nav [data-panel="汇报"]').click();assert.match(await p.locator('#panel-body').innerText(),/门诊日报/);
 assert.equal(await p.evaluate(()=>localStorage.length),0);assert.deepEqual(errors,[]);
 console.log('PASS live clinic: DPR3 idle, opaque patient touch→real record, hospital navigation, camera views, pinch, report, test-clock storage isolation');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
