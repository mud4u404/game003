// Optional browser acceptance. Uses a fresh context and never opens the user's storage.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const errors=[];
try{
 const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.PREVIEW_URL||'http://localhost:4173')+'/v2/?scene=clinic-room');await p.waitForFunction(()=>document.querySelector('#banner').textContent.includes('不影响'));
 await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>localStorage.length),0);
 const frames=()=>p.locator('canvas').getAttribute('data-frames');const idle=await frames();await p.waitForTimeout(750);assert.equal(await frames(),idle);
 fs.mkdirSync('art/screens/T004',{recursive:true});await p.screenshot({path:'art/screens/T004/room.png'});
 await p.touchscreen.tap(169,407);assert.match(await p.locator('#panel-body').innerText(),/候诊患者/);await p.locator('#close').click();
 const cdp=await c.newCDPSession(p);const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id,radiusX:3,radiusY:3,force:1}))});
 await touch('touchStart',[[130,420],[250,420]]);await touch('touchMove',[[100,420],[280,420]]);await touch('touchEnd',[]);await p.waitForTimeout(200);
 assert.equal(await p.locator('#panel').isVisible(),false);await p.screenshot({path:'art/screens/T004/room-zoom.png'});
 let before=await frames();await touch('touchStart',[[190,500]]);await touch('touchMove',[[210,530]]);await touch('touchEnd',[]);await p.waitForTimeout(150);assert.notEqual(await frames(),before);
 before=await frames();await p.mouse.move(180,420);await p.mouse.wheel(0,100);await p.waitForTimeout(150);assert.notEqual(await frames(),before);
 const end=await frames();await p.waitForTimeout(750);assert.equal(await frames(),end);assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>localStorage.length),0);
 await p.locator('.nav [data-panel="医院"]').click();await p.waitForFunction(()=>document.querySelector('#status').textContent==='营业中'||document.querySelector('#status').textContent==='已下班');
 await p.locator('.nav [data-panel="汇报"]').click();assert.match(await p.locator('#panel-body').innerText(),/门诊日报/);assert.deepEqual(errors,[]);
 console.log('PASS: 390×844 DPR3, alpha picking, touch pinch/drag, wheel, idle repaint, storage isolation, return to playable hospital');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
