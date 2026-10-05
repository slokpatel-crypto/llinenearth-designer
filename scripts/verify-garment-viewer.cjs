const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");

const runtime = process.env.LINEN_BROWSER_QA_RUNTIME;
if (!runtime) throw new Error("Set LINEN_BROWSER_QA_RUNTIME to the pinned CI test runtime.");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const baseURL = process.env.LINEN_BROWSER_QA_URL || "http://127.0.0.1:3000";
const output = path.resolve("artifacts/preview-lifecycle");

async function verifyViewport(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(baseURL + "/lab/garment-viewer", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => Boolean(customElements.get("model-viewer")), null, { timeout: 20000 });
  const viewer = page.locator("model-viewer");
  await viewer.waitFor({ state: "visible" });
  await page.locator(".garmentViewerLoading").waitFor({ state: "hidden", timeout: 20000 });

  const modelState = await viewer.evaluate((element) => {
    const materials = element.model?.materials || [];
    return {
      materialNames: materials.map((material) => material.name),
      cameraOrbit: element.getAttribute("camera-orbit"),
      hasCreateTexture: typeof element.createTexture === "function",
    };
  });
  assert.ok(modelState.materialNames.includes("ShirtFabric"), "3D model must expose ShirtFabric");
  assert.ok(modelState.materialNames.includes("TrouserFabric"), "3D model must expose TrouserFabric");
  assert.equal(modelState.hasCreateTexture, true, "model-viewer scene graph texture API must be available");

  const buttons = page.locator(".garmentCameraRail button");
  assert.equal(await buttons.count(), 4);
  await page.getByRole("button", { name: "Side", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("model-viewer")?.getAttribute("camera-orbit")?.startsWith("90deg"));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("model-viewer")?.getAttribute("camera-orbit")?.startsWith("180deg"));

  const selects = page.locator(".garmentViewerControls select");
  assert.equal(await selects.count(), 2);
  for (let index = 0; index < 2; index++) {
    const select = selects.nth(index);
    const before = await select.inputValue();
    const next = await select.evaluate((node) => [...node.options].find((option) => option.value !== node.value)?.value || "");
    assert.ok(next, "Each garment selector needs an alternate Linen Earth fabric");
    await select.selectOption(next);
    assert.notEqual(await select.inputValue(), before);
  }

  await page.waitForTimeout(400);
  const materialState = await viewer.evaluate((element) => {
    const material = (name) => element.model?.materials?.find((item) => item.name === name);
    return ["ShirtFabric", "TrouserFabric"].map((name) => {
      const current = material(name);
      return {
        name,
        roughness: current?.pbrMetallicRoughness?.roughnessFactor,
        metallic: current?.pbrMetallicRoughness?.metallicFactor,
        hasTexture: Boolean(current?.pbrMetallicRoughness?.baseColorTexture?.texture),
        hasNormal: Boolean(current?.normalTexture?.texture),
      };
    });
  });
  for (const material of materialState) {
    assert.equal(material.metallic, 0, material.name + " must remain non-metallic");
    assert.ok(material.roughness >= .55 && material.roughness <= .98, material.name + " roughness must stay in the cloth range");
    assert.equal(material.hasTexture, true, material.name + " must carry the selected swatch texture");
    assert.equal(material.hasNormal, true, material.name + " must carry linen normal detail");
  }

  const layout = await page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewerWidth: document.querySelector(".garmentViewerCanvas")?.getBoundingClientRect().width || 0,
    viewerHeight: document.querySelector(".garmentViewerCanvas")?.getBoundingClientRect().height || 0,
  }));
  assert.ok(layout.documentWidth <= width + 2, "GarmentViewer horizontal overflow at " + width + "px");
  assert.ok(layout.viewerWidth > 250 && layout.viewerHeight > 400, "GarmentViewer canvas must remain usable");

  await page.screenshot({ path: path.join(output, "garment-viewer-" + width + ".png"), fullPage: true });
  assert.deepEqual(errors, [], "GarmentViewer must load without console/page errors");
  await context.close();
  return { width, modelState, materialState, layout };
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const viewports = [];
    for (const width of [390, 1440]) viewports.push(await verifyViewport(browser, width));
    await fs.writeFile(
      path.join(output, "garment-viewer-summary.json"),
      JSON.stringify({ browser: "Chromium", paidProviderCalls: 0, viewports }, null, 2) + "\n",
    );
    console.log("GarmentViewer browser verification passed at mobile and desktop widths.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
