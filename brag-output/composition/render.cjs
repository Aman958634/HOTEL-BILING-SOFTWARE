const { chromium } = require('../../client/node_modules/playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const durationMs = 246000;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: path.join(__dirname, 'recording'), size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href, { waitUntil: 'networkidle' });
  await page.mouse.click(8, 8);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(__dirname, '..', 'brag.jpg') });
  await page.waitForTimeout(durationMs - 3000);
  await page.close();
  await context.close();
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
