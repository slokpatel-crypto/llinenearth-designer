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
  const staleDesignerDraft={
    shirtId:"linen-plain-60-sky-blue",
    pantId:"linen-suiting-dark-grey",
    occasion:"Formal",
    style:{
      collar:"Spread Collar",
      cuff:"French / Double Cuff",
      placket:"Hidden / Fly-front",
      shirtFit:"Slim Fit",
      shirtWear:"Tucked",
      trouser:"Pleated Trouser",
      rise:"High Rise",
      waistband:"Side-Adjuster Tabs",
      break:"Slight Break",
      button:"Mother-of-Pearl",
    },
  };
  await context.addInitScript((draft)=>{
    localStorage.setItem("linen-earth:real-designer-draft:v2",JSON.stringify(draft));
  },staleDesignerDraft);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(()=>{
    localStorage.setItem("linen-earth:real-designer-draft:v2",JSON.stringify({
      occasion:"Semi-Formal",
      style:{
        collar:"Spread Collar",
        cuff:"Barrel Cuff (2-button)",
        placket:"French Placket",
        shirtFit:"Regular / Classic Fit",
        shirtWear:"Tucked",
        trouser:"Pleated Trouser",
        rise:"High Rise",
        waistband:"Side-Adjuster Tabs",
        break:"Slight Break",
      },
    }));
  });

  await page.goto(baseURL + "/lab/garment-viewer?from=designer&shirt=linen-plain-60-peach&pant=linen-suiting-beige", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => Boolean(customElements.get("model-viewer")), null, { timeout: 20000 });
  const engineResources=await page.evaluate(()=>performance.getEntriesByType("resource").map((entry)=>entry.name).filter((name)=>name.includes("model-viewer")));
  assert.ok(engineResources.some((name)=>name.includes("/vendor/model-viewer")), "3D engine must load through the Linen Earth origin");
  assert.equal(engineResources.some((name)=>name.includes("ajax.googleapis.com")), false, "Browser must not depend on the Google CDN for the 3D engine");
  const viewer = page.locator("model-viewer");
  await viewer.waitFor({ state: "visible" });
  await page.locator(".garmentViewerLoading").waitFor({ state: "hidden", timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".garmentViewerShell")?.getAttribute("data-model-readiness") === "prototype");
  const labReadiness = await page.locator(".garmentViewerShell").evaluate((element) => ({
    model: element.getAttribute("data-model-readiness"),
    manifest: element.getAttribute("data-manifest-ready"),
  }));
  assert.equal(labReadiness.model, "prototype", "default lab must remain on the non-production prototype");
  assert.equal(labReadiness.manifest, "true", "prototype fallback must not require a production sidecar");

  const modelState = await viewer.evaluate((element) => {
    const materials = element.model?.materials || [];
    return {
      materialNames: materials.map((material) => material.name),
      cameraOrbit: element.getAttribute("camera-orbit"),
      hasCreateTexture: typeof element.createTexture === "function",
    };
  });
  assert.equal(modelState.materialNames.filter((name) => name.startsWith("Shirt")).length, 3, "3D model must expose three independent shirt panels");
  assert.equal(modelState.materialNames.filter((name) => name.startsWith("Trouser")).length, 3, "3D model must expose three independent trouser panels");
  assert.equal(modelState.hasCreateTexture, true, "model-viewer scene graph texture API must be available");

  const buttons = page.locator(".garmentCameraRail button");
  assert.equal(await buttons.count(), 4);
  await page.getByRole("button", { name: "Side", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("model-viewer")?.getAttribute("camera-orbit")?.startsWith("90deg"));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("model-viewer")?.getAttribute("camera-orbit")?.startsWith("180deg"));

  const reference=page.locator(".garmentViewerReference img");
  await reference.waitFor({state:"visible"});
  assert.match(await reference.getAttribute("src"),/studio-tucked\.webp$/, "3D lab must keep the approved studio reference target visible");

  const recipeCard=page.locator(".garmentDraftRecipe");
  await recipeCard.waitFor({state:"visible"});
  const recipeText=await recipeCard.innerText();
  assert.match(recipeText,/YOUR DESIGNER RECIPE/);
  assert.match(recipeText,/Spread Collar/);
  assert.match(recipeText,/Pleated Trouser/);
  assert.match(recipeText,/same saved shirt and trouser fabrics as Designer/i);

  const stageScope=await page.locator(".garmentViewerStageHead").innerText();
  assert.match(stageScope,/SHIRT \+ TROUSER · BLAZER \/ SUIT NEXT/,"3D stage must state current and future garment scope");

  const garmentCards=page.locator(".garmentTypeGrid article");
  assert.equal(await garmentCards.count(),4,"garment type roadmap must show current and future families");
  const garmentText=await garmentCards.allTextContents();
  assert.ok(garmentText.some((value)=>/Shirt/.test(value)&&/LIVE/.test(value)&&/Dress Shirt/.test(value)),"shirt types must be visible");
  assert.ok(garmentText.some((value)=>/Trouser/.test(value)&&/LIVE/.test(value)&&/Pleated Trouser/.test(value)),"trouser types must be visible");
  assert.ok(garmentText.some((value)=>/Blazer/.test(value)&&/FUTURE/.test(value)&&/Single-Breasted 2-Button/.test(value)),"future blazer types must be visible");
  assert.ok(garmentText.some((value)=>/Suit/.test(value)&&/FUTURE/.test(value)&&/3-Piece Suit/.test(value)),"future suit types must be visible");

  const selects = page.locator(".garmentViewerControls select");
  assert.equal(await selects.count(), 2);
  assert.equal(await selects.nth(0).inputValue(),"linen-plain-60-peach","explicit Designer handoff must override a stale saved shirt");
  assert.equal(await selects.nth(1).inputValue(),"linen-suiting-beige","explicit Designer handoff must override a stale saved trouser");
  for (let index = 0; index < 2; index++) {
    const select = selects.nth(index);
    const before = await select.inputValue();
    const next = await select.evaluate((node) => [...node.options].find((option) => option.value !== node.value)?.value || "");
    assert.ok(next, "Each garment selector needs an alternate Linen Earth fabric");
    await select.selectOption(next);
    assert.notEqual(await select.inputValue(), before);
  }

  await page.waitForTimeout(400);
  const prototypeLatencyEvidence = await page.evaluate(() => localStorage.getItem("linen-earth-garment-viewer-latency-v1"));
  assert.equal(prototypeLatencyEvidence, null, "prototype fabric changes must not create production latency evidence");
  const materialState = await viewer.evaluate((element) => {
    return (element.model?.materials || [])
      .filter((material) => /^(Shirt|Trouser)/.test(material.name))
      .map((current) => ({
        name: current.name,
        roughness: current.pbrMetallicRoughness?.roughnessFactor,
        metallic: current.pbrMetallicRoughness?.metallicFactor,
        hasTexture: Boolean(current.pbrMetallicRoughness?.baseColorTexture?.texture),
        hasNormal: Boolean(current.normalTexture?.texture),
        scale: current.pbrMetallicRoughness?.baseColorTexture?.texture?.sampler?.scale || null,
        offset: current.pbrMetallicRoughness?.baseColorTexture?.texture?.sampler?.offset || null,
        rotation: current.pbrMetallicRoughness?.baseColorTexture?.texture?.sampler?.rotation ?? null,
      }));
  });
  assert.equal(materialState.length, 6);
  for (const material of materialState) {
    assert.equal(material.metallic, 0, material.name + " must remain non-metallic");
    assert.ok(material.roughness >= .55 && material.roughness <= .98, material.name + " roughness must stay in the cloth range");
    assert.equal(material.hasTexture, true, material.name + " must carry the selected swatch texture");
    assert.equal(material.hasNormal, true, material.name + " must carry linen normal detail");
    assert.ok(material.scale && material.scale.u > 0 && material.scale.v > 0, material.name + " must carry a panel-scale texture transform");
    assert.ok(material.offset && Number.isFinite(material.offset.u) && Number.isFinite(material.offset.v), material.name + " must expose texture phase offset");
    assert.ok(Number.isFinite(material.rotation), material.name + " must expose texture grain rotation");
  }

  const layout = await page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewerWidth: document.querySelector(".garmentViewerCanvas")?.getBoundingClientRect().width || 0,
    viewerHeight: document.querySelector(".garmentViewerCanvas")?.getBoundingClientRect().height || 0,
  }));
  assert.ok(layout.documentWidth <= width + 2, "GarmentViewer horizontal overflow at " + width + "px");
  assert.ok(layout.viewerWidth > 250 && layout.viewerHeight > 400, "GarmentViewer canvas must remain usable");
  if(width<=640){
    const order=await page.evaluate(()=>{
      const stage=document.querySelector(".garmentViewerStage")?.getBoundingClientRect().top ?? 999999;
      const controls=document.querySelector(".garmentViewerControls")?.getBoundingClientRect().top ?? -1;
      return {stage,controls};
    });
    assert.ok(order.stage < order.controls, "mobile must show the 3D stage before controls");
  }

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
