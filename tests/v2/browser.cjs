// Optional integration acceptance: externally installed Playwright + Chrome, no app dependency.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.PREVIEW_URL || 'http://localhost:4173';
const output = path.resolve('art/screens/T001');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [];
  const monitor = (p,target=errors) => { p.on('pageerror', e => target.push(e.message));p.on('console', m => { if(m.type()==='error') target.push(m.text()+' @ '+m.location().url); }); };
  monitor(page);
  const settle = () => page.waitForTimeout(120);
  const frames = () => page.locator('#scene').getAttribute('data-frames');
  const changed = async before => { await settle(); assert.notEqual(await frames(), before); };
  try {
    await page.goto(base+'/v2/'); await settle();
    assert.equal(await page.locator('#panel').isVisible(), false);
    assert.deepEqual(await page.locator('#scene').evaluate(c=>[c.width,c.height]), [1170,2172]);
    const idle = await frames();await page.waitForTimeout(750);assert.equal(await frames(), idle, 'idle canvas must not repaint');
    await page.screenshot({path:path.join(output,'v2-default.png')});
    await page.touchscreen.tap(192,284);await settle();
    assert.equal(await page.locator('#panel-title').textContent(),'王建国');
    assert.match(await page.locator('#panel-text').textContent(),/后续任务/);
    await page.screenshot({path:path.join(output,'v2-selected.png')});
    await page.touchscreen.tap(180,130);await settle();assert.equal(await page.locator('#panel').isVisible(),false);
    // Lying patients are independent scene entities, not painted into their beds.
    await page.touchscreen.tap(151.75,375.875);await settle();
    assert.equal(await page.locator('#panel-title').textContent(),'杨康');
    await page.getByRole('button',{name:'关闭面板',exact:true}).click();
    for(const label of ['汇报','建设','人事','规则','资金']) {
      await page.locator(`.nav [data-panel="${label}"]`).click();
      assert.equal(await page.locator('#panel-role').textContent(),'即将开放');
    }
    await page.locator('.nav [data-panel="医院"]').click();
    await page.locator('.bell').click();assert.equal(await page.locator('#panel-title').textContent(),'汇报');
    await page.getByRole('button',{name:'关闭面板',exact:true}).click();
    const cdp=await context.newCDPSession(page);
    const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id,radiusX:3,radiusY:3,force:1}))});
    let before=await frames();
    await touch('touchStart',[[120,425],[180,445]]);
    for(let i=1;i<=12;i++)await touch('touchMove',[[120-4*i,425-i],[180+4*i,445+i]]);
    await touch('touchEnd',[]);await changed(before);
    assert.equal(await page.locator('#panel').isVisible(),false,'pinch must not tap a person');
    before=await frames();
    await touch('touchStart',[[195,490]]);
    for(let i=1;i<=10;i++)await touch('touchMove',[[195+2*i,490-7*i]]);
    await touch('touchEnd',[]);await changed(before);
    await page.screenshot({path:path.join(output,'v2-zoom.png')});
    const after=await frames();await page.waitForTimeout(500);assert.equal(await frames(),after);
    // Headless browser touch-cancel must end the drag and not open a patient card.
    await touch('touchStart',[[100,150]]);await touch('touchCancel',[]);
    assert.equal(await page.locator('#panel').isVisible(),false);
    for(const size of [{width:320,height:568},{width:430,height:932},{width:768,height:1024}]) {
      await page.setViewportSize(size);await settle();
      const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,buttons:[...document.querySelectorAll('.nav button,.bell,#close')].filter(e=>e.getClientRects().length).map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))}));
      assert.ok(bounds.scroll<=bounds.inner);assert.ok(bounds.buttons.every(b=>b.w>=44&&b.h>=44));
    }
    const desktop=await browser.newContext({viewport:{width:1440,height:900}}),dp=await desktop.newPage();monitor(dp);
    await dp.goto(base+'/v2/');await dp.waitForTimeout(120);
    const bounds=await dp.locator('#scene').boundingBox();assert.ok(Math.abs(bounds.x+bounds.width/2-720)<1);
    const s=Math.min(bounds.width/390,bounds.height/724),wx=bounds.x+bounds.width/2-3*s,wy=bounds.y+(190+58.5-21)*s;
    await dp.mouse.move(wx,wy);await dp.mouse.wheel(0,-300);await dp.waitForTimeout(150);await dp.mouse.click(wx,wy);
    assert.equal(await dp.locator('#panel-title').textContent(),'王建国');
    await dp.getByRole('button',{name:'关闭面板',exact:true}).click();
    const desktopBefore=await dp.locator('#scene').getAttribute('data-frames');
    await dp.mouse.move(720,450);await dp.mouse.down();await dp.mouse.move(760,410,{steps:10});await dp.mouse.up();await dp.waitForTimeout(120);
    assert.notEqual(await dp.locator('#scene').getAttribute('data-frames'),desktopBefore);
    assert.equal(await dp.locator('#panel').isVisible(),false);
    await desktop.close();
    // Independent browser context, no access to the player's stored game.
    const legacy=await browser.newContext(),lp=await legacy.newPage(),legacyErrors=[];monitor(lp,legacyErrors);
    const response=await lp.goto(base+'/');assert.equal(response.status(),200);
    await lp.locator('canvas').first().waitFor();await lp.waitForTimeout(300);
    assert.ok((await lp.locator('body').innerText()).length>30);
    await legacy.close();
    assert.ok(legacyErrors.every(e=>e.includes('/favicon.ico')),JSON.stringify(legacyErrors));
    if(legacyErrors.length)console.log('Legacy entry only: existing favicon.ico 404; game entry loaded.');
    assert.deepEqual(errors,[]);
    console.log('PASS: 390×844 DPR3 screenshots; actual browser touch tap/drag/pinch/cancel; desktop mouse drag/wheel/pick; idle frame stability; navigation; responsive layout; legacy entry; no v2 console errors. No physical phone tested.');
  } finally { await browser.close(); }
})();
