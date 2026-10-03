// Real Chromium and the real questionnaire/photo compositor. Only backend
// responses are mocked; this is not physical-fabric or device acceptance.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

// Use the actual deterministic engine and stock for fixture look contracts.
const modules = new Map();
function load(file) {
  const full = path.resolve(file);
  if (modules.has(full)) return modules.get(full).exports;
  if (full.endsWith(".json")) return JSON.parse(fs.readFileSync(full, "utf8"));
  const loaded = new Module(full);
  loaded.filename = full;
  loaded.paths = Module._nodeModulePaths(path.dirname(full));
  modules.set(full, loaded);
  const nativeRequire = loaded.require.bind(loaded);
  loaded.require = (specifier) => {
    const target = specifier.startsWith("@/") ? path.resolve("src", specifier.slice(2))
      : specifier.startsWith(".") ? path.resolve(path.dirname(full), specifier) : null;
    if (target) {
      for (const candidate of [target, target + ".ts", path.join(target, "index.ts")]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return load(candidate);
      }
    }
    return nativeRequire(specifier);
  };
  loaded._compile(ts.transpileModule(fs.readFileSync(full, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, full);
  return loaded.exports;
}
const answers = { occasion: "Work", mood: "Quiet", time: "Day", climate: "Indoor", garment: "shirt", colorDirection: "Light" };
const looks = load("src/lib/style-director-agent.ts").createStyleDirectorLooks(answers);
const passingCheck = { available: true, status: "pass", fabricFidelity: "strong", colorFidelity: "strong", patternFidelity: "strong", boundary: "strong", construction: "strong", mannequinConsistency: "strong", artifact: "none" };
assert.equal(looks.length, 3);
assert.ok(looks.every((look) => look.realModel), "Fixture must use the real photographed shirt/trouser path");

const runtime = process.env.LINEN_BROWSER_QA_RUNTIME;
if (!runtime) throw new Error("Set LINEN_BROWSER_QA_RUNTIME to the pinned CI test runtime.");
const { chromium } = Module.createRequire(path.join(runtime, "package.json"))("playwright");
const baseURL = process.env.LINEN_BROWSER_QA_URL || "http://127.0.0.1:3000";
const output = path.resolve("artifacts/preview-lifecycle/style-director");
const summary = {
  browser: "Chromium", providerResponses: "mocked; no paid provider calls",
  calibration: "unverified except synthetic API-change regressions",
  physicalOrDeviceAcceptance: false, viewports: [], regressions: [], errors: [],
};
let browser;

async function freshPage(width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => summary.errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") summary.errors.push(message.text()); });
  await context.route("**/api/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (/look-render|look-inspect|creative-render|creative-inspect|^\/api\/style-director$/.test(pathname)) {
      summary.errors.push("Backend request escaped browser mock: " + pathname);
    }
    return route.fulfill({ status: 200, json: {} });
  });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.__linenDirectorQA = { requests: [], calibration: { verified: false } };
    window.fetch = (input, options = {}) => {
      const pathname = new URL(typeof input === "string" ? input : input.url, location.href).pathname;
      if (pathname === "/api/designer/photo-calibration") {
        return Promise.resolve(new Response(JSON.stringify(window.__linenDirectorQA.calibration), { status: 200 }));
      }
      const kind = pathname === "/api/style-director" ? "directions" : pathname === "/api/designer/look-render" ? "render" : pathname === "/api/designer/look-inspect" ? "inspect" : null;
      if (!kind) return originalFetch(input, options);
      return new Promise((resolve) => window.__linenDirectorQA.requests.push({
        kind, body: JSON.parse(options.body || "{}"), signal: options.signal, completed: false,
        // Intentionally deliver responses after abort: server work may already
        // be running, so cancellation alone must not protect state or memory.
        complete(value, status) {
          this.completed = true;
          resolve(new Response(typeof value === "string" ? value : JSON.stringify(value), { status, headers: { "content-type": "application/json" } }));
        },
      }));
    };
  });
  await page.goto(baseURL + "/style-director", { waitUntil: "networkidle" });
  await page.locator(".brandIntro").waitFor({ state: "hidden" });
  return { page, context };
}
async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 30)))));
}
const photoButton = (page) => page.locator(".directorActions .photoAction");
async function ready(page) {
  await page.waitForFunction(() => {
    const button = document.querySelector(".directorActions .photoAction");
    return button && !button.disabled && document.querySelector('.directorExistingModel[data-ready="true"]');
  }, null, { timeout: 30000 });
}
async function count(page, kind) {
  return page.evaluate((kind) => window.__linenDirectorQA.requests.filter((item) => item.kind === kind).length, kind);
}
async function request(page, kind, index) {
  return page.evaluate(({ kind, index }) => {
    const item = window.__linenDirectorQA.requests.filter((item) => item.kind === kind)[index];
    return { aborted: item.signal?.aborted || false, body: item.body };
  }, { kind, index });
}
async function complete(page, kind, index, value, status = 200) {
  await page.evaluate(({ kind, index, value, status }) => {
    const item = window.__linenDirectorQA.requests.filter((item) => item.kind === kind)[index];
    if (!item || item.completed) throw new Error("Missing/duplicate response: " + kind + " " + index);
    item.complete(value, status);
  }, { kind, index, value, status });
  await settle(page);
}
async function memory(page, type) {
  return page.evaluate((type) => JSON.parse(localStorage.getItem("linen-earth:style-memory:v1") || "[]").filter((item) => item.type === type), type);
}
async function journey(page, respond = true, duplicateLast = false) {
  const before = await count(page, "directions");
  for (const label of ["Work", "Quiet", "Day", "Indoor / AC", "Shirt", "Light"]) {
    const option = page.locator(".directorOption").filter({ has: page.locator("strong").getByText(label, { exact: true }) });
    await option.waitFor({ state: "visible" });
    if (label === "Light" && duplicateLast) await option.evaluate((button) => { button.click(); button.click(); });
    else await option.click();
  }
  await page.waitForFunction((before) => window.__linenDirectorQA.requests.filter((item) => item.kind === "directions").length > before, before);
  if (respond) {
    await complete(page, "directions", before, { looks });
    await ready(page);
  }
  return before;
}
async function start(page, duplicate = false) {
  const before = await count(page, "render");
  const image = await page.locator(".directorExistingModel canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
  if (duplicate) await photoButton(page).evaluate((button) => { button.click(); button.click(); });
  else await photoButton(page).click();
  await settle(page);
  assert.equal(await count(page, "render"), before + 1, "Each action must dispatch exactly one paid request");
  const item = await request(page, "render", before);
  assert.equal(item.body.locked, true);
  assert.match(item.body.lockedPreviewImage, /^data:image\/(webp|png);base64,/);
  return { index: before, result: { image, jobId: "browser-mock-" + before, creditsUsed: 0, conceptId: "mock-only", generatedAt: new Date().toISOString() } };
}
async function selectLook(page, index) {
  await page.locator(".lookTabs button").nth(index).click();
  await page.locator('.directorExistingModel[data-ready="true"]').waitFor({ state: "visible" });
  await settle(page);
}
async function generated(page, render) {
  const index = await count(page, "inspect");
  await complete(page, "render", render.index, { result: render.result });
  assert.equal(await count(page, "inspect"), index + 1, "Generated image requires one fidelity inspection");
  const inspection = await request(page, "inspect", index);
  const generation = await request(page, "render", render.index);
  assert.equal(inspection.body.image, render.result.image);
  assert.equal(inspection.body.jobId, render.result.jobId);
  assert.equal(inspection.body.view, "front");
  assert.equal(inspection.body.look.locked, true);
  for (const field of ["shirt", "pant", "style"]) assert.deepEqual(inspection.body.look[field], generation.body[field]);
  await cleared(page);
  assert.equal(await photoButton(page).isDisabled(), true);
  assert.match(await photoButton(page).textContent(), /Checking photoreal/);
  return index;
}
async function approved(page, render) {
  const index = await generated(page, render);
  await complete(page, "inspect", index, { check: passingCheck });
  await page.locator(".lookVisual > img").evaluate((image) => image.decode());
  assert.equal((await memory(page, "render_completed")).length, 1);
  assert.equal(await photoButton(page).isDisabled(), true);
  assert.match(await photoButton(page).textContent(), /Photoreal ready/);
  return index;
}
async function cleared(page) {
  assert.equal(await page.locator(".lookVisual > img").count(), 0, "Old render must not replace the selected real-model look");
  assert.equal((await memory(page, "render_completed")).length, 0, "Discarded renders must not enter style memory");
}
async function modelFraming(page, generatedImage = false) {
  const metrics = await page.evaluate((generatedImage) => {
    const frame = document.querySelector(generatedImage ? ".lookVisual" : ".directorExistingModel");
    const media = frame.querySelector(generatedImage ? ":scope > img" : "canvas");
    const f = frame.getBoundingClientRect(), m = media.getBoundingClientRect();
    const naturalWidth = generatedImage ? media.naturalWidth : media.width;
    const naturalHeight = generatedImage ? media.naturalHeight : media.height;
    const scale = Math.min(m.width / naturalWidth, m.height / naturalHeight);
    const width = naturalWidth * scale, height = naturalHeight * scale;
    const left = m.left + (m.width - width) / 2, top = m.top + (m.height - height) / 2;
    return {
      objectFit: getComputedStyle(media).objectFit,
      objectPosition: getComputedStyle(media).objectPosition,
      frame: { width: f.width, height: f.height },
      media: { width: m.width, height: m.height },
      completeModelFits: left >= f.left - 1 && top >= f.top - 1 && left + width <= f.right + 1 && top + height <= f.bottom + 1,
    };
  }, generatedImage);
  assert.equal(metrics.objectFit, "contain", "The model must retain its complete intrinsic image");
  assert.equal(metrics.objectPosition, "50% 50%", "Framing bounds assume the centered full model");
  assert.ok(metrics.completeModelFits, "Model pixels extend beyond the clipped preview frame: " + JSON.stringify(metrics));
  return metrics;
}
async function fabricCoverage(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector(".directorExistingModel canvas"), ctx = canvas.getContext("2d");
    const source = new Image(); source.src = "/designer/studio-tucked.webp"; await source.decode();
    const original = document.createElement("canvas"); original.width = canvas.width; original.height = canvas.height;
    const originalContext = original.getContext("2d"); originalContext.drawImage(source, 0, 0);
    const pixel = (context, x, y) => [...context.getImageData(x, y, 1, 1).data];
    const brightness = (value) => (value[0] + value[1] + value[2]) / 3;
    // Real neutral folds where the old RGB classifier exposed the dark source
    // shirt through a pale selected cloth. These are output checks, not masks.
    const folds = [[626, 490], [626, 493], [626, 496]].map(([x, y]) => ({
      x, y, source: brightness(pixel(originalContext, x, y)), rendered: brightness(pixel(ctx, x, y)),
    }));
    const protectedPixels = [[512, 100], [445, 1420], [610, 1430], [100, 300]].map(([x, y]) => ({ x, y, rgba: pixel(ctx, x, y) }));
    return { folds, protectedPixels };
  });
}
async function regression(name, run) {
  const { page, context } = await freshPage();
  try {
    await run(page);
    summary.regressions.push({ name, status: "passed" });
    console.log("PASS " + name);
  } catch (error) {
    summary.regressions.push({ name, status: "failed", error: error.message });
    await page.screenshot({ path: path.join(output, name + "-failure.png"), fullPage: true }).catch(() => {});
    console.error("FAIL " + name + ": " + error.message);
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 768, 1440]) {
    const { page, context } = await freshPage(width);
    await page.screenshot({ path: path.join(output, "journey-" + width + ".png"), fullPage: true });
    await journey(page);
    const initialFraming = await modelFraming(page);
    const initialCoverage = await fabricCoverage(page);
    for (const fold of initialCoverage.folds) assert.ok(fold.rendered > fold.source + 15, "Pale cloth leaves an exposed source-shirt fold: " + JSON.stringify(fold));
    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector(".directorExistingModel canvas");
      const ctx = canvas.getContext("2d"), colors = new Set();
      for (let y = 30; y < canvas.height; y += 100) for (let x = 30; x < canvas.width; x += 100) {
        colors.add([...ctx.getImageData(x, y, 1, 1).data].join(","));
      }
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth, paintedColors: colors.size };
    });
    assert.ok(metrics.documentWidth <= width + 2, "Horizontal overflow: " + metrics.documentWidth);
    assert.ok(metrics.paintedColors > 16, "Real photograph/canvas must actually paint");
    await page.screenshot({ path: path.join(output, "results-" + width + ".png"), fullPage: true });
    await page.locator(".lookVisual").screenshot({ path: path.join(output, "preview-" + width + ".png") });
    await selectLook(page, 1);
    const selectedFraming = await modelFraming(page);
    const selectedCoverage = await fabricCoverage(page);
    assert.deepEqual(selectedCoverage.protectedPixels, initialCoverage.protectedPixels, "Fabric changes must preserve the head, shoes and studio pixels");
    assert.equal(await count(page, "render"), 0, "Live look selection must stay deterministic");
    assert.equal(await page.locator(".lookTabs button.active").textContent(), await page.locator(".lookTabs button").nth(1).textContent());
    const render = await start(page);
    const inspection = await generated(page, render);
    await page.screenshot({ path: path.join(output, "checking-" + width + ".png"), fullPage: true });
    await complete(page, "inspect", inspection, { check: { ...passingCheck, status: "review", colorFidelity: "weak" } });
    const heldFraming = await modelFraming(page);
    assert.match(await photoButton(page).textContent(), /Retry photoreal check/);
    await cleared(page);
    const heldWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(heldWidth <= width + 2, "Held QA state must not overflow: " + heldWidth);
    await page.screenshot({ path: path.join(output, "held-" + width + ".png"), fullPage: true });
    const retry = await count(page, "inspect");
    await photoButton(page).click();
    await settle(page);
    assert.equal(await count(page, "render"), 1, "Retry must reuse the generated image");
    await complete(page, "inspect", retry, { check: passingCheck });
    await page.locator(".lookVisual > img").evaluate((image) => image.decode());
    const approvedFraming = await modelFraming(page, true);
    assert.equal((await memory(page, "render_completed")).length, 1);
    await page.screenshot({ path: path.join(output, "approved-" + width + ".png"), fullPage: true });
    summary.viewports.push({ ...metrics, questionnaireAndLookSelection: "passed", fidelityGateAndRetry: "passed", fabricCoverage: initialCoverage, protectedPixelsPreserved: true, framing: { initial: initialFraming, selected: selectedFraming, held: heldFraming, approved: approvedFraming } });
    await context.close();
  }
  await regression("delayed-render-and-return-to-same-look", async (page) => {
    await journey(page);
    const old = await start(page);
    await selectLook(page, 1);
    await complete(page, "render", old.index, { result: old.result });
    await cleared(page);
    assert.equal(await count(page, "inspect"), 0, "Discarded generation must not dispatch QA");
    assert.equal((await request(page, "render", old.index)).aborted, true);
    await selectLook(page, 0);
    const fresh = await start(page);
    await approved(page, fresh);
    assert.equal((await memory(page, "render_completed"))[0].payload.lookId, looks[0].id);
    assert.equal(await photoButton(page).isDisabled(), true);
  });
  await regression("stale-error-cannot-unlock-new-render", async (page) => {
    await journey(page);
    const old = await start(page);
    await selectLook(page, 1);
    const fresh = await start(page);
    await complete(page, "render", old.index, { error: "Discard this old error" }, 500);
    assert.equal(await page.locator(".directorError").count(), 0);
    assert.equal(await photoButton(page).isDisabled(), true);
    assert.match(await photoButton(page).textContent(), /Rendering/);
    await approved(page, fresh);
    assert.equal((await memory(page, "render_completed"))[0].payload.lookId, looks[1].id);
  });
  await regression("restart-discards-photoreal", async (page) => {
    await journey(page);
    const old = await start(page);
    await page.getByRole("button", { name: "Start over ↺", exact: true }).click();
    await page.locator(".directorJourney").waitFor({ state: "visible" });
    await complete(page, "render", old.index, { result: old.result });
    await cleared(page);
    assert.equal((await request(page, "render", old.index)).aborted, true);
    await journey(page);
    assert.equal(await photoButton(page).isEnabled(), true);
  });
  await regression("calibration-change-discards-pending-render", async (page) => {
    await journey(page);
    const old = await start(page);
    await page.evaluate(() => {
      window.__linenDirectorQA.calibration = { verified: true, photoPxPerMm: 2, scaleCoordinateSystem: "photo-1024x1536-fixture", proofVersion: "linen-earth-phase1-proof-v4" };
      window.dispatchEvent(new Event("focus"));
    });
    await settle(page);
    await complete(page, "render", old.index, { result: old.result });
    await cleared(page);
    assert.equal((await request(page, "render", old.index)).aborted, true);
    await start(page);
  });
  await regression("duplicate-photoreal-clicks", async (page) => {
    await journey(page);
    await start(page, true);
    assert.equal((await memory(page, "render_requested")).filter((event) => event.payload.mode === "photo").length, 1);
  });
  await regression("duplicate-directions-clicks", async (page) => {
    await journey(page, false, true);
    assert.equal(await count(page, "directions"), 1);
    assert.equal((await memory(page, "answer_selected")).filter((event) => event.payload.step === "colorDirection").length, 1);
  });
  await regression("restart-discards-pending-directions", async (page) => {
    const old = await journey(page, false);
    await page.getByRole("button", { name: "Start over ↺", exact: true }).click();
    const fresh = await journey(page, false);
    await complete(page, "directions", old, { looks });
    assert.equal(await page.locator(".lookTabs").count(), 0);
    assert.equal((await memory(page, "looks_generated")).length, 0);
    assert.equal(await page.locator(".directorLoading").count(), 1);
    assert.equal((await request(page, "directions", old)).aborted, true);
    await complete(page, "directions", fresh, { looks });
    await ready(page);
    assert.equal((await memory(page, "looks_generated")).length, 1);
  });
  await regression("unmount-discards-render", async (page) => {
    await journey(page);
    const old = await start(page);
    await page.locator(".atelierBrand").click();
    await page.waitForURL(baseURL + "/");
    assert.equal((await request(page, "render", old.index)).aborted, true);
    await complete(page, "render", old.index, { result: old.result });
    assert.equal((await memory(page, "render_completed")).length, 0);
  });
  await regression("active-look-tab-keeps-ready-preview", async (page) => {
    await journey(page);
    await selectLook(page, 0);
    assert.equal(await photoButton(page).isEnabled(), true);
    await start(page);
  });
  for (const [name, check, status] of [
    ["review", { ...passingCheck, status: "review", construction: "weak" }, 200],
    ["unavailable", { ...passingCheck, available: false }, 200],
    ["missing-check", undefined, 200],
    ["incomplete-pass", { available: true, status: "pass" }, 200],
    ["contradictory-pass", { ...passingCheck, mannequinConsistency: "weak" }, 200],
    ["inspection-error", passingCheck, 500],
    ["invalid-json", undefined, 200],
  ]) {
    await regression("held-" + name + "-reuses-image-on-retry", async (page) => {
      await journey(page);
      const render = await start(page);
      const inspection = await generated(page, render);
      await complete(page, "inspect", inspection, name === "invalid-json" ? "{" : { check }, status);
      await cleared(page);
      assert.equal(await page.locator('.directorExistingModel[data-ready="true"]').count(), 1);
      assert.equal(await photoButton(page).isEnabled(), true);
      assert.match(await photoButton(page).textContent(), /Retry photoreal check/);
      assert.equal(await page.locator('.directorQaStatus[role="status"]').count(), 1);
      await photoButton(page).evaluate((button) => { button.click(); button.click(); });
      await settle(page);
      assert.equal(await count(page, "render"), 1);
      assert.equal(await count(page, "inspect"), 2, "Duplicate retry clicks inspect once");
      const retry = await request(page, "inspect", 1);
      const first = await request(page, "inspect", 0);
      assert.deepEqual(retry.body, first.body, "Retry must inspect the exact same image and locked look");
      assert.equal((await memory(page, "render_requested")).length, 1);
      await complete(page, "inspect", 1, { check: passingCheck });
      await page.locator(".lookVisual > img").evaluate((image) => image.decode());
      assert.equal((await memory(page, "render_completed")).length, 1);
      await photoButton(page).evaluate((button) => button.click());
      await settle(page);
      assert.equal(await count(page, "render"), 1);
      assert.equal(await count(page, "inspect"), 2);
    });
  }
  await regression("look-change-discards-delayed-qa-and-old-qa-error", async (page) => {
    await journey(page);
    const old = await start(page);
    const oldInspection = await generated(page, old);
    await selectLook(page, 1);
    const fresh = await start(page);
    const freshInspection = await generated(page, fresh);
    await complete(page, "inspect", oldInspection, { error: "Old QA failed" }, 500);
    await cleared(page);
    assert.match(await photoButton(page).textContent(), /Checking photoreal/);
    assert.equal(await photoButton(page).isDisabled(), true);
    assert.equal((await request(page, "inspect", oldInspection)).aborted, true);
    await complete(page, "inspect", freshInspection, { check: passingCheck });
    assert.equal((await memory(page, "render_completed"))[0].payload.lookId, looks[1].id);
  });
  for (const action of ["look", "restart", "calibration", "unmount"]) {
    await regression(action + "-discards-delayed-qa-approval", async (page) => {
      await journey(page);
      const old = await start(page);
      const inspection = await generated(page, old);
      if (action === "look") await selectLook(page, 1);
      if (action === "restart") {
        await page.getByRole("button", { name: "Start over ↺", exact: true }).click();
        await page.locator(".directorJourney").waitFor({ state: "visible" });
      }
      if (action === "calibration") {
        await page.evaluate(() => {
          window.__linenDirectorQA.calibration = { verified: true, photoPxPerMm: 2, scaleCoordinateSystem: "photo-1024x1536-fixture", proofVersion: "linen-earth-phase1-proof-v4" };
          window.dispatchEvent(new Event("focus"));
        });
        await settle(page);
      }
      if (action === "unmount") {
        await page.locator(".atelierBrand").click();
        await page.waitForURL(baseURL + "/");
      }
      await complete(page, "inspect", inspection, { check: passingCheck });
      await cleared(page);
      assert.equal((await request(page, "inspect", inspection)).aborted, true);
      if (action === "look" || action === "calibration") {
        await ready(page);
        assert.match(await photoButton(page).textContent(), /Make photoreal/);
        await start(page);
        assert.equal(await count(page, "render"), 2, "New look/calibration cannot reuse the old generated image");
      }
    });
  }
  assert.deepEqual(summary.errors, [], "No browser errors or unmocked backend calls");
  assert.equal(summary.regressions.filter((item) => item.status === "failed").length, 0, "Style Director lifecycle regressions failed");
})().catch((error) => {
  summary.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  if (browser) await browser.close();
});
