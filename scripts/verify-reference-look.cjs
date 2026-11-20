// Real local-photo interaction with actual catalogue swatches. No AI/network image upload.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const sharp = require("sharp");
const runtime = process.env.LINEN_BROWSER_QA_RUNTIME;
if (!runtime) throw Error("Set LINEN_BROWSER_QA_RUNTIME to an installed Playwright runtime.");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const base = process.env.LINEN_BROWSER_QA_URL || "http://127.0.0.1:3000";
const output = path.resolve("artifacts/preview-lifecycle/reference-look");
const summary = { visualMatchingOnly: true, fabricTruthVerified: false, customerImageUploaded: false, viewports: [], pageErrors: [], apiRequests: [] };

async function run() {
  fs.mkdirSync(output, { recursive: true });
  const buffer = await sharp({
    create: { width: 40, height: 40, channels: 4, background: { r: 30, g: 60, b: 120, alpha: 1 } },
  }).png().toBuffer();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 980 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.on("pageerror", (error) => summary.pageErrors.push(error.message));
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/")) summary.apiRequests.push(request.url());
      });
      await page.goto(base + "/reference-match", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "A look you love. A cloth to explore." }).waitFor();
      await page.locator('input[type="file"]').setInputFiles({
        name: "operator-synthetic-test.png", mimeType: "image/png", buffer,
      });
      const photo = page.locator("canvas");
      await photo.waitFor({ state: "visible" });
      const size = await photo.boundingBox();
      assert.ok(size && size.width > 0 && size.height > 0, "reference photo visible");
      await photo.click({ position: { x: size.width / 2, y: size.height / 2 } });
      await page.getByText("#1E3C78", { exact: false }).waitFor();
      const shirts = await page.locator("article").count();
      assert.ok(shirts > 0 && shirts <= 6, "real catalogue shirt candidates exist");
      await page.getByRole("button", { name: "Trouser fabrics" }).click();
      const trousers = await page.locator("article").count();
      assert.ok(trousers > 0 && trousers <= 6, "real catalogue trouser candidates exist");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, "mobile viewport overflow");
      await page.screenshot({ path: path.join(output, "reference-colour-" + width + ".png"), fullPage: true });
      summary.viewports.push({ width, shirts, trousers, noOverflow: true, sampledRgb: [30, 60, 120] });
      await context.close();
    }
    assert.deepEqual(summary.pageErrors, [], "no browser errors");
    assert.deepEqual(summary.apiRequests, [], "photo matching must not send customer photo or call AI APIs");
    fs.writeFileSync(path.join(output, "evidence.json"), JSON.stringify(summary, null, 2));
    process.stdout.write("Reference-look actual browser checks passed: " + JSON.stringify(summary) + "\n");
  } finally {
    await browser.close();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
