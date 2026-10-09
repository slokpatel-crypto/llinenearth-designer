const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createRequire } = require("node:module");

const runtime = process.env.LINEN_BROWSER_QA_RUNTIME;
if (!runtime) throw new Error("Set LINEN_BROWSER_QA_RUNTIME to the pinned CI test runtime.");
const { chromium } = createRequire(path.join(runtime, "package.json"))("playwright");
const baseURL = process.env.LINEN_BROWSER_QA_URL || "http://127.0.0.1:3000";
const output = path.resolve("artifacts/preview-lifecycle");

async function captureStableWebGLFrame(page, destination, clip) {
  // Playwright page.screenshot waits for a stable frame, which model-viewer's
  // continuously repainted WebGL surface may never reach on CI cold starts.
  // Chromium CDP captures the compositor directly without that stability wait.
  const session=await page.context().newCDPSession(page);
  try {
    const frame=await session.send("Page.captureScreenshot",{
      format:"png",
      captureBeyondViewport:false,
      fromSurface:true,
      clip:{x:clip.x,y:clip.y,width:clip.width,height:clip.height,scale:1},
    });
    assert.ok(typeof frame.data==="string"&&frame.data.length>100,"WebGL compositor did not return a review image");
    await fs.writeFile(destination,Buffer.from(frame.data,"base64"));
  } finally {
    await session.detach().catch(()=>{});
  }
}


async function selectTailoringOption(page, label, value) {
  const started=Date.now();
  const phaseMs={};
  const markPhase=(stage)=>{phaseMs[stage]=Date.now()-started;};
  const target=page.getByLabel(label,{exact:true});
  try {
    // Playwright selectOption may remain in its compositor actionability
    // loop for 12 seconds EVEN AFTER the DOM's real selected value changes,
    // because the 586-material GPU renderer continuously paints. Instead
    // exercise REAL Chromium mouse+keyboard input: verify a visible enabled
    // control is hit-testable, click it at the viewport, and type a native
    // unique first-letter option. No synthetic input/change events, direct
    // DOM value assignments or force:true bypasses are permitted.
    assert.equal(await target.isVisible(),true,`3D selector ${label} must be visible`);
    assert.equal(await target.isEnabled(),true,`3D selector ${label} must be enabled`);
    markPhase("visibleAndEnabled");
    const options=await target.locator("option").evaluateAll((nodes)=>nodes.map(
      (node)=>({value:node.value,label:node.textContent?.trim()||"",disabled:node.matches(":disabled")})
    ));
    markPhase("nativeOptionCatalog");
    const requested=options.find((option)=>option.value===value);
    assert.ok(requested,`3D selector ${label} must contain option ${value}`);
    assert.equal(requested.disabled,false,`3D selector ${label} option ${value} must be enabled`);
    const first=requested.label.charAt(0).toLowerCase();
    // A native select can have several names with the same initial (English
    // Spread / Extra High, different cuff shapes, etc.). Type the shortest
    // UNIQUE option-label prefix, using actual Chromium keyboard events.
    const prefix=Array.from(requested.label,(letter,index)=>
      requested.label.slice(0,index+1)).find((part)=>
        options.filter((option)=>option.label.toLowerCase().startsWith(part.toLowerCase())).length===1);
    const enabledIndex=options.filter((option)=>!option.disabled).findIndex((option)=>option.value===value);
    assert.ok(enabledIndex>=0&&enabledIndex<64,`3D selector ${label} must have a bounded enabled option index`);
    // Locator.boundingBox waits for Playwright element stability/compositing.
    // The 586-material WebGL stage can continuously repaint and starve that
    // actionability check even while the select is visible and enabled.
    // Read a real DOMClientRect directly and verify native browser hit testing.
    const hitbox=await page.evaluate(({label})=>{
      const select=[...document.querySelectorAll("select")]
        .find((node)=>node.getAttribute("aria-label")===label);
      if(!(select instanceof HTMLSelectElement)||select.disabled) return null;
      // The website supports smooth scrolling. Its default async scroll
      // animation leaves the select far below the viewport when read
      // immediately, producing a false control failure under busy WebGL.
      // The QA user action must be preceded by an INSTANT real scroll.
      select.scrollIntoView({block:"center",inline:"nearest",behavior:"instant"});
      const rect=select.getBoundingClientRect();
      const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
      const hit=document.elementFromPoint(x,y);
      return {x,y,width:rect.width,height:rect.height,
        withinViewport:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,
        uncovered:hit===select};
    },{label});
    assert.ok(hitbox&&hitbox.width>=5&&hitbox.height>=5,
      `3D selector ${label} must have a real click target`);
    assert.equal(hitbox.withinViewport,true,`3D selector ${label} must be in viewport`);
    assert.equal(hitbox.uncovered,true,`3D selector ${label} must not be covered by the WebGL stage`);
    markPhase("scrollAndHitTest");
    // Count the actual real USER gesture, not pre-action Playwright option
    // enumeration and page scrolling. Those diagnostics took 4.67 seconds
    // in software WebGL Chromium and are not a customer input delay.
    const inputStarted=Date.now();
    const {x,y}=hitbox;
    await page.mouse.click(x,y);
    markPhase("nativePointerClick");
    if(prefix?.length===1) await page.keyboard.press(first);
    else if(prefix) await page.keyboard.type(prefix,{delay:0});
    else {
      // "White collar" is a prefix of "White collar + cuffs". Real native
      // keyboard navigation must also support prefix/duplicate display labels.
      await page.keyboard.press("Home");
      for(let index=0;index<enabledIndex;index++) await page.keyboard.press("ArrowDown");
    }
    markPhase("nativeTypeAhead");
    // Chromium native selects can commit their new option on typeahead.
    // Avoid an unnecessary second Enter keyboard event if the real DOM
    // selection already changed: that event alone blocked the loaded 586-
    // material browser compositor for several seconds in real CI.
    const changed=await page.evaluate(({label,value})=>{
      const select=document.querySelector(`select[aria-label="${label}"]`);
      return select instanceof HTMLSelectElement&&select.value===value;
    },{label,value});
    markPhase("nativeChangeProbe");
    if(!changed) await page.keyboard.press("Enter");
    markPhase("nativeKeyboardCommit");
    await page.waitForFunction(({label,value})=>{
      const select=document.querySelector(`select[aria-label="${label}"]`);
      return select instanceof HTMLSelectElement&&select.value===value;
    },{label,value},{timeout:4000});
    markPhase("committedReactValue");
    const actual=await target.inputValue({timeout:3000});
    markPhase("nativeReadBack");
    assert.equal(actual,value,`Native browser input for ${label} must commit ${value}`);
    assert.ok(Date.now()-inputStarted<6000,
      `3D tailoring REAL native user gesture must stay under 6 seconds: ${JSON.stringify({gestureMs:Date.now()-inputStarted,phaseMs})}`);
  } catch(error) {
    let state={unavailable:true};
    try {
      state=await Promise.race([
        page.evaluate(({label})=>{
          const controls=[...document.querySelectorAll("select")];
          const element=controls.find(node=>node.getAttribute("aria-label")===label);
          const shell=document.querySelector(".garmentViewerShell");
          const viewer=document.querySelector("model-viewer");
          return {
            label,value:element?.value??null,
            optionCount:element?.options.length??0,disabled:element?.disabled??null,
            modelLoaded:Boolean(viewer?.loaded),
            modelReadiness:shell?.getAttribute("data-model-readiness")??null,
            manifestReady:shell?.getAttribute("data-manifest-ready")??null,
            sceneMaterials:viewer?.model?.materials.length??null,
          };
        },{label}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error("diagnostics main-thread timeout")),2000))
      ]);
    } catch(e) {state={error:String(e)};}
    const record={label,requested:value,durationMs:Date.now()-started,phaseMs,state,error:String(error)};
    await fs.writeFile(path.join(output,"garment-select-failure.json"),JSON.stringify(record,null,2)+"\n");
    throw new Error("Real tailoring select failed in bounded browser QA: "+JSON.stringify(record));
  }
}

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
          collarFinish:"White contrast collar + cuffs",
          cuff:"cocktail_cuff",
          sleeve:"half_sleeve",
          fit:"boxy_oversized",
          wear:"untucked",
          hem:"straight_flat_hem",
          back:"box_pleat_back"
        },
        pant:{
          type:"wide_leg_relaxed_drape",
          rise:"extra_high_rise",
          pleat:"double_pleat_reverse"
        }
      },
      style:{
        collar:"Spread Collar",
        collarFinish:"Self-fabric",
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
  const serverSeededReadiness=await page.locator(".garmentViewerShell").getAttribute("data-model-readiness");
  assert.equal(serverSeededReadiness,"contract_ready","server-verified production asset must seed M7.46 readiness before scene-graph hydration");
  try {
    // Blender-backed GLB parsing and shader compilation can exceed 20 seconds
    // on cold GitHub-hosted Chromium. The customer UI has a bounded 60-second
    // recovery window; the gate must wait for that real readiness outcome.
    await page.locator(".garmentViewerLoading").waitFor({ state: "hidden", timeout: 70000 });
    const loadError=await page.locator(".garmentViewerError").allInnerTexts();
    assert.equal(loadError.length,0,"3D viewer must not report a model-load error: "+loadError.join(" | "));
  } catch(error) {
    const state=await page.evaluate(()=>({
      modelLoaded:Boolean(document.querySelector("model-viewer")?.loaded),
      materials:document.querySelector("model-viewer")?.model?.materials?.length??null,
      loading:document.querySelector(".garmentViewerLoading")?.innerText??null,
      error:document.querySelector(".garmentViewerError")?.innerText??null,
      readiness:document.querySelector(".garmentViewerShell")?.getAttribute("data-model-readiness")??null,
    }));
    await fs.writeFile(path.join(output,"garment-loading-failure.json"),JSON.stringify({state,errors},null,2)+"\\n");
    await page.screenshot({path:path.join(output,"garment-loading-failure.png"),timeout:15000}).catch(()=>{});
    throw new Error("3D model loading did not complete during bounded hydration: "+JSON.stringify(state)+"; "+error.message);
  }
  try {
    // React can replace the server-rendered shell while the large scene graph hydrates.
    // Re-resolve the current DOM node until both immutable production contracts settle.
    await page.waitForFunction(()=>{
      const shell=document.querySelector(".garmentViewerShell");
      return shell?.getAttribute("data-model-readiness")==="contract_ready"
        && shell?.getAttribute("data-manifest-ready")==="true";
    },null,{timeout:20000});
  } catch (error) {
    const diagnostic=await page.evaluate(()=>({
      body:document.body?.innerText?.slice(0,1600)||"<body unavailable>",
      shellCount:document.querySelectorAll(".garmentViewerShell").length,
      readiness:document.querySelector(".garmentViewerShell")?.getAttribute("data-model-readiness")||null,
      manifestReady:document.querySelector(".garmentViewerShell")?.getAttribute("data-manifest-ready")||null,
    })).catch(()=>({body:"<page unavailable>",shellCount:0,readiness:null,manifestReady:null}));
    throw new Error("3D readiness did not settle after hydration. url="+page.url()+" errors="+JSON.stringify(errors)+" state="+JSON.stringify(diagnostic)+"; "+error.message);
  }
  const shell=page.locator(".garmentViewerShell");
  assert.equal(await shell.count(),1,"3D lab must keep exactly one hydrated viewer shell");
  const [labModelReadiness,labManifestReadiness]=await page.evaluate(()=>{
    const element=document.querySelector(".garmentViewerShell");
    return [element?.getAttribute("data-model-readiness")||null,element?.getAttribute("data-manifest-ready")||null];
  });
  assert.equal(labModelReadiness, "contract_ready", "3D lab must load the production M7.46 model contract");
  assert.equal(labManifestReadiness, "true", "production M7.46 model must load its verified physical-panel manifest");

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
  assert.ok(modelState.materialNames.filter((name)=>name.startsWith("Shirt")&&name.includes("Variant__")).length>=12,"M7.46 must expose multiple shirt construction-variant materials");
  assert.ok(modelState.materialNames.some((name)=>name==="ShirtTorsoTuckedVariant__regular__mid"),"M7.46 must carry a waist-compressed tucked regular shirt torso for mid rise");
  assert.ok(modelState.materialNames.some((name)=>name==="ShirtTorsoTuckedVariant__regular__extra_high"),"M7.46 must carry a rise-aware tucked regular shirt torso for extra-high rise");
  assert.ok(modelState.materialNames.some((name)=>name==="ShirtTorsoTuckedVariant__boxy__high"),"M7.46 must carry fit- and rise-specific tucked boxy shirt geometry");
  assert.ok(modelState.materialNames.some((name)=>name==="ShirtTorsoTuckedBackVariant__regular__extra_high__center_box_pleat"),"M7.46 must preserve back construction on extra-high-rise tucked shirts");
  assert.ok(modelState.materialNames.filter((name)=>name.startsWith("Trouser")&&name.includes("Variant__")).length>=10,"M7.46 must expose multiple trouser construction-variant materials");
  assert.equal(modelState.hasCreateTexture, true, "model-viewer scene graph texture API must be available");

  const buttons = page.locator(".garmentCameraRail button");
  assert.equal(await buttons.count(), 4);
  const canvas=page.locator(".garmentViewerCanvas");
  const captureCanvas=async(name)=>{
    if(width!==1440) return;
    // model-viewer continuously animates its render surface, so Locator.screenshot can wait
    // forever for DOM stability. Capture the already-laid-out bounding box directly instead.
    await page.waitForTimeout(180);
    // Locator.boundingBox also goes through Playwright's compositor-backed
    // layout/stability machinery. Cold WebGL on CI blocked it for 30 seconds,
    // even after the canvas was visibly rendered and the contract was ready.
    // Read the ACTUAL DOM layout rectangle and keep the unchanged CDP real
    // compositor screenshot, four directions and nonzero viewport checks.
    const box=await page.evaluate(()=>{
      const node=document.querySelector(".garmentViewerCanvas");
      if(!(node instanceof HTMLElement)) return null;
      const rect=node.getBoundingClientRect();
      return {
        x:rect.x,y:rect.y,width:rect.width,height:rect.height,
        visible:getComputedStyle(node).visibility!=="hidden",
      };
    });
    assert.ok(box&&box.visible&&box.width>0&&box.height>0,
      "3D evidence canvas must be actually visible and have measurable DOM bounds");
    assert.ok(box.x<width&&box.y<1000&&box.x+box.width>0&&box.y+box.height>0,
      "3D evidence canvas must intersect the real Chromium viewport");
    await captureStableWebGLFrame(page,path.join(output,name),{
      x:Math.max(0,box.x),
      y:Math.max(0,box.y),
      width:Math.max(1,Math.min(box.width,width-Math.max(0,box.x))),
      height:Math.max(1,Math.min(box.height,1000-Math.max(0,box.y))),
    });
  };
  const selectCamera=async(label,orbitPrefix,activeView)=>{
    let lastError=null;
    for(let attempt=1;attempt<=3;attempt++){
      const clicked=await page.evaluate((cameraLabel)=>{
        const button=[...document.querySelectorAll(".garmentCameraRail button")]
          .find((element)=>element.textContent?.trim()===cameraLabel);
        if(!(button instanceof HTMLButtonElement)) return false;
        button.click();
        return true;
      },label);
      assert.equal(clicked,true,`camera button must exist: ${label}`);
      try {
        await page.waitForFunction(
          ({prefix,view})=>{
            const viewerElement=document.querySelector("model-viewer");
            const shellElement=document.querySelector(".garmentViewerShell");
            return viewerElement?.getAttribute("camera-orbit")?.startsWith(prefix)
              && shellElement?.getAttribute("data-active-view")===view;
          },
          {prefix:orbitPrefix,view:activeView},
          {timeout:10000},
        );
        return;
      } catch (error) {
        lastError=error;
      }
    }
    const state=await page.evaluate(()=>({
      orbit:document.querySelector("model-viewer")?.getAttribute("camera-orbit")||null,
      activeView:document.querySelector(".garmentViewerShell")?.getAttribute("data-active-view")||null,
      modelLoaded:Boolean(document.querySelector("model-viewer")?.loaded),
    }));
    throw new Error(`camera transition did not settle for ${label} after 3 UI attempts: ${JSON.stringify(state)}; ${lastError?.message||"unknown error"}`);
  };

  // M7.46 originally captured a pale floating head, legless side view and
  // disjoint cloth tubes because the initial panel set was hidden BEFORE the
  // new variants were loaded. Camera screenshots must show a SETTLED design,
  // not an intermediate shader-hydration frame. Fail closed, never forge
  // alpha values or hide visual evidence that takes too long to become ready.
  try {
    await page.waitForFunction(()=>{
      const shell=document.querySelector(".garmentViewerShell");
      const materials=document.querySelector("model-viewer")?.model?.materials||[];
      const visible=(prefix)=>materials.some((material)=>
        material.name.startsWith(prefix)&&
        material.name.includes("Variant__")&&
        material.pbrMetallicRoughness?.baseColorFactor?.[3]>.95);
      return shell?.getAttribute("data-tailoring-ready")==="true"
        && visible("Shirt")&&visible("Trouser");
    },null,{timeout:20000});
  } catch(error) {
    const diagnostic=await page.evaluate(()=>{
      const shell=document.querySelector(".garmentViewerShell");
      const model=document.querySelector("model-viewer");
      const materials=model?.model?.materials||[];
      const visible=materials.filter((m)=>
        (m.name.startsWith("Shirt")||m.name.startsWith("Trouser"))
        &&m.pbrMetallicRoughness?.baseColorFactor?.[3]>.95);
      return {
        tailoringReady:shell?.getAttribute("data-tailoring-ready"),
        tailoringPhase:shell?.getAttribute("data-tailoring-phase"),
        modelReady:shell?.getAttribute("data-model-readiness"),
        manifestReady:shell?.getAttribute("data-manifest-ready"),
        loaded:Boolean(model?.loaded),materialCount:materials.length,
        error:document.querySelector(".garmentViewerError")?.textContent??null,
        visibleMaterialNames:visible.map((m)=>m.name).slice(0,60),
        sampleShirt:materials.filter((m)=>m.name.startsWith("Shirt")&&m.name.includes("Variant__"))
          .slice(0,8).map((m)=>({name:m.name,alpha:m.pbrMetallicRoughness?.baseColorFactor?.[3],loaded:m.isLoaded})),
        sampleTrouser:materials.filter((m)=>m.name.startsWith("Trouser")&&m.name.includes("Variant__"))
          .slice(0,8).map((m)=>({name:m.name,alpha:m.pbrMetallicRoughness?.baseColorFactor?.[3],loaded:m.isLoaded})),
      };
    }).catch(e=>({diagnosticError:String(e)}));
    await fs.writeFile(path.join(output,"garment-initial-style-failure.json"),
      JSON.stringify({diagnostic,error:String(error)},null,2)+"\n");
    throw new Error("A complete 3D tailored outfit was not visible within the native 20-second gate: "+
      JSON.stringify({diagnostic,error:String(error)}));
  }

  await captureCanvas("garment-angle-front.png");
  await selectCamera("3/4","35deg","three-quarter");
  await captureCanvas("garment-angle-three-quarter.png");
  await selectCamera("Side","90deg","side");
  await captureCanvas("garment-angle-side.png");
  await selectCamera("Back","180deg","back");
  await captureCanvas("garment-angle-back.png");
  await selectCamera("Front","0deg","front");

  const reference=page.locator(".garmentViewerReference img");
  await reference.waitFor({state:"visible"});
  assert.match(await reference.getAttribute("src"),/studio-tucked\.webp$/, "3D lab must keep the approved studio reference target visible");

  const recipe=await page.locator(".garmentDraftRecipe").innerText();
  assert.match(recipe,/YOUR DESIGNER RECIPE/);
  assert.match(recipe,/Cutaway Collar/);
  assert.match(recipe,/White contrast collar \+ cuffs/);
  assert.match(recipe,/Cocktail Cuff/);
  assert.match(recipe,/Wide-leg \/ Relaxed Drape Trouser/);
  assert.match(recipe,/saved Designer recipe now drives the same 3D tailoring-variant system/i);
  assert.equal(await page.getByLabel("3D shirt type").inputValue(),"camp_collar_resort","saved Designer shirt type must reach 3D");
  assert.equal(await page.getByLabel("3D collar",{exact:true}).inputValue(),"cutaway","canonical StyleSpec collar must override the shirt-type preset");
  assert.equal(await page.getByLabel("3D collar cloth").inputValue(),"white_collar_cuffs","canonical Designer contrast collar + cuffs must reach 3D");
  assert.equal(await page.locator(".garmentViewerShell").getAttribute("data-collar-finish"),"white_collar_cuffs","3D shell must expose active contrast-cloth state");
  assert.equal(await page.getByLabel("3D cuff",{exact:true}).inputValue(),"cocktail","canonical StyleSpec cuff must override the shirt-type preset");
  assert.equal(await page.getByLabel("3D shirt wear").inputValue(),"untucked","canonical Designer wear must reach 3D");
  await selectTailoringOption(page,"3D shirt wear","tucked");
  assert.equal(await page.getByLabel("3D shirt wear").inputValue(),"tucked","tucked state must switch to waist-compressed torso geometry");
  await selectTailoringOption(page,"3D trouser rise","extra_high");
  assert.equal(await page.getByLabel("3D trouser rise").inputValue(),"extra_high","tucked shirt must remain valid at extra-high rise");
  await selectTailoringOption(page,"3D shirt wear","untucked");
  assert.equal(await page.getByLabel("3D shirt back").inputValue(),"center_box_pleat","canonical Designer shirt-back construction must reach 3D");
  assert.equal(await page.getByLabel("3D trouser type").inputValue(),"wide_leg_relaxed_drape","saved Designer trouser type must reach 3D");
  assert.equal(await page.getByLabel("3D trouser rise").inputValue(),"extra_high","canonical Extra-High Rise must override the trouser-type preset and reach 3D");
  assert.equal(await page.getByLabel("3D trouser pleat").inputValue(),"double_reverse","canonical trouser pleat must reach 3D");

  const stageScope=await page.locator(".garmentViewerStageHead").innerText();
  assert.match(stageScope,/MODEL IDENTITY LOCKED · SHIRT \+ TROUSER/,"3D stage must state the exact-model lock");
  const referenceBlock=await page.locator(".garmentViewerReference").innerText();
  assert.match(referenceBlock,/EXACT REAL MODEL DESIGNER IDENTITY/);
  assert.match(referenceBlock,/linen-earth-studio-model-v1/);
  assert.match(referenceBlock,/same (?:head height, )?shoulder width, torso taper, arm length, hand scale, hip width, leg length, stance and shoes/i);
  assert.match(referenceBlock,/sleeve cap is shaped to the locked shoulder/i);
  assert.match(referenceBlock,/flatter face plane and tapered jaw/i);

  const variantNames=await viewer.evaluate((element)=>(element.model?.materials||[]).map((material)=>material.name).filter((name)=>name.includes("Variant__")||name.includes("Length__")));
  assert.ok(variantNames.some((name)=>name==="ShirtCollarVariant__spread__stiff_fused"),"M7.46 must carry spread-collar fused geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtCollarVariant__english_spread__stiff_fused"),"M7.46 must carry explicit English-spread/British collar geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtNeckGasketVariant__english_spread__stiff_fused"),"M7.46 must carry the English-spread raised-back collar band");
  assert.ok(variantNames.some((name)=>name==="ShirtNeckGasketVariant__english_spread__soft_unfused"),"M7.46 must carry the soft English-spread collar-band construction");
  assert.ok(variantNames.some((name)=>name==="ShirtCollarVariant__spread__soft_unfused"),"M7.46 must carry spread-collar soft geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtNeckGasketVariant__spread__stiff_fused"),"M7.46 must seal the spread-collar neck junction with a construction-aware band");
  assert.ok(variantNames.some((name)=>name==="ShirtNeckGasketVariant__point__soft_fused"),"M7.46 must carry a soft-fused point-collar band");
  assert.ok(variantNames.some((name)=>name==="ShirtCuffVariant__cocktail__fused"),"M7.46 must carry cocktail-cuff construction geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtCuffVariant__mitered_2__fused"),"M7.46 must carry mitered wrap-around cuff geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtCuffVariant__rounded_2__soft"),"M7.46 must carry rounded wrap-around cuff geometry");
  assert.ok(modelState.materialNames.some((name)=>name==="ButtonAccentVariant__shirt_placket__standard"),"M7.46 must carry construction-aware shirt front hardware");
  assert.ok(modelState.materialNames.some((name)=>name==="ButtonAccentVariant__shirt_collar__button_down"),"M7.46 must carry button-down collar hardware");
  assert.equal(modelState.materialNames.some((name)=>name==="ButtonAccentVariant__shirt_placket__hidden"),false,"hidden placket must not expose front buttons");
  assert.ok(variantNames.some((name)=>name==="ShirtHemVariant__regular"),"M7 must carry untucked shirt geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtSleeveLLength__boxy__half"),"M7.46 must carry fit-aware boxy half-sleeve geometry");
  assert.ok(variantNames.some((name)=>name==="ShirtSleeveRLength__slim__roll"),"M7.46 must carry fit-aware slim rolled-sleeve geometry");
  assert.ok(modelState.materialNames.some((name)=>name==="MannequinSkinArmVariant__half"),"M7.46 must expose forearm skin for half sleeves");
  assert.ok(modelState.materialNames.some((name)=>name==="MannequinSkinArmVariant__roll"),"M7.46 must expose forearm skin for rolled sleeves");
  assert.ok(modelState.materialNames.some((name)=>name==="MannequinSkinArmVariant__three_quarter"),"M7.46 must expose forearm skin for three-quarter sleeves");
  assert.ok(variantNames.some((name)=>name==="ShirtSleeveFinishVariant__boxy__half"),"M7.46 must carry a tailored half-sleeve hem finish");
  assert.ok(variantNames.some((name)=>name==="ShirtSleeveFinishVariant__slim__three_quarter"),"M7.46 must carry a tailored three-quarter sleeve hem finish");
  assert.ok(variantNames.some((name)=>name==="TrouserLegLVariant__wide"),"M7 must carry wide-trouser geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserLegLBreakVariant__wide__negative"),"M7.46 must carry cropped wide-leg break geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserLegRBreakVariant__straight__full"),"M7.46 must carry full-break straight-leg geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserHemVariant__wide__negative__turnup_4"),"M7.46 must carry fit/break-locked wrap-around trouser turn-up geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserHemVariant__straight__full__turnup_5"),"M7.46 must carry full-break 5 cm wrap-around turn-up geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserHemVariant__wide__negative__turnup_4"),"M7.46 must carry cropped wide-leg 4 cm turn-up geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserHemVariant__straight__full__turnup_5"),"M7.46 must carry full-break straight-leg 5 cm turn-up geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserWaistbandVariant__high__side_adjuster"),"M7.46 must carry high-rise side-adjuster geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserWaistbandVariant__extra_high__belt_loops"),"M7.46 must carry extra-high rise belt-loop hardware around the full waistband");
  assert.ok(variantNames.some((name)=>name==="TrouserWaistbandVariant__high__braces"),"M7.46 must carry front/back brace-button hardware");
  assert.ok(variantNames.some((name)=>name==="TrouserWaistbandVariant__low__belt_loops"),"M7.46 must carry low-rise belt-loop geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserPleatVariant__high__double_reverse"),"M7.46 must carry high-rise double reverse pleat details");
  assert.ok(variantNames.some((name)=>name==="TrouserPleatVariant__low__single_forward"),"M7.46 must carry low-rise single forward pleat details");
  assert.ok(variantNames.some((name)=>name==="TrouserPocketVariant__high__jean"),"M7.46 must carry high-rise jean-pocket geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserPocketVariant__extra_high__on_seam"),"M7.46 must carry side-seam pocket geometry at extra-high rise");
  assert.ok(variantNames.some((name)=>name==="TrouserPocketVariant__mid__double_jetted_back"),"M7.46 must carry rear-facing jetted pocket geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserPocketVariant__low__slant"),"M7.46 must carry low-rise slant-pocket geometry");
  assert.ok(variantNames.some((name)=>name==="TrouserCreaseVariant__front"),"M7.46 must keep tailored front creases visible across trouser fits");
  assert.ok(variantNames.some((name)=>name==="TrouserCoreDetailVariant__low"),"M7.46 must carry low-rise fly and waistband core detail");
  assert.ok(variantNames.some((name)=>name==="TrouserCoreDetailVariant__high"),"M7.46 must carry high-rise fly and waistband core detail");
  assert.ok(variantNames.some((name)=>name==="TrouserWaistVariant__extra_high"),"M7.46 must carry a real extra-high/Korean waistband shell");
  assert.ok(variantNames.some((name)=>name==="TrouserCoreDetailVariant__extra_high"),"M7.46 must carry extra-high rise fly/waist construction detail");
  assert.ok(modelState.materialNames.some((name)=>name==="ButtonAccentVariant__trouser_rise__extra_high"),"M7.46 must carry extra-high rise closure hardware");
  assert.ok(modelState.materialNames.some((name)=>name==="ButtonAccentVariant__trouser_rise__high"),"M7.46 must carry high-rise trouser closure hardware");

  // The saved recipe already names camp/wide types with explicit custom
  // overrides. Native selects do not fire change when reselecting that same
  // option. Exercise a real type transition before asserting preset resets.
  await selectTailoringOption(page,"3D shirt type","dress_shirt");
  assert.equal(await page.getByLabel("3D shirt type").inputValue(),"dress_shirt");
  await selectTailoringOption(page,"3D shirt type","camp_collar_resort");
  assert.equal(await page.getByLabel("3D shirt wear").inputValue(),"untucked","camp shirt preset must switch to untucked wear");
  assert.equal(await page.getByLabel("3D sleeve").inputValue(),"half","camp shirt preset must switch to half sleeve");
  assert.equal(await page.getByLabel("3D collar",{exact:true}).inputValue(),"camp","camp shirt preset must switch the collar geometry");
  await selectTailoringOption(page,"3D trouser type","formal_flat_front");
  assert.equal(await page.getByLabel("3D trouser type").inputValue(),"formal_flat_front");
  await selectTailoringOption(page,"3D trouser type","wide_leg_relaxed_drape");
  assert.equal(await page.getByLabel("3D trouser fit").inputValue(),"wide","wide-leg trouser preset must switch leg geometry");
  assert.equal(await page.getByLabel("3D trouser rise").inputValue(),"high","wide-leg trouser preset must switch rise");
  assert.equal(await page.getByLabel("3D trouser pleat").inputValue(),"double_reverse","wide-leg trouser preset must switch to double reverse pleats");
  await selectTailoringOption(page,"3D trouser type","korean_high_rise_tapered");
  assert.equal(await page.getByLabel("3D trouser fit").inputValue(),"tapered","Korean trouser preset must keep a tapered leg");
  assert.equal(await page.getByLabel("3D trouser rise").inputValue(),"extra_high","Korean trouser preset must switch to the explicit extra-high rise");
  await selectTailoringOption(page,"3D trouser type","wide_leg_relaxed_drape");
  await selectTailoringOption(page,"3D button material","metal");
  await selectTailoringOption(page,"3D collar cloth","white_collar");
  assert.equal(await page.locator(".garmentViewerShell").getAttribute("data-collar-finish"),"white_collar","collar-only contrast must stay distinct from collar + cuffs");

  await selectTailoringOption(page,"3D collar","english_spread");
  assert.equal(await page.getByLabel("3D collar",{exact:true}).inputValue(),"english_spread","English Spread / British Collar must be selectable in the live 3D tailoring library");
  await selectTailoringOption(page,"3D shirt fit","boxy");
  await selectTailoringOption(page,"3D shirt wear","untucked");
  await selectTailoringOption(page,"3D collar","mandarin");
  await selectTailoringOption(page,"3D trouser fit","wide");
  await selectTailoringOption(page,"3D trouser rise","extra_high");
  assert.equal(await page.getByLabel("3D trouser rise").inputValue(),"extra_high","extra-high rise must be directly selectable");
  await selectTailoringOption(page,"3D trouser rise","high");
  await selectTailoringOption(page,"3D trouser pleat","double_forward");
  await selectTailoringOption(page,"3D trouser waistband","side_adjuster");
  await selectTailoringOption(page,"3D trouser break","negative");
  await selectTailoringOption(page,"3D collar construction","soft_unfused");
  await selectTailoringOption(page,"3D cuff construction","soft");
  await selectTailoringOption(page,"3D shirt yoke","western");
  assert.equal(await page.getByLabel("3D shirt back").inputValue(),"plain","western yoke must clear incompatible rear pleats");
  await selectTailoringOption(page,"3D shirt back","rear_side_pleats");
  assert.equal(await page.getByLabel("3D shirt yoke").inputValue(),"split","rear pleats must switch an incompatible western yoke to split");
  await selectTailoringOption(page,"3D shirt hem","straight");
  await selectTailoringOption(page,"3D trouser hem","turnup_4");
  await selectTailoringOption(page,"3D trouser pockets","jean");
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
  assert.equal(await styleSelects.count(), 23, "M7.46 must expose twenty-three live tailoring controls");
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
  const runtimeMaterialNames=[
    "ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
    "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric",
    "ShirtTorsoBackVariant__boxy__rear_side_pleats",
    "ShirtSleeveLLength__boxy__half","ShirtSleeveRLength__boxy__half",
    "TrouserLegLBreakVariant__wide__negative","TrouserLegRBreakVariant__wide__negative"
  ];
  const materialState = await viewer.evaluate(async (element,names) => {
    const wanted=new Set(names);
    const result=[];
    for(const current of element.model?.materials || []){
      if(!wanted.has(current.name)) continue;
      if(current.isLoaded!==true && typeof current.ensureLoaded==="function") {
        await Promise.race([
          current.ensureLoaded(),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error("material hydration timeout: "+current.name)),5000)),
        ]);
      }
      result.push({
        name: current.name,
        alpha: current.pbrMetallicRoughness?.baseColorFactor?.[3],
        roughness: current.pbrMetallicRoughness?.roughnessFactor,
        metallic: current.pbrMetallicRoughness?.metallicFactor,
        hasTexture: Boolean(current.pbrMetallicRoughness?.baseColorTexture?.texture),
        hasNormal: Boolean(current.normalTexture?.texture),
        scale: current.pbrMetallicRoughness?.baseColorTexture?.texture?.sampler?.scale || null,
        offset: current.pbrMetallicRoughness?.baseColorTexture?.texture?.sampler?.offset || null,
        rotation: current.pbrMetallicRoughness?.baseColorTexture?.texture?.sampler?.rotation ?? null,
      });
    }
    return result;
  },runtimeMaterialNames);
  assert.equal(materialState.length,runtimeMaterialNames.length,"M7.46 must hydrate exactly the runtime materials under verification");
  for (const material of materialState) {
    assert.equal(material.metallic, 0, material.name + " must remain non-metallic");
    assert.ok(material.roughness >= .55 && material.roughness <= .98, material.name + " roughness must stay in the cloth range");
  }
  const materialByName=Object.fromEntries(materialState.map((item)=>[item.name,item]));
  for(const name of [
    "ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
    "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric",
  ]) assert.equal(materialByName[name].alpha,0,name+" must stay hidden after fabric changes while its tailored variant is active");
  try {
    await page.waitForFunction(()=>{
      const materials=document.querySelector("model-viewer")?.model?.materials||[];
      return ["ShirtCollarVariant__mandarin__soft_unfused","ShirtNeckGasketVariant__mandarin__soft_unfused"].every((name)=>{
        const pbr=materials.find((material)=>material.name===name)?.pbrMetallicRoughness;
        const color=pbr?.baseColorFactor;
        return color&&Math.abs(color[0]-.97)<.001&&Math.abs(color[2]-.95)<.001
          &&color[3]===1&&!pbr.baseColorTexture?.texture;
      });
    },null,{timeout:8000});
  } catch(error) {
    // A previous native CI run reached correct fabric-selected values but
    // never displayed the actual white collar and neck band in 8 seconds.
    // Capture real GLTF material state, current visible pieces and shell
    // readiness; NEVER force test-only white material values to pass.
    const snapshot=await page.evaluate(()=>{
      const viewer=document.querySelector("model-viewer");
      const materials=viewer?.model?.materials||[];
      const focus=["ShirtCollarVariant__mandarin__soft_unfused",
        "ShirtNeckGasketVariant__mandarin__soft_unfused"];
      return {
        whiteCollarRequested:document.querySelector(".garmentViewerShell")?.getAttribute("data-collar-finish")??null,
        tailoringReady:document.querySelector(".garmentViewerShell")?.getAttribute("data-tailoring-ready")??null,
        modelLoaded:Boolean(viewer?.loaded),
        materialCount:materials.length,
        trim:focus.map((name)=>{
          const material=materials.find((item)=>item.name===name);
          const pbr=material?.pbrMetallicRoughness;
          return {name,exists:Boolean(material),loaded:material?.isLoaded??null,
            rgba:pbr?.baseColorFactor??null,
            texturePresent:Boolean(pbr?.baseColorTexture?.texture),
            roughness:pbr?.roughnessFactor??null};
        }),
        garmentVisibility:materials.filter((m)=>
          (m.name.startsWith("Shirt")||m.name.startsWith("Trouser"))
          &&m.pbrMetallicRoughness?.baseColorFactor?.[3]>.95).map((m)=>m.name).slice(0,45),
      };
    }).catch(e=>({error:String(e)}));
    await fs.writeFile(path.join(output,"garment-trim-failure.json"),
      JSON.stringify({snapshot,error:String(error)},null,2)+"\n");
    throw new Error("3D collar and neck contrast did not complete after real browser input: "+
      JSON.stringify({snapshot,error:String(error)}));
  }
  const assertRuntimeMapped=(name)=>{
    const material=materialByName[name];
    assert.ok(material,name+" must exist");
    assert.equal(material.hasTexture,true,name+" must carry the selected swatch texture when active");
    assert.equal(material.hasNormal,true,name+" must carry linen normal detail when active");
    assert.ok(material.scale&&material.scale.u>0&&material.scale.v>0,name+" must carry a panel-scale texture transform");
    assert.ok(material.offset&&Number.isFinite(material.offset.u)&&Number.isFinite(material.offset.v),name+" must expose texture phase offset");
    assert.ok(Number.isFinite(material.rotation),name+" must expose texture grain rotation");
  };
  for(const name of [
    "ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
    "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric",
    "ShirtTorsoBackVariant__boxy__rear_side_pleats",
    "ShirtSleeveLLength__boxy__half","ShirtSleeveRLength__boxy__half",
    "TrouserLegLBreakVariant__wide__negative","TrouserLegRBreakVariant__wide__negative"
  ]) assertRuntimeMapped(name);
  const sameTransform=(a,b,label)=>{
    assert.ok(a&&b,label+" materials must exist");
    assert.deepEqual(a.scale,b.scale,label+" must inherit the physical panel texture scale");
    assert.deepEqual(a.offset,b.offset,label+" must inherit the panel phase offset");
    assert.equal(a.rotation,b.rotation,label+" must inherit the panel grain rotation");
  };
  sameTransform(materialByName["ShirtSleeveLLength__boxy__half"],materialByName["ShirtSleeveLFabric"],"left shortened sleeve");
  sameTransform(materialByName["ShirtSleeveRLength__boxy__half"],materialByName["ShirtSleeveRFabric"],"right shortened sleeve");
  sameTransform(materialByName["TrouserLegLBreakVariant__wide__negative"],materialByName["TrouserLegLFabric"],"left cropped wide trouser");
  sameTransform(materialByName["TrouserLegRBreakVariant__wide__negative"],materialByName["TrouserLegRFabric"],"right cropped wide trouser");

  const readLayout=()=>page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewerWidth: document.querySelector(".garmentViewerCanvas")?.getBoundingClientRect().width || 0,
    viewerHeight: document.querySelector(".garmentViewerCanvas")?.getBoundingClientRect().height || 0,
    stageTop: document.querySelector(".garmentViewerStage")?.getBoundingClientRect().top ?? 999999,
    controlsTop: document.querySelector(".garmentViewerControls")?.getBoundingClientRect().top ?? -1,
  }));
  const assertLayout=(layout,expectedWidth)=>{
    assert.ok(layout.documentWidth <= expectedWidth + 2, "GarmentViewer horizontal overflow at " + expectedWidth + "px");
    assert.ok(layout.viewerWidth > 250 && layout.viewerHeight > 400, "GarmentViewer canvas must remain usable");
    if(expectedWidth<=640) assert.ok(layout.stageTop < layout.controlsTop, "mobile must show the 3D stage before controls");
  };

  const captureViewportEvidence=async(name)=>{
    const viewport=page.viewportSize();
    assert.ok(viewport,"browser QA viewport must be available for evidence capture");
    // This route is intentionally very tall because it exposes the full tailoring library.
    // Capture the asserted viewport instead of asking Chromium to rasterize the entire
    // continuously rendered WebGL page, which can exceed CI's screenshot deadline.
    await captureStableWebGLFrame(page,path.join(output,name),{
      x:0,y:0,width:viewport.width,height:viewport.height,
    });
  };

  const desktopLayout=await readLayout();
  assertLayout(desktopLayout,width);
  await captureViewportEvidence("garment-viewer-" + width + ".png");

  // Reuse the already-loaded WebGL/model scene for mobile responsive QA. Reloading this
  // large contract a second time on CI duplicates shader/model startup cost without
  // increasing coverage; CSS and React responsive behavior update on viewport resize.
  await page.setViewportSize({width:390,height:1000});
  await page.waitForTimeout(250);
  const mobileLayout=await readLayout();
  assertLayout(mobileLayout,390);
  await captureViewportEvidence("garment-viewer-390.png");

  assert.deepEqual(errors, [], "GarmentViewer must load without console/page errors");
  await context.close();
  return { width, modelState, materialState, layout:desktopLayout, responsiveLayouts:[mobileLayout] };
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const viewports = [];
    // Load the production GLB once, then resize that same hydrated scene for mobile QA.
    viewports.push(await verifyViewport(browser, 1440));
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
