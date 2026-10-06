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

  await page.goto(baseURL + "/lab/garment-viewer", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => Boolean(customElements.get("model-viewer")), null, { timeout: 20000 });
  const engineResources=await page.evaluate(()=>performance.getEntriesByType("resource").map((entry)=>entry.name).filter((name)=>name.includes("model-viewer")));
  assert.ok(engineResources.some((name)=>name.includes("/vendor/model-viewer")), "3D engine must load through the Linen Earth origin");
  assert.equal(engineResources.some((name)=>name.includes("ajax.googleapis.com")), false, "Browser must not depend on the Google CDN for the 3D engine");
  const viewer = page.locator("model-viewer");
  await viewer.waitFor({ state: "visible" });
  await page.locator(".garmentViewerLoading").waitFor({ state: "hidden", timeout: 20000 });
  await page.waitForFunction(() => document.querySelector(".garmentViewerShell")?.getAttribute("data-model-readiness") === "contract_ready", null, { timeout: 30000 });
  const labReadiness = await page.locator(".garmentViewerShell").evaluate((element) => ({
    model: element.getAttribute("data-model-readiness"),
    manifest: element.getAttribute("data-manifest-ready"),
  }));
  assert.equal(labReadiness.model, "contract_ready", "3D lab must load the production M7 model contract");
  assert.equal(labReadiness.manifest, "true", "production M7 model must load its verified physical-panel manifest");

  const modelState = await viewer.evaluate((element) => {
    const materials = element.model?.materials || [];
    return {
      materialNames: materials.map((material) => material.name),
      cameraOrbit: element.getAttribute("camera-orbit"),
      cameraTarget: element.getAttribute("camera-target"),
      fieldOfView: element.getAttribute("field-of-view"),
      hasCreateTexture: typeof element.createTexture === "function",
    };
  });
  assert.match(modelState.cameraOrbit||"",/3\.60m$/,"default locked camera must keep the full mannequin inside frame");
  assert.equal(modelState.cameraTarget,"0m 0.86m 0m","camera target must stay centered on the 1727 mm mannequin");
  assert.equal(modelState.fieldOfView,"30deg","default field of view must preserve head-to-shoe framing");
  assert.equal(modelState.materialNames.filter((name) => name.startsWith("Shirt")).length, 3, "3D model must expose three independent shirt panels");
  assert.equal(modelState.materialNames.filter((name) => name.startsWith("Trouser")).length, 3, "3D model must expose three independent trouser panels");
  assert.equal(modelState.hasCreateTexture, true, "model-viewer scene graph texture API must be available");

  const buttons = page.locator(".garmentCameraRail button");
  assert.equal(await buttons.count(), 4);
  await page.getByRole("button", { name: "Side", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("model-viewer")?.getAttribute("camera-orbit")?.startsWith("90deg"));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("model-viewer")?.getAttribute("camera-orbit")?.startsWith("180deg"));
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("model-viewer")?.getAttribute("camera-orbit")?.startsWith("0deg"));

  const reference=page.locator(".garmentViewerReference img");
  await reference.waitFor({state:"visible"});
  assert.match(await reference.getAttribute("src"),/studio-tucked\.webp$/, "3D lab must keep the approved studio reference target visible");

  const recipe=await page.locator(".garmentDraftRecipe").innerText();
  assert.match(recipe,/YOUR DESIGNER RECIPE/);
  assert.match(recipe,/Spread Collar/);
  assert.match(recipe,/Pleated Trouser/);
  assert.match(recipe,/current production baseline maps fabric now/i);

  const stageScope=await page.locator(".garmentViewerStageHead").innerText();
  assert.match(stageScope,/MODEL IDENTITY LOCKED · SHIRT \+ TROUSER/,"3D stage must state the exact-model lock");
  const referenceBlock=await page.locator(".garmentViewerReference").innerText();
  assert.match(referenceBlock,/EXACT REAL MODEL DESIGNER IDENTITY/);
  assert.match(referenceBlock,/linen-earth-studio-model-v1/);
  assert.match(referenceBlock,/same shoulder width, torso taper, arm length, hand scale, hip width, leg length, stance and shoes/i);

  const variantNames=await viewer.evaluate((element)=>(element.model?.materials||[]).map((material)=>material.name).filter((name)=>name.includes("Variant__")||name.includes("Length__")));
  assert.ok(variantNames.some((name)=>name==="ShirtCollarVariant__spread"),"M7 must carry spread-collar geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtHemVariant__regular"),"M7 must carry untucked shirt geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserLegLVariant__wide"),"M7 must carry wide-trouser geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserWaistbandVariant__side_adjuster"),"M7 must carry side-adjuster geometry");

  await page.getByLabel("3D shirt type").selectOption("camp_collar_resort");
  assert.equal(await page.getByLabel("3D shirt wear").inputValue(),"untucked","camp shirt preset must switch to untucked wear");
  assert.equal(await page.getByLabel("3D sleeve").inputValue(),"half","camp shirt preset must switch to half sleeve");
  assert.equal(await page.getByLabel("3D collar").inputValue(),"camp","camp shirt preset must switch the collar geometry");
  await page.getByLabel("3D trouser type").selectOption("wide_leg_relaxed_drape");
  assert.equal(await page.getByLabel("3D trouser fit").inputValue(),"wide","wide-leg trouser preset must switch leg geometry");
  assert.equal(await page.getByLabel("3D trouser rise").inputValue(),"high","wide-leg trouser preset must switch rise");
  assert.equal(await page.getByLabel("3D trouser pleat").inputValue(),"double","wide-leg trouser preset must switch pleats");
  await page.getByLabel("3D button material").selectOption("metal");

  await page.getByLabel("3D shirt fit").selectOption("boxy");
  await page.getByLabel("3D shirt wear").selectOption("untucked");
  await page.getByLabel("3D collar").selectOption("mandarin");
  await page.getByLabel("3D trouser fit").selectOption("wide");
  await page.getByLabel("3D trouser rise").selectOption("high");
  await page.getByLabel("3D trouser pleat").selectOption("double");
  await page.getByLabel("3D trouser waistband").selectOption("side_adjuster");
  await page.getByLabel("3D trouser break").selectOption("cropped");
  await page.waitForTimeout(150);
  const liveSummary=await page.locator(".garmentStyleLiveSummary").innerText();
  assert.match(liveSummary,/Boxy \/ Oversized Fit/);
  assert.match(liveSummary,/Mandarin \/ Band Collar/);
  assert.match(liveSummary,/Wide-Leg Drape/);
  assert.match(liveSummary,/Cropped \/ Above-ankle/);

  const garmentCards=page.locator(".garmentTypeGrid article");
  assert.equal(await garmentCards.count(),4,"garment type roadmap must show current and future families");
  const garmentText=await garmentCards.allTextContents();
  assert.ok(garmentText.some((value)=>/Shirt/.test(value)&&/LIVE/.test(value)&&/Dress Shirt/.test(value)),"shirt types must be visible");
  assert.ok(garmentText.some((value)=>/Trouser/.test(value)&&/LIVE/.test(value)&&/Pleated Trouser/.test(value)),"trouser types must be visible");
  assert.ok(garmentText.some((value)=>/Blazer/.test(value)&&/FUTURE/.test(value)&&/Single-Breasted 2-Button/.test(value)),"future blazer types must be visible");
  assert.ok(garmentText.some((value)=>/Suit/.test(value)&&/FUTURE/.test(value)&&/3-Piece Suit/.test(value)),"future suit types must be visible");

  const styleSelects = page.locator(".garmentStyleControlGrid select");
  assert.equal(await styleSelects.count(), 15, "M7 must expose fifteen live tailoring controls");
  const selects = page.locator(".garmentViewerControls > label > select");
  assert.equal(await selects.count(), 2, "fabric selectors remain separate from tailoring controls");
  for (let index = 0; index < 2; index++) {
    const select = selects.nth(index);
    const before = await select.inputValue();
    const next = await select.evaluate((node) => [...node.options].find((option) => option.value !== node.value)?.value || "");
    assert.ok(next, "Each garment selector needs an alternate Linen Earth fabric");
    await select.selectOption(next);
    assert.notEqual(await select.inputValue(), before);
  }

  await page.waitForTimeout(400);
  const productionLatencyEvidence = await page.evaluate(() => localStorage.getItem("linen-earth-garment-viewer-latency-v1"));
  assert.ok(productionLatencyEvidence, "production fabric changes must create model-bound interaction latency evidence");
  const parsedLatencyEvidence=JSON.parse(productionLatencyEvidence);
  assert.match(String(parsedLatencyEvidence.assetKey||""),/^LE-OFFICEWEAR-V1:/,"latency evidence must be bound to the production model identity");
  assert.ok(Array.isArray(parsedLatencyEvidence.samples)&&parsedLatencyEvidence.samples.length>=1,"latency evidence must contain at least one production interaction sample");
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
