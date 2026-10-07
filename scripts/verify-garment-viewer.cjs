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
      styleSpec:{
        shirt:{
          type:"camp_collar_resort",
          collar:"cutaway_collar",
          cuff:"cocktail_cuff",
          sleeve:"half_sleeve",
          fit:"boxy_oversized",
          wear:"untucked",
          hem:"straight_flat_hem",
          back:"box_pleat_back"
        },
        pant:{
          type:"wide_leg_relaxed_drape",
          pleat:"double_pleat_reverse"
        }
      },
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
  await page.waitForFunction(() => {
    const readiness=document.querySelector(".garmentViewerShell")?.getAttribute("data-model-readiness");
    return readiness==="contract_ready"||readiness==="contract_failed";
  }, null, { timeout: 30000 });
  const labReadiness = await page.locator(".garmentViewerShell").evaluate((element) => ({
    model: element.getAttribute("data-model-readiness"),
    manifest: element.getAttribute("data-manifest-ready"),
  }));
  assert.equal(labReadiness.model, "contract_ready", "3D lab must load the production M7.22 model contract");
  assert.equal(labReadiness.manifest, "true", "production M7.22 model must load its verified physical-panel manifest");

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
  const requiredPanels=["ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric","TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric"];
  for(const name of requiredPanels) assert.equal(modelState.materialNames.filter((item)=>item===name).length,1,"required garment material must remain unique: "+name);
  assert.ok(modelState.materialNames.filter((name)=>name.startsWith("Shirt")&&name.includes("Variant__")).length>=12,"M7.22 must expose multiple shirt construction-variant materials");
  assert.ok(modelState.materialNames.filter((name)=>name.startsWith("Trouser")&&name.includes("Variant__")).length>=10,"M7.22 must expose multiple trouser construction-variant materials");
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
  assert.match(recipe,/Cutaway Collar/);
  assert.match(recipe,/Cocktail Cuff/);
  assert.match(recipe,/Wide-leg \/ Relaxed Drape Trouser/);
  assert.match(recipe,/saved Designer recipe now drives the same 3D tailoring-variant system/i);
  assert.equal(await page.getByLabel("3D shirt type").inputValue(),"camp_collar_resort","saved Designer shirt type must reach 3D");
  assert.equal(await page.getByLabel("3D collar",{exact:true}).inputValue(),"cutaway","canonical StyleSpec collar must override the shirt-type preset");
  assert.equal(await page.getByLabel("3D cuff",{exact:true}).inputValue(),"cocktail","canonical StyleSpec cuff must override the shirt-type preset");
  assert.equal(await page.getByLabel("3D shirt wear").inputValue(),"untucked","canonical Designer wear must reach 3D");
  assert.equal(await page.getByLabel("3D shirt back").inputValue(),"center_box_pleat","canonical Designer shirt-back construction must reach 3D");
  assert.equal(await page.getByLabel("3D trouser type").inputValue(),"wide_leg_relaxed_drape","saved Designer trouser type must reach 3D");
  assert.equal(await page.getByLabel("3D trouser pleat").inputValue(),"double_reverse","canonical trouser pleat must reach 3D");

  const stageScope=await page.locator(".garmentViewerStageHead").innerText();
  assert.match(stageScope,/MODEL IDENTITY LOCKED · SHIRT \+ TROUSER/,"3D stage must state the exact-model lock");
  const referenceBlock=await page.locator(".garmentViewerReference").innerText();
  assert.match(referenceBlock,/EXACT REAL MODEL DESIGNER IDENTITY/);
  assert.match(referenceBlock,/linen-earth-studio-model-v1/);
  assert.match(referenceBlock,/same shoulder width, torso taper, arm length, hand scale, hip width, leg length, stance and shoes/i);

  const variantNames=await viewer.evaluate((element)=>(element.model?.materials||[]).map((material)=>material.name).filter((name)=>name.includes("Variant__")||name.includes("Length__")));
  assert.ok(variantNames.some((name)=>name==="ShirtCollarVariant__spread__stiff_fused"),"M7.22 must carry spread-collar fused geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtCollarVariant__spread__soft_unfused"),"M7.22 must carry spread-collar soft geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtNeckGasketVariant__spread"),"M7.22 must seal the spread-collar neck junction with shirt fabric");
  assert.ok(variantNames.some((name)=>name==="ShirtNeckGasketVariant__point"),"M7.22 must seal the point-collar neck junction with shirt fabric");
  assert.ok(variantNames.some((name)=>name==="ShirtCuffVariant__cocktail__fused"),"M7.22 must carry cocktail-cuff construction geometry");
  assert.ok(modelState.materialNames.some((name)=>name==="ButtonAccentVariant__shirt_placket__standard"),"M7.22 must carry construction-aware shirt front hardware");
  assert.ok(modelState.materialNames.some((name)=>name==="ButtonAccentVariant__shirt_collar__button_down"),"M7.22 must carry button-down collar hardware");
  assert.equal(modelState.materialNames.some((name)=>name==="ButtonAccentVariant__shirt_placket__hidden"),false,"hidden placket must not expose front buttons");
  assert.ok(variantNames.some((name)=>name==="ShirtHemVariant__regular"),"M7 must carry untucked shirt geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtSleeveLLength__boxy__half"),"M7.22 must carry fit-aware boxy half-sleeve geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtSleeveRLength__slim__roll"),"M7.22 must carry fit-aware slim rolled-sleeve geometry");
  assert.ok(modelState.materialNames.some((name)=>name==="MannequinSkinArmVariant__half"),"M7.22 must expose forearm skin for half sleeves");
  assert.ok(modelState.materialNames.some((name)=>name==="MannequinSkinArmVariant__roll"),"M7.22 must expose forearm skin for rolled sleeves");
  assert.ok(modelState.materialNames.some((name)=>name==="MannequinSkinArmVariant__three_quarter"),"M7.22 must expose forearm skin for three-quarter sleeves");
  assert.ok(variantNames.some((name)=>name==="ShirtSleeveFinishVariant__boxy__half"),"M7.22 must carry a tailored half-sleeve hem finish");
  assert.ok(variantNames.some((name)=>name==="ShirtSleeveFinishVariant__slim__three_quarter"),"M7.22 must carry a tailored three-quarter sleeve hem finish");
  assert.ok(variantNames.some((name)=>name==="TrouserLegLVariant__wide"),"M7 must carry wide-trouser geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserLegLBreakVariant__wide__negative"),"M7.22 must carry cropped wide-leg break geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserLegRBreakVariant__straight__full"),"M7.22 must carry full-break straight-leg geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserHemVariant__wide__negative__turnup_4"),"M7.22 must carry cropped wide-leg 4 cm turn-up geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserHemVariant__straight__full__turnup_5"),"M7.22 must carry full-break straight-leg 5 cm turn-up geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserWaistbandVariant__high__side_adjuster"),"M7.22 must carry high-rise side-adjuster geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserWaistbandVariant__low__belt_loops"),"M7.22 must carry low-rise belt-loop geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserPleatVariant__high__double_reverse"),"M7.22 must carry high-rise double reverse pleat details");
  assert.ok(variantNames.some((name)=>name==="TrouserPleatVariant__low__single_forward"),"M7.22 must carry low-rise single forward pleat details");
  assert.ok(variantNames.some((name)=>name==="TrouserPocketVariant__high__jean"),"M7.22 must carry high-rise jean-pocket geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserPocketVariant__low__slant"),"M7.22 must carry low-rise slant-pocket geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserCreaseVariant__front"),"M7.22 must keep tailored front creases visible across trouser fits");
  assert.ok(variantNames.some((name)=>name==="TrouserCoreDetailVariant__low"),"M7.22 must carry low-rise fly and waistband core detail");
  assert.ok(variantNames.some((name)=>name==="TrouserCoreDetailVariant__high"),"M7.22 must carry high-rise fly and waistband core detail");
  assert.ok(modelState.materialNames.some((name)=>name==="ButtonAccentVariant__trouser_rise__high"),"M7.22 must carry high-rise trouser closure hardware");

  await page.getByLabel("3D shirt type").selectOption("camp_collar_resort");
  assert.equal(await page.getByLabel("3D shirt wear").inputValue(),"untucked","camp shirt preset must switch to untucked wear");
  assert.equal(await page.getByLabel("3D sleeve").inputValue(),"half","camp shirt preset must switch to half sleeve");
  assert.equal(await page.getByLabel("3D collar",{exact:true}).inputValue(),"camp","camp shirt preset must switch the collar geometry");
  await page.getByLabel("3D trouser type").selectOption("wide_leg_relaxed_drape");
  assert.equal(await page.getByLabel("3D trouser fit").inputValue(),"wide","wide-leg trouser preset must switch leg geometry");
  assert.equal(await page.getByLabel("3D trouser rise").inputValue(),"high","wide-leg trouser preset must switch rise");
  assert.equal(await page.getByLabel("3D trouser pleat").inputValue(),"double_reverse","wide-leg trouser preset must switch to double reverse pleats");
  await page.getByLabel("3D button material").selectOption("metal");

  await page.getByLabel("3D shirt fit").selectOption("boxy");
  await page.getByLabel("3D shirt wear").selectOption("untucked");
  await page.getByLabel("3D collar",{exact:true}).selectOption("mandarin");
  await page.getByLabel("3D trouser fit").selectOption("wide");
  await page.getByLabel("3D trouser rise").selectOption("high");
  await page.getByLabel("3D trouser pleat").selectOption("double_forward");
  await page.getByLabel("3D trouser waistband").selectOption("side_adjuster");
  await page.getByLabel("3D trouser break").selectOption("negative");
  await page.getByLabel("3D collar construction").selectOption("soft_unfused");
  await page.getByLabel("3D cuff construction").selectOption("soft");
  await page.getByLabel("3D shirt yoke").selectOption("western");
  assert.equal(await page.getByLabel("3D shirt back").inputValue(),"plain","western yoke must clear incompatible rear pleats");
  await page.getByLabel("3D shirt back").selectOption("rear_side_pleats");
  assert.equal(await page.getByLabel("3D shirt yoke").inputValue(),"split","rear pleats must switch an incompatible western yoke to split");
  await page.getByLabel("3D shirt hem").selectOption("straight");
  await page.getByLabel("3D trouser hem").selectOption("turnup_4");
  await page.getByLabel("3D trouser pockets").selectOption("jean");
  await page.waitForTimeout(150);
  const liveSummary=await page.locator(".garmentStyleLiveSummary").innerText();
  assert.match(liveSummary,/Boxy \/ Oversized Fit/);
  assert.match(liveSummary,/Mandarin \/ Band Collar/);
  assert.match(liveSummary,/Wide-Leg Drape/);
  assert.match(liveSummary,/Double Forward Pleats/);

  const garmentCards=page.locator(".garmentTypeGrid article");
  assert.equal(await garmentCards.count(),4,"garment type roadmap must show current and future families");
  const garmentText=await garmentCards.allTextContents();
  assert.ok(garmentText.some((value)=>/Shirt/.test(value)&&/LIVE/.test(value)&&/Dress Shirt/.test(value)),"shirt types must be visible");
  assert.ok(garmentText.some((value)=>/Trouser/.test(value)&&/LIVE/.test(value)&&/Pleated Trouser/.test(value)),"trouser types must be visible");
  assert.ok(garmentText.some((value)=>/Blazer/.test(value)&&/FUTURE/.test(value)&&/Single-Breasted 2-Button/.test(value)),"future blazer types must be visible");
  assert.ok(garmentText.some((value)=>/Suit/.test(value)&&/FUTURE/.test(value)&&/3-Piece Suit/.test(value)),"future suit types must be visible");

  const styleSelects = page.locator(".garmentStyleControlGrid select");
  assert.equal(await styleSelects.count(), 22, "M7.22 must expose twenty-two live tailoring controls");
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
  assert.ok(materialState.length > 20,"M7 must texture the six required panels plus live style-variant materials");
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
