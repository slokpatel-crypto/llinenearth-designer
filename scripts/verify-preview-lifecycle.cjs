// Real Chromium/UI regression checks. Provider/QA responses are deliberately
// mocked; these screenshots are never physical-fabric or device acceptance.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");

const runtime = process.env.LINEN_BROWSER_QA_RUNTIME;
if (!runtime) throw new Error("Set LINEN_BROWSER_QA_RUNTIME to the pinned CI test runtime.");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const baseURL = process.env.LINEN_BROWSER_QA_URL || "http://127.0.0.1:3000";
const output = path.resolve("artifacts/preview-lifecycle");
const summary = {
  browser: "Chromium",
  providerResponses: "mocked; no paid provider calls",
  calibration: "unverified",
  physicalOrDeviceAcceptance: false,
  branding: {},
  viewports: [],
  regressions: [],
  errors: [],
};
let browser;
let activePage;

async function decodeLogo(locator) {
  const logo = await locator.evaluate(async (image) => {
    await image.decode();
    return {
      source: new URL(image.currentSrc || image.src).pathname,
      width: image.naturalWidth,
      height: image.naturalHeight,
      declaredWidth: Number(image.getAttribute("width")),
      declaredHeight: Number(image.getAttribute("height")),
    };
  });
  assert.ok(logo.width > 0 && logo.height > 0, "The logo must actually decode in the browser");
  assert.equal(logo.width, logo.declaredWidth);
  assert.equal(logo.height, logo.declaredHeight);
  assert.match(logo.source, /^\/brand\/linen-earth-logo-[0-9a-f]{12}\.png$/);
  return logo;
}

async function freshPage(width = 1440, captureIntro = false) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  activePage = page;
  page.on("pageerror", (error) => summary.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") summary.errors.push(message.text());
  });
  // Keep real local photographs, fabric assets and Canvas rendering. Block all
  // backend/provider access, including endpoints unrelated to this UI test.
  await context.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (/look-render|look-inspect|creative-render|creative-inspect/.test(url.pathname)) {
      summary.errors.push("Provider request escaped the browser mock: " + url.pathname);
    }
    return route.fulfill({ status: 200, json: url.pathname.includes("photo-calibration") ? { verified: false } : {} });
  });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    const requests = [];
    window.__linenPreviewQA = { requests };
    window.fetch = (input, options = {}) => {
      const pathname = new URL(typeof input === "string" ? input : input.url, location.href).pathname;
      const kind = pathname === "/api/designer/look-render" ? "render" : pathname === "/api/designer/look-inspect" ? "inspect" : null;
      if (!kind) return originalFetch(input, options);
      return new Promise((resolve) => requests.push({
        kind, body: JSON.parse(options.body || "{}"), signal: options.signal,
        completed: false,
        // Ignore cancellation to prove late server responses cannot write into
        // another design, even when provider work has already been dispatched.
        complete(value) {
          this.completed = true;
          resolve(new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } }));
        },
      }));
    };
  });
  await page.goto(baseURL + "/designer-studio", { waitUntil: captureIntro ? "domcontentloaded" : "networkidle" });
  if (captureIntro) {
    const logo = page.locator(".brandIntro img");
    await logo.waitFor({ state: "visible" });
    await decodeLogo(logo);
    await page.waitForFunction(() => {
      const card = document.querySelector(".brandIntro .introCard");
      return card && Number(getComputedStyle(card).opacity) > 0.95;
    });
    await page.screenshot({ path: path.join(output, "brand-intro-" + width + ".png") });
    summary.branding.openingAnimation = "passed";
  }
  await ready(page);
  await page.locator(".brandIntro").waitFor({ state: "hidden" });
  const logo = await decodeLogo(page.locator(".atelierBrand img"));
  return { page, context, logo };
}

async function ready(page) {
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll(".newDesignerPhoto button")].find((item) => item.textContent === "Lock final design");
    return button && !button.disabled && !document.querySelector(".newDesignerPhotoLoading, .newDesignerPhotoError");
  }, null, { timeout: 30000 });
}

const button = (page, name) => page.locator(".newDesignerPhoto").getByRole("button", { name, exact: true });
async function settle(page) {
  // Two React paint opportunities after a deliberately delayed mock response.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 30)))));
}
async function counts(page) {
  return page.evaluate(() => ({
    renders: window.__linenPreviewQA.requests.filter((item) => item.kind === "render").length,
    inspections: window.__linenPreviewQA.requests.filter((item) => item.kind === "inspect").length,
  }));
}
async function request(page, kind, index) {
  return page.evaluate(({ kind, index }) => {
    const item = window.__linenPreviewQA.requests.filter((item) => item.kind === kind)[index];
    return item ? { aborted: item.signal?.aborted || false, body: item.body } : null;
  }, { kind, index });
}
async function complete(page, kind, index, value) {
  await page.evaluate(({ kind, index, value }) => {
    const item = window.__linenPreviewQA.requests.filter((item) => item.kind === kind)[index];
    if (!item || item.completed) throw new Error("Missing/duplicate mock response: " + kind + " " + index);
    item.complete(value);
  }, { kind, index, value });
  await settle(page);
}
async function imageResult(page, id) {
  const image = await page.locator(".newDesignerPhoto canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
  return { image, jobId: "browser-mock-" + id, creditsUsed: 0, conceptId: "selected-look", generatedAt: new Date().toISOString() };
}
function qa(status = "pass", issue = "Mock QA for lifecycle testing only") {
  return { available: true, status, fabricFidelity: status === "pass" ? "strong" : "weak", colorFidelity: "strong", patternFidelity: "strong", boundary: "strong", construction: "strong", mannequinConsistency: "strong", artifact: "none", issue, repairInstruction: status === "pass" ? "" : "restore selected cloth" };
}
async function start(page) {
  await button(page, "Lock final design").click();
  await button(page, "Final photoreal ✦").click();
  await settle(page);
}
async function alternative(page, selector) {
  return page.locator(selector).evaluate((select) => [...select.options].find((option) => option.value !== select.value && !option.disabled).value);
}
async function changeShirt(page, id) {
  const value = id || await alternative(page, "#designer-shirt");
  await page.locator("#designer-shirt").selectOption(value);
  await ready(page);
  return value;
}
async function cleared(page) {
  assert.equal(await page.locator(".newDesignerPhotoAi").count(), 0, "Stale image must not be displayed");
  assert.equal(await page.locator(".newDesignerSelectedQa").count(), 0, "Stale QA must not approve the new design");
  assert.equal(await button(page, "Lock final design").isEnabled(), true);
}
async function regression(name, run) {
  const { page, context } = await freshPage();
  try {
    await run(page);
    summary.regressions.push({ name, status: "passed" });
    console.log("PASS " + name);
  } catch (error) {
    await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
  }
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 768, 1440]) {
    const { page, context, logo } = await freshPage(width, width === 390);
    for (const [selector, attribute] of [
      ['link[rel="icon"]', "href"],
      ['link[rel="apple-touch-icon"]', "href"],
      ['meta[property="og:image"]', "content"],
      ['meta[name="twitter:image"]', "content"],
    ]) {
      const url = await page.locator(selector).getAttribute(attribute);
      assert.equal(new URL(url, baseURL).pathname, logo.source, "Brand metadata must use the displayed logo");
    }
    assert.equal(Number(await page.locator('meta[property="og:image:width"]').getAttribute("content")), logo.width);
    assert.equal(Number(await page.locator('meta[property="og:image:height"]').getAttribute("content")), logo.height);
    if (width === 390) {
      const alias = await page.request.get(baseURL + "/brand/linen-earth-logo.png", { maxRedirects: 0 });
      assert.equal(alias.status(), 307);
      assert.equal(new URL(alias.headers().location, baseURL).pathname, logo.source);
      assert.equal(alias.headers()["cache-control"], "public, max-age=3600");
      const asset = await page.request.get(baseURL + logo.source);
      assert.equal(asset.status(), 200);
      assert.ok(asset.headers()["content-type"].includes("image/png"));
      const hash = createHash("sha256").update(await asset.body()).digest("hex");
      assert.equal(logo.source, "/brand/linen-earth-logo-" + hash.slice(0, 12) + ".png");
      summary.branding.legacyAliasAndContentIdentity = "passed";
    }
    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector(".newDesignerPhoto canvas");
      const ctx = canvas.getContext("2d");
      const colors = new Set();
      for (let y = 30; y < canvas.height; y += 100) {
        for (let x = 30; x < canvas.width; x += 100) colors.add([...ctx.getImageData(x, y, 1, 1).data].join(","));
      }
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, paintedColors: colors.size };
    });
    assert.ok(metrics.documentWidth <= width + 2, "Horizontal overflow at " + width + "px: " + metrics.documentWidth);
    assert.ok(metrics.paintedColors > 16, "The real photograph/canvas must render at " + width + "px");
    await page.screenshot({ path: path.join(output, "designer-" + width + ".png"), fullPage: true });
    await page.locator(".atelierBrandBand").screenshot({ path: path.join(output, "brand-header-" + width + ".png") });
    await page.locator(".newDesignerPhoto").screenshot({ path: path.join(output, "preview-" + width + ".png") });
    const before = await page.locator("#designer-shirt").inputValue();
    await changeShirt(page);
    assert.notEqual(await page.locator("#designer-shirt").inputValue(), before);
    await button(page, "Lock final design").click();
    assert.equal(await button(page, "Final photoreal ✦").isEnabled(), true);
    assert.deepEqual(await counts(page), { renders: 0, inspections: 0 }, "Live edits/locking must not call a paid provider");
    summary.viewports.push({ ...metrics, logo, brandMetadata: "passed", fabricSelectionAndLock: "passed" });
    await context.close();
    console.log("PASS brand images/metadata, real Canvas and controls at " + width + "px");
  }

  await regression("Delayed generation cannot repopulate a changed design or its cache", async (page) => {
    const original = await page.locator("#designer-shirt").inputValue();
    const old = await imageResult(page, "old-generation");
    await start(page);
    await changeShirt(page);
    assert.equal((await request(page, "render", 0)).aborted, true);
    await complete(page, "render", 0, { result: old });
    await cleared(page);
    assert.deepEqual(await counts(page), { renders: 1, inspections: 0 });
    await changeShirt(page, original);
    await start(page);
    assert.deepEqual(await counts(page), { renders: 2, inspections: 0 }, "Returning to the old fabric must generate afresh");
  });
  await regression("Delayed QA cannot approve a replacement fabric", async (page) => {
    await start(page);
    await complete(page, "render", 0, { result: await imageResult(page, "old-qa") });
    assert.equal((await counts(page)).inspections, 1);
    await changeShirt(page);
    assert.equal((await request(page, "inspect", 0)).aborted, true);
    await complete(page, "inspect", 0, { check: qa() });
    await cleared(page);
  });
  await regression("Delayed secondary view is discarded after a collar change", async (page) => {
    await start(page);
    await complete(page, "render", 0, { result: await imageResult(page, "front") });
    await complete(page, "inspect", 0, { check: qa() });
    await page.locator(".newDesignerPhotoAi").waitFor({ state: "visible" });
    await button(page, "Generate back").click();
    const collar = page.locator(".newDesignerStyleBlock").getByLabel(/Shirt collar/);
    const value = await collar.evaluate((select) => [...select.options].find((item) => item.value !== select.value).value);
    await collar.selectOption(value);
    await ready(page);
    assert.equal((await request(page, "render", 1)).aborted, true);
    await complete(page, "render", 1, { result: await imageResult(page, "old-back") });
    await cleared(page);
    assert.equal((await counts(page)).inspections, 1, "A stale secondary view must not dispatch QA");
  });
  await regression("Delayed repair cannot replace or unlock the new request", async (page) => {
    await start(page);
    await complete(page, "render", 0, { result: await imageResult(page, "review-front") });
    await complete(page, "inspect", 0, { check: qa("review") });
    await button(page, "Repair once ✦").click();
    await changeShirt(page);
    await start(page);
    assert.equal((await request(page, "render", 1)).aborted, true);
    await complete(page, "render", 1, { result: await imageResult(page, "old-repair") });
    assert.equal(await button(page, "Rendering…").isDisabled(), true, "Old finally must not clear newer loading");
    assert.equal((await request(page, "render", 2)).aborted, false);
    assert.equal((await counts(page)).inspections, 1);
    await complete(page, "render", 2, { result: await imageResult(page, "replacement") });
    await complete(page, "inspect", 1, { check: qa("pass", "Mock replacement QA accepted") });
    await page.locator(".newDesignerPhotoAi").waitFor({ state: "visible" });
    assert.ok((await page.locator(".newDesignerSelectedQa").innerText()).includes("Mock replacement QA accepted"));
  });
  await regression("Same-frame duplicate clicks dispatch once; unmount cancels", async (page) => {
    await button(page, "Lock final design").click();
    await button(page, "Final photoreal ✦").evaluate((element) => { element.click(); element.click(); });
    await settle(page);
    assert.deepEqual(await counts(page), { renders: 1, inspections: 0 });
    // Client navigation keeps the old signal reachable, unlike a full reload.
    const navigation = page.locator("a[href='/']").first();
    await navigation.click();
    await page.waitForURL(baseURL + "/");
    await settle(page);
    assert.equal((await request(page, "render", 0)).aborted, true);
  });
  assert.deepEqual(summary.errors, [], "No console/page errors or escaped paid requests");
  console.log("Browser UI/lifecycle verification passed. Physical/device acceptance remains open.");
})().catch(async (error) => {
  summary.failure = error.stack || error.message;
  console.error(summary.failure);
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(output, "failure.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
}).finally(async () => {
  await fs.writeFile(path.join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  await browser?.close();
});
