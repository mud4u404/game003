// 用预装 Chromium 把效果图 HTML 渲染成手机竖屏 PNG（390×844，3 倍像素）。
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const [src, out] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  page.on('console', m => console.log('console:', m.text()));
  page.on('pageerror', e => console.log('pageerror:', e.message));
  await page.goto('file://' + path.resolve(src));
  await page.waitForTimeout(500);
  await page.screenshot({ path: out });
  await browser.close();
})();
