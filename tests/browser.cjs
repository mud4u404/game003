// Optional browser checks. Point PLAYWRIGHT_MODULE to an installed Playwright package.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const URL = process.env.PREVIEW_URL || 'http://localhost:4173';
const output = process.env.SCREENSHOT_DIR || '/tmp/meiao-browser-checks';
const KEY = 'meiao-clinic-v1';
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL || 'chrome'});
  const context = await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',hasTouch:true});
  const page = await context.newPage();const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(URL);await page.getByText('自主运行',{exact:true}).waitFor();
    await page.locator('#scene[data-art-ready="true"]').waitFor();
    await page.getByRole('button',{name:'院长',exact:true}).click();
    const toggle=page.getByRole('switch');assert.equal(await toggle.getAttribute('aria-checked'),'true');
    await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'false');
    await page.getByRole('button',{name:'决定启用第二诊室'}).click();
    await page.getByRole('heading',{name:'第二诊室 · 准备中'}).waitFor();
    const after=JSON.parse(await page.evaluate(k=>localStorage.getItem(k),KEY));
    assert.equal(after.cash,173200);assert.equal(after.authority,false);assert.equal(after.metrics.investment,6800);
    await page.reload();await page.getByText('自主运行',{exact:true}).waitFor();
    await page.getByRole('button',{name:'院长',exact:true}).click();await page.getByRole('heading',{name:'第二诊室 · 准备中'}).waitFor();
    assert.equal(await page.getByRole('switch').getAttribute('aria-checked'),'false');
    await page.screenshot({path:path.join(output,'director-desktop.png')});
    const follower=await context.newPage();await follower.goto(URL);await follower.getByText('观察模式',{exact:true}).waitFor();
    const followerTime=Number(await follower.locator('#scene').getAttribute('data-scene-time'));
    await follower.waitForFunction(before=>Number(document.querySelector('#scene').dataset.sceneTime)>before+150,followerTime,{timeout:1500});
    await follower.getByRole('button',{name:'院长',exact:true}).click();assert.equal(await follower.getByRole('switch').isDisabled(),true);
    await page.close();await follower.getByText('自主运行',{exact:true}).waitFor({timeout:10000});
    assert.equal(await follower.getByRole('switch').isEnabled(),true);
    await follower.getByRole('button',{name:'团队',exact:true}).click();await follower.getByRole('button',{name:/林岚/}).click();
    await follower.locator('#person').getByRole('heading',{name:'林岚'}).waitFor();
    await follower.keyboard.press('Escape');assert.equal(await follower.locator('#panel').isHidden(),true);assert.equal(await follower.locator('#person').isHidden(),true);
    await follower.getByRole('button',{name:'回到全景'}).click();
    // The stage is centered and the canvas has a header offset: client coordinates must be translated.
    const canvasBox=await follower.locator('#scene').boundingBox();
    const scale=Math.min(canvasBox.width/690,canvasBox.height/1060);
    await follower.touchscreen.tap(canvasBox.x+canvasBox.width/2+(173-340)*scale,canvasBox.y+canvasBox.height/2+(241-20-550)*scale);
    await follower.locator('#person').getByRole('heading',{name:'林岚'}).waitFor();
    await follower.keyboard.press('Escape');
    await follower.screenshot({path:path.join(output,'clinic-desktop.png')});
    console.log('PASS controls, expansion, reload persistence, multi-tab exclusion and writer takeover, staff selection');
    const mobile=await context.newPage();await mobile.setViewportSize({width:844,height:390});await mobile.goto(URL);
    await mobile.screenshot({path:path.join(output,'clinic-landscape.png')});
    await mobile.setViewportSize({width:390,height:844});await mobile.screenshot({path:path.join(output,'clinic-portrait.png')});
    await mobile.getByRole('button',{name:'院长',exact:true}).click();await mobile.getByRole('heading',{name:'周敏 · 执行院长'}).waitFor();await mobile.screenshot({path:path.join(output,'director-portrait.png')});
    for(const locator of [mobile.locator('#panel'),mobile.locator('.controls')]){const rect=await locator.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=390);assert.ok(rect.y>=0&&rect.y+rect.height<=844);}
    await mobile.keyboard.press('Escape');
    for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[768,1024],[1440,900],[844,390]]) {
      await mobile.setViewportSize({width,height});
      await mobile.getByRole('button',{name:'院长',exact:true}).click();
      const stage=await mobile.locator('#game').boundingBox();
      assert.ok(stage.height>stage.width,'The game remains portrait on wide viewports');
      assert.ok(stage.width<=480&&stage.x>=0&&stage.x+stage.width<=width);
      for(const selector of ['#panel','.controls','.hud','#scene','.view-controls']) {
        const rect=await mobile.locator(selector).boundingBox();
        assert.ok(rect.x>=stage.x-.1&&rect.x+rect.width<=stage.x+stage.width+.1,selector+' horizontal containment');
        assert.ok(rect.y>=stage.y&&rect.y+rect.height<=stage.y+stage.height,selector+' vertical containment');
      }
      for(const button of await mobile.locator('.controls button').all()) {
        const rect=await button.boundingBox();assert.ok(rect.width>=44&&rect.height>=44);
      }
      assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
      await mobile.keyboard.press('Escape');
    }
    console.log('PASS seven viewport sizes, portrait stage, sheet containment, 44px controls and offset canvas tapping');
    await mobile.close();await follower.close();
    const offlineContext=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    const op=await offlineContext.newPage();
    await op.route('**/src/app.js',async route=>{const original=await (await route.fetch()).text();await route.fulfill({contentType:'text/javascript',body:`import {createState as fixtureCreate} from './simulation.js'; if(!sessionStorage.fixtureDone){localStorage.setItem('${KEY}',JSON.stringify(fixtureCreate(Date.now()-3600000)));sessionStorage.fixtureDone='1';}\n`+original});});
    await op.goto(URL);await op.getByText('自主运行',{exact:true}).waitFor();
    await op.getByText(/离开 1.0 小时/).waitFor();
    const result=JSON.parse(await op.evaluate(k=>localStorage.getItem(k),KEY));
    assert.ok(result.secondRoom);assert.ok(result.metrics.completed>10);assert.ok(result.metrics.referred>0);
    await op.screenshot({path:path.join(output,'offline-return.png')});console.log('PASS one-hour offline catch-up, autonomous expansion and report');
    await offlineContext.close();
    const brokenContext=await browser.newContext();const bp=await brokenContext.newPage();
    await brokenContext.addInitScript(key=>localStorage.setItem(key,'broken save'),KEY);await bp.goto(URL);await bp.getByText(/原存档已保留/).waitFor();
    assert.equal(await bp.evaluate(k=>localStorage.getItem(k),KEY),'broken save');console.log('PASS corrupt save is preserved');await brokenContext.close();
    assert.deepEqual(errors,[]);console.log('PASS no browser errors');console.log('Screenshots:',output);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
