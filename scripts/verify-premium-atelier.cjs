// Real browser checks for the branded UI. The homepage model uses its actual
// local fallback photograph; cloud/provider requests are mocked and unpaid.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const runtime = process.env.LINEN_BROWSER_QA_RUNTIME;
if (!runtime) throw Error('Set LINEN_BROWSER_QA_RUNTIME');
const { chromium } = createRequire(path.join(runtime, 'package.json'))('playwright');
const base = process.env.LINEN_BROWSER_QA_URL || 'http://127.0.0.1:3000';
const out = path.resolve('artifacts/preview-lifecycle/premium-atelier');
const summary = { browser: 'Chromium', model: 'existing local fallback', providerCalls: 0, viewports: [], checks: [], errors: [] };
let browser, activePage;
async function open(width, reducedMotion = 'no-preference', javaScriptEnabled = true) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion, javaScriptEnabled });
  const page = await context.newPage(); activePage = page;
  page.on('pageerror', error => summary.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') summary.errors.push(message.text()); });
  const photo = await fs.readFile('public/designer/studio-tucked.webp');
  await context.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname;
    if (/render|inspect/.test(p)) summary.providerCalls++;
    return p === '/api/homepage-model'
      ? route.fulfill({ status: 200, contentType: 'image/webp', body: photo })
      : route.fulfill({ status: 200, json: {} });
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.brandIntro').waitFor({ state: 'hidden' });
  await page.locator('.gatewayHeroActions').waitFor();
  await page.locator('.atelierBrand img').evaluate(image => image.decode());
  await page.locator('.gatewayHeroModel img').evaluate(image => image.decode());
  return { page, context };
}
async function run() {
  await fs.mkdir(out, { recursive: true });
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 768, 1440]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const { page, context } = await open(width, reducedMotion);
      const action = page.locator('.gatewayHeroActions a').first();
      assert.equal(await action.getAttribute('href'), '/style-director');
      assert.equal(await page.locator('.gatewayHeroActions a').nth(1).getAttribute('href'), '/real-model');
      assert.equal(await page.locator('.atelierBrand img').getAttribute('alt'), 'Linen Earth');
      assert.equal(await page.locator('.atelierBackdrop').getAttribute('aria-hidden'), 'true');
      assert.equal(await page.locator('.atelierBackdrop').evaluate(n => getComputedStyle(n).pointerEvents), 'none');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `overflow ${width}`);
      await action.focus();
      const focus = await action.evaluate(n => ({ active: document.activeElement === n, outline: getComputedStyle(n).outlineStyle, height: n.getBoundingClientRect().height }));
      assert.ok(focus.active && focus.outline !== 'none', 'visible keyboard focus');
      assert.ok(focus.height >= 44, 'usable CTA target');
      await action.hover();
      if (reducedMotion === 'reduce') {
        assert.equal(await action.evaluate(n => getComputedStyle(n).transitionDuration), '0s');
        assert.equal(await page.locator('.atelierPageProgress').evaluate(n => getComputedStyle(n).display), 'none');
        const moving = await page.locator('.atelierBackdropLight').evaluate(n => n.getAnimations().filter(a => a.playState === 'running').length);
        assert.equal(moving, 0, 'reduced-motion backdrop is static');
      }
      if (width === 390) {
        assert.equal(await page.locator('.atelierMobileDock a').count(), 5);
        const dock = await page.locator('.atelierMobileDock').boundingBox();
        assert.ok(dock && dock.x >= 0 && dock.x + dock.width <= width + 1);
      }
      await page.mouse.move(1, 1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(out, `home-${width}-${reducedMotion}.png`), fullPage: true });
      summary.viewports.push({ width, reducedMotion, overflow: false, logo: 'decoded', keyboardFocus: true });
      if (width === 1440 && reducedMotion === 'no-preference') {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForTimeout(100);
        assert.equal(await page.locator('.gatewayBrandCopy').evaluate(n => [...n.children].every(c => getComputedStyle(c).opacity === '1' && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(c).transform))), true);
        summary.checks.push('runtime reduced-motion changes finish entrance animations');
        await page.goto(base + '/designer-studio', { waitUntil: 'networkidle' });
        await page.locator('#designerCreativeLab').waitFor();
        assert.equal(await page.locator('.atelierPageProgress').count(), 0, 'homepage motion does not leak into studio');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
        summary.checks.push('navigation preserves usable designer and removes homepage motion');
      }
      await context.close();
    }
  }
  const noJs = await open(390, 'reduce', false);
  assert.equal(await noJs.page.locator('.brandIntro').count(), 0, 'intro cannot block the site without JS');
  assert.equal(await noJs.page.locator('.gatewayHeroActions a').first().isVisible(), true);
  await noJs.context.close();
  const privatePage = await browser.newContext({ viewport: { width: 390, height: 1000 } });
  await privatePage.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError'); } }));
  const privateTab = await privatePage.newPage(); activePage = privateTab;
  privateTab.on('pageerror', error => summary.errors.push(error.message));
  await privateTab.route('**/api/homepage-model', route => route.fulfill({ status: 302, headers: { location: '/designer/studio-tucked.webp' } }));
  await privateTab.goto(base, { waitUntil: 'networkidle' });
  await privateTab.locator('.brandIntro').waitFor({ state: 'hidden' });
  assert.equal(await privateTab.locator('.gatewayHeroActions a').first().isVisible(), true);
  await privatePage.close();
  summary.checks.push('content visible with JavaScript disabled and storage unavailable', 'logo unchanged; no provider calls; no console errors');
  assert.equal(summary.providerCalls, 0);
  assert.deepEqual(summary.errors, []);
  await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`Premium atelier passed: ${summary.viewports.length} responsive/motion combinations and ${summary.checks.length} lifecycle checks.`);
}
run().catch(async error => {
  summary.errors.push(error.stack || String(error));
  await fs.mkdir(out, { recursive: true });
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.error(error); process.exitCode = 1;
}).finally(async () => { await browser?.close(); });
