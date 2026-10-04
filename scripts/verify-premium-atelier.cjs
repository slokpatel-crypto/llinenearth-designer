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
  const recordVideo = width === 1440 && reducedMotion === 'no-preference' && javaScriptEnabled ? { dir: path.join(out, 'recordings'), size: { width: 1440, height: 1000 } } : undefined;
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion, javaScriptEnabled, recordVideo });
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
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  if (javaScriptEnabled && reducedMotion === 'no-preference') {
    await page.locator('.brandIntro img').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.brandIntro')?.getAnimations().some(a => Number(a.currentTime) >= 1000));
    const openingHold = await page.locator('.brandIntro').evaluate(n => ({
      background: getComputedStyle(n).backgroundColor,
      logo: Number(getComputedStyle(n.querySelector('img')).opacity),
      glow: Number(getComputedStyle(n.querySelector('.introGlow')).opacity),
      threads: [...n.querySelectorAll('[data-brand-thread]')].every(p => Number(getComputedStyle(p).opacity) < .01),
      logoEnd: n.querySelector('img').getAnimations()[0].effect.getComputedTiming().endTime,
      end: n.getAnimations()[0].effect.getComputedTiming().endTime,
    }));
    assert.equal(openingHold.background, 'rgb(255, 255, 255)');
    assert.ok(openingHold.logo < .01 && openingHold.glow < .01 && openingHold.threads, `opening remains white at one second: ${JSON.stringify(openingHold)}`);
    assert.ok(openingHold.logoEnd >= 2500 && openingHold.logoEnd <= 3000 && openingHold.end <= 3000, 'logo and opening finish in the requested three-second window');
    await page.locator('.brandIntro').screenshot({ path: path.join(out, `intro-white-${width}.png`) });
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.brandIntro img')).opacity) > .95);
    const openingSpacing = await page.locator('.brandIntro').evaluate(n => ({
      rule: n.querySelector('.introLogoRule').getBoundingClientRect().bottom,
      caption: n.querySelector('p').getBoundingClientRect().top,
    }));
    assert.ok(openingSpacing.caption >= openingSpacing.rule + 4, `caption clears the decorative rule at ${width}px`);
    await page.locator('.brandIntro').screenshot({ path: path.join(out, `intro-${width}.png`) });
  }
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
      assert.equal(await action.locator('.atelierButtonEmblem').getAttribute('aria-hidden'), 'true', 'button illustration is decorative');
      assert.equal(await page.locator('.gatewayHeroActions .atelierButtonArrow').count(), 2);
      const buttonLabels = await page.locator('.gatewayHeroActions a').evaluateAll(nodes => nodes.every(n => {
        const bounds = n.getBoundingClientRect(), text = n.querySelector('.atelierButtonText').getBoundingClientRect();
        return text.left >= bounds.left && text.right <= bounds.right && text.top >= bounds.top && text.bottom <= bounds.bottom;
      }));
      assert.ok(buttonLabels, `button labels stay inside their controls at ${width}px`);
      await action.hover();
      if (reducedMotion === 'no-preference') {
        assert.equal(await action.evaluate(n => getComputedStyle(n, '::after').animationName), 'atelierControlSweep');
        await action.screenshot({ path: path.join(out, `button-focus-${width}.png`) });
      } else {
        assert.equal(await action.evaluate(n => getComputedStyle(n, '::after').display), 'none');
        assert.equal(await action.locator('.atelierButtonArrow').evaluate(n => getComputedStyle(n).transitionDuration), '0s');
      }
      const signature = page.locator('.brandSignature');
      await signature.locator('img').evaluate(image => image.decode());
      assert.equal(await signature.locator('img').getAttribute('src'), await page.locator('.atelierBrand img').getAttribute('src'), 'signature uses the unchanged real brand asset');
      assert.equal(await signature.locator('[data-brand-thread]').count(), 26);
      assert.equal(await signature.locator('.brandSignatureArt').evaluate(n => getComputedStyle(n).pointerEvents), 'none');
      await signature.scrollIntoViewIfNeeded();
      if (reducedMotion === 'no-preference') {
        await signature.getByRole('button', { name: 'Replay Linen Earth brand animation' }).click();
        await page.locator('.brandSignature[data-motion-state="playing"]').waitFor();
        const thread = signature.locator('[data-brand-thread]').first();
        const signatureTiming = await signature.evaluate(n => ({
          threadDelay: n.querySelector('[data-brand-thread]').getAnimations()[0].effect.getTiming().delay,
          logoEnd: n.querySelector('.brandSignatureLogo').getAnimations()[0].effect.getComputedTiming().endTime,
          end: Math.max(...n.getAnimations({ subtree: true }).map(a => a.effect.getComputedTiming().endTime)),
        }));
        assert.ok(signatureTiming.threadDelay >= 1000 && signatureTiming.threadDelay <= 1500, 'background starts after the requested white hold');
        assert.ok(signatureTiming.logoEnd >= 2500 && signatureTiming.logoEnd <= 3000 && signatureTiming.end <= 3000, 'banner settles by three seconds');
        await page.waitForTimeout(850);
        const signatureHold = await signature.evaluate(n => ({
          logo: Number(getComputedStyle(n.querySelector('.brandSignatureLogo')).opacity),
          caption: Number(getComputedStyle(n.querySelector('.brandSignatureCaption')).opacity),
          threads: [...n.querySelectorAll('[data-brand-thread]')].every(p => Number(getComputedStyle(p).opacity) < .01),
        }));
        assert.ok(signatureHold.logo < .01 && signatureHold.caption < .01 && signatureHold.threads, 'banner artwork stays blank throughout the initial hold');
        await signature.screenshot({ path: path.join(out, `signature-white-${width}.png`) });
        await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.brandSignature [data-brand-thread]')).opacity) > .05);
        const start = await thread.evaluate(n => parseFloat(getComputedStyle(n).strokeDashoffset));
        await page.waitForTimeout(180);
        const moved = await thread.evaluate(n => parseFloat(getComputedStyle(n).strokeDashoffset));
        assert.ok(moved < start - .1, `actual path drawing ${start} -> ${moved}`);
        await signature.screenshot({ path: path.join(out, `signature-drawing-${width}.png`) });
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        await page.locator('.brandSignature[data-motion-state="paused"]').waitFor();
        await page.waitForFunction(() => {
          const animations = document.querySelector('.brandSignature').getAnimations({ subtree: true });
          return animations.some(a => a.playState === 'paused') && animations.every(a => !a.pending && a.playState !== 'running');
        });
        const paused = await thread.evaluate(n => parseFloat(getComputedStyle(n).strokeDashoffset));
        const pausedTimes = await signature.evaluate(n => n.getAnimations({ subtree: true }).filter(a => a.playState === 'paused').map(a => Number(a.currentTime)));
        await page.waitForTimeout(180);
        assert.ok(Math.abs(await thread.evaluate(n => parseFloat(getComputedStyle(n).strokeDashoffset)) - paused) < .01, 'offscreen animation freezes');
        assert.deepEqual(await signature.evaluate(n => n.getAnimations({ subtree: true }).filter(a => a.playState === 'paused').map(a => Number(a.currentTime))), pausedTimes, 'every paused native track keeps its clock frozen');
        await signature.scrollIntoViewIfNeeded();
        await page.locator('.brandSignature[data-motion-state="playing"]').waitFor();
        await page.locator('.brandSignature[data-motion-state="complete"]').waitFor();
        assert.equal(await signature.locator('[data-brand-thread]').evaluateAll(nodes => nodes.every(n => Math.abs(parseFloat(getComputedStyle(n).strokeDashoffset)) < .01)), true);
        const replayPlacement = await signature.evaluate(n => {
          const banner = n.getBoundingClientRect(), replay = n.querySelector('.brandSignatureReplay').getBoundingClientRect(), caption = n.querySelector('.brandSignatureCaption').getBoundingClientRect();
          return { captionGap: replay.top - caption.bottom, rightGap: banner.right - replay.right, bottomGap: banner.bottom - replay.bottom, height: replay.height, inside: replay.left >= banner.left && replay.right <= banner.right && replay.top >= banner.top && replay.bottom <= banner.bottom };
        });
        assert.ok(replayPlacement.inside && replayPlacement.height >= 44 && replayPlacement.captionGap >= 4 && replayPlacement.rightGap >= 8 && replayPlacement.rightGap <= 18 && replayPlacement.bottomGap >= 4, `Replay stays in the bottom-right without covering the caption at ${width}px: ${JSON.stringify(replayPlacement)}`);
        summary.checks.push(`Replay clears the caption in the bottom-right corner at ${width}px`);
        summary.checks.push(`white hold, three-second reveal, actual thread drawing, replay and offscreen pause/resume at ${width}px`);
      } else {
        await page.locator('.brandSignature[data-motion-state="reduced"]').waitFor();
        assert.equal(await signature.getByRole('button', { name: 'Replay Linen Earth brand animation' }).isVisible(), false);
        assert.equal(await signature.evaluate(n => n.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0);
        assert.equal(await signature.locator('img').evaluate(n => getComputedStyle(n).opacity), '1');
      }
      await signature.screenshot({ path: path.join(out, `signature-${width}-${reducedMotion}.png`) });
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
        await signature.getByRole('button', { name: 'Replay Linen Earth brand animation' }).click();
        await page.waitForFunction(() => {
          const root = document.querySelector('.brandSignature'), thread = root.querySelector('[data-brand-thread]'), logo = root.querySelector('.brandSignatureLogo');
          return root.dataset.motionState === 'playing' && thread.getAnimations().length === 0 && logo.getAnimations().length === 0 && Number(getComputedStyle(logo).opacity) === 1;
        });
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        await page.locator('.brandSignature[data-motion-state="paused"]').waitFor();
        await page.waitForFunction(() => document.querySelector('.brandSignature').getAnimations({ subtree: true }).every(a => !a.pending && a.playState !== 'running'));
        const completedArtwork = () => signature.evaluate(n => ({
          logo: Number(getComputedStyle(n.querySelector('.brandSignatureLogo')).opacity),
          offset: parseFloat(getComputedStyle(n.querySelector('[data-brand-thread]')).strokeDashoffset),
          tracks: n.querySelector('[data-brand-thread]').getAnimations().length + n.querySelector('.brandSignatureLogo').getAnimations().length,
        }));
        assert.deepEqual(await completedArtwork(), { logo: 1, offset: 0, tracks: 0 }, 'offscreen pause must not restart completed artwork');
        await signature.scrollIntoViewIfNeeded();
        await page.locator('.brandSignature[data-motion-state="playing"]').waitFor();
        assert.deepEqual(await completedArtwork(), { logo: 1, offset: 0, tracks: 0 }, 'resume keeps completed tracks intact');
        await page.locator('.brandSignature[data-motion-state="complete"]').waitFor();
        summary.checks.push('late pause/resume preserves completed logo and thread tracks');
        await signature.getByRole('button', { name: 'Replay Linen Earth brand animation' }).click();
        await page.locator('.brandSignature[data-motion-state="playing"]').waitFor();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.locator('.brandSignature[data-motion-state="reduced"]').waitFor();
        assert.equal(await signature.locator('[data-brand-thread]').evaluateAll(nodes => nodes.every(n => Math.abs(parseFloat(getComputedStyle(n).strokeDashoffset)) < .01 && getComputedStyle(n).opacity === '0.65')), true, 'live reduction restores complete static artwork');
        assert.equal(await signature.evaluate(n => n.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0);
        summary.checks.push('runtime reduced-motion change cancels the brand film and restores the logo/threads');
        await page.waitForTimeout(100);
        assert.equal(await page.locator('.gatewayBrandCopy').evaluate(n => [...n.children].every(c => getComputedStyle(c).opacity === '1' && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(c).transform))), true);
        summary.checks.push('runtime reduced-motion changes finish entrance animations');
        await page.goto(base + '/designer-studio', { waitUntil: 'networkidle' });
        await page.locator('#designerCreativeLab').waitFor();
        assert.equal(await page.locator('.brandSignature').count(), 0, 'homepage brand film is removed on studio navigation');
        assert.equal(await page.locator('.brandIntro').count(), 0, 'intro does not replay on same-session navigation');
        assert.equal(await page.locator('.atelierPageProgress').count(), 0, 'homepage motion does not leak into studio');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
        summary.checks.push('navigation preserves usable designer and removes homepage motion');
      }
      const video = page.video();
      await context.close();
      if (video) await video.saveAs(path.join(out, 'linen-earth-brand-motion.webm'));
    }
  }
  const noJs = await open(390, 'reduce', false);
  assert.equal(await noJs.page.locator('.brandSignature img').isVisible(), true, 'signature has complete no-JS artwork');
  assert.equal(await noJs.page.locator('.brandSignatureReplay').isVisible(), false);
  assert.equal(await noJs.page.locator('.brandIntro').count(), 0, 'intro cannot block the site without JS');
  assert.equal(await noJs.page.locator('.gatewayHeroActions a').first().isVisible(), true);
  await noJs.context.close();
  const privatePage = await browser.newContext({ viewport: { width: 390, height: 1000 } });
  await privatePage.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError'); } }));
  const privateTab = await privatePage.newPage(); activePage = privateTab;
  privateTab.on('pageerror', error => summary.errors.push(error.message));
  await privateTab.route('**/api/homepage-model', route => route.fulfill({ status: 302, headers: { location: '/designer/studio-tucked.webp' } }));
  await privateTab.goto(base, { waitUntil: 'domcontentloaded' });
  await privateTab.locator('.brandIntro').waitFor({ state: 'visible' });
  await privateTab.keyboard.press('Tab');
  await privateTab.locator('.brandIntro').waitFor({ state: 'hidden' });
  summary.checks.push('first keyboard interaction dismisses opening immediately even when storage is blocked');
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
