import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const qa=readFileSync(new URL("../scripts/verify-garment-viewer.cjs",import.meta.url),"utf8");

test("dense 3D variant QA uses genuine hit-tested pointer and browser keyboard events",()=>{
  for(const token of [
    "page.mouse.click(x,y)",
    "page.keyboard.press(first)",
    "page.keyboard.press(\"Enter\")",
    "document.elementFromPoint(x,y)",
    "requested.label.charAt(0).toLowerCase()",
    "select.scrollIntoView({block:\"center\"",
    "select.getBoundingClientRect()",
    "page.keyboard.type(prefix,{delay:0})",
    "target.isVisible()",
    "target.isEnabled()",
    "inputValue({timeout:3000})",
  ]) assert.ok(qa.includes(token),token);
  assert.ok(!qa.includes("target.boundingBox("),"avoid compositor-blocked locator boundingBox");
  assert.ok(!qa.includes("target.selectOption("),"avoid WebGL compositor-dependent Playwright selected-option stall");
  assert.ok(!qa.includes("dispatchEvent(new Event("),"QA must never forge change events");
  const selector=qa.slice(qa.indexOf("async function selectTailoringOption("),qa.indexOf("async function verifyViewport(",qa.indexOf("async function selectTailoringOption(")));
  assert.ok(!/\.(?:click|selectOption|check|uncheck)\(\{[^)]*force\s*:\s*true/.test(selector),"do not bypass actual native interactivity gates");
});

test("native customer style transitions record real, reproducible p95 rather than fake speed",()=>{
  for(const marker of [
    'const nativeGestureDurationsMs=[]',
    'const inputStarted=Date.now();',
    'const gestureMs=Date.now()-inputStarted',
    'nativeGestureDurationsMs.push({label,value,gestureMs})',
    'p95Ms:p95',
    'actualGestureValues.length>=12&&p95!==null&&p95<300',
    'productionSpeedCertified:false',
    'native-tailoring-interaction-latency.json',
  ]) assert.ok(qa.includes(marker),marker);
  assert.ok(!qa.includes('nativeGestureDurationsMs.push({label,value,gestureMs:0})'));
  assert.ok(qa.includes('page.mouse.click(x,y)'));
  assert.ok(qa.includes('page.keyboard.type(prefix,{delay:0})'));
});

test("native 3D selector refuses occluded or mismatched options",()=>{
  assert.ok(qa.includes("uncovered,true"));
  assert.ok(qa.includes("options.filter((option)=>"));
  assert.ok(qa.includes("part.toLowerCase()"));
  assert.ok(qa.includes("hitbox.withinViewport,true"));
  assert.ok(qa.includes("const inputStarted=Date.now();"));
  assert.ok(qa.includes("if(!changed) await page.keyboard.press(\"Enter\")"));
  assert.ok(qa.includes("nativeTypeAhead"));
  assert.ok(qa.includes("nativeChangeProbe"));
  assert.ok(qa.includes("Date.now()-inputStarted<6000"));
});

test("four-angle evidence still captures actual WebGL compositor pixels without compositor-bound locator layout",()=>{
  const capture=qa.slice(qa.indexOf('const captureCanvas=async(name)=>'),qa.indexOf('const selectCamera=async('));
  assert.ok(capture.includes('document.querySelector(".garmentViewerCanvas")'));
  assert.ok(capture.includes('node.getBoundingClientRect()'),"measure a genuine rendered DOM canvas");
  assert.ok(capture.includes('box.visible'),"a hidden canvas cannot generate approved visual evidence");
  assert.ok(capture.includes('box.x<width&&box.y<1000'),"ensure evidence source intersects viewport");
  assert.ok(capture.includes('captureStableWebGLFrame('),"preserve genuine WebGL compositor image");
  assert.ok(!capture.includes('canvas.boundingBox('),"never block real four-angle capture on compositor stability");
  const screenshots=qa.match(/captureCanvas\("garment-angle-(?:front|three-quarter|side|back)\.png"\)/g)||[];
  assert.equal(screenshots.length,4,"keep all four physical inspection camera views");
  assert.ok(qa.includes('session.send("Page.captureScreenshot"'));
  assert.ok(qa.includes('Buffer.from(frame.data,"base64")'),"real pixels must reach artifact");
});

const actualViewerComponent=readFileSync(
  new URL("../src/components/GarmentViewer.tsx",import.meta.url),"utf8"
);

test("cold-start garment tailoring cannot hydrate white default shaders before real cloth textures",()=>{
  assert.ok(actualViewerComponent.includes('const [preparedFabricVersion,setPreparedFabricVersion]=useState("")'));
  assert.ok(actualViewerComponent.includes('preparedFabricVersion!==requestedFabricVersion'));
  assert.ok(actualViewerComponent.includes('preparedTextureRef.current.size!==panelSpecs.length'));
  assert.ok(actualViewerComponent.includes('setTailoringPhase("awaiting-fabric-textures")'));
  assert.ok(actualViewerComponent.includes("setPreparedFabricVersion(requestedFabricVersion)"));
  const textureDone=actualViewerComponent.indexOf('setPreparedFabricVersion(requestedFabricVersion)');
  const variantGate=actualViewerComponent.indexOf('if(preparedFabricVersion!==requestedFabricVersion');
  assert.ok(textureDone>=0&&variantGate>textureDone,"do not mark complete before six physically textured panels were applied");
});

test("deferred six-panel linen normals remain ready on inactive base shells without hydrating all variants",()=>{
  assert.ok(actualViewerComponent.includes('const basePanel=panelSpecs.some((item)=>item.material===material.name)'));
  assert.ok(actualViewerComponent.includes('!basePanel && !visibleGarmentMaterialsRef.current.has(material.name)'));
  assert.ok(qa.includes('data-fabric-phase")==="weave-ready"'));
  assert.ok(qa.includes('garment-weave-failure.json'));
  assert.ok(qa.includes("timeout:12000"),"physical weave must remain a bounded independent secondary QA gate");
});

test("fabric colour reaches all six real panels before optional costly weave shader textures",()=>{
  const begin=actualViewerComponent.indexOf('setFabricHydrationPhase("creating-color-tiles")');
  const applied=actualViewerComponent.indexOf('setPreparedFabricVersion(requestedFabricVersion)',begin);
  const weave=actualViewerComponent.indexOf('setFabricHydrationPhase("weave-normals-in-background")',applied);
  assert.ok(begin>=0&&applied>begin&&weave>applied,"no cold weave texture should gate first fully dressed 3D");
  assert.ok(actualViewerComponent.includes('if(!tailoringMaterialsReady || preparedFabricVersion!==requestedFabricVersion'));
  assert.ok(actualViewerComponent.includes('visibleGarmentMaterialsRef.current.has(material.name)'),
    "weave must only touch already loaded visible materials after first dressed frame");
  assert.ok(actualViewerComponent.includes('data-fabric-phase={fabricHydrationPhase}'),
    "browser QA must diagnose the exact fabric hydration phase");
});

test("native initial scene keeps the full 20-second ready gate while bounded-prefetching secondary tailoring",()=>{
  assert.ok(actualViewerComponent.includes('const selectedToHydrate=replacements.filter((name)=>'),
    "all selected cloth and trim must prefetch on cold and interactive style loads");
  assert.ok(actualViewerComponent.includes('const replacementPrefetch=createBoundedMaterialPrefetch('));
  assert.ok(actualViewerComponent.includes('coldFirstLook?3:2'));
  assert.ok(actualViewerComponent.includes('const material=await replacementPrefetch.take(name);'),
    "real GPU hydration must follow structural order, without serial cosmetic tail");
  assert.ok(actualViewerComponent.includes('setTailoringPhase("skin-and-hardware")'));
  assert.ok(actualViewerComponent.includes('setTailoringPhase("collar-and-cuff")'));
  assert.ok(qa.includes('timeout:20000'),"do not weaken real WebGL full-dress timing");
});

test("fast first full outfit batches cold shaders but real subsequent selector edits remain paced",()=>{
  assert.ok(actualViewerComponent.includes('const coldFirstLook=lastVariantAppearanceRef.current===null'));
  assert.ok(actualViewerComponent.includes('visibleButtonMaterialsRef.current.size===0'));
  assert.ok(actualViewerComponent.includes('interactionStartedAt.current===null'));
  assert.ok(actualViewerComponent.includes('coldFirstLook?64:1'),
    "active customer wardrobe changes must yield for every real material mutation");
  assert.ok(actualViewerComponent.includes('if(existing?.isLoaded===true)'),
    "warm default cloth must retire instantly without a redundant shader load");
  assert.ok(actualViewerComponent.includes('setMaterialAlpha(existing,false)'),
    "old geometry still gets hidden ONLY after new garment is ready");
  assert.ok(actualViewerComponent.includes('setTailoringMaterialsReady(true);setTailoringPhase("ready")'),
    "faster batching must not claim visual readiness before all selected materials finish");
});

test("dense WebGL tailoring changes never hide the existing dressed mannequin before replacement loads",()=>{
  const effect=actualViewerComponent.slice(
    actualViewerComponent.indexOf('const yieldForInput=createCooperativeMaterialBatch('),
    actualViewerComponent.indexOf('function applyShirtTypePreset(')
  );
  const reveal=effect.indexOf('for(const name of replacements){');
  assert.ok(effect.includes('garmentSurfaceVisibilityPriority(a)-garmentSurfaceVisibilityPriority(b)'),
    'hydrate the six structural shirt/trouser surfaces before minor cosmetic trim');
  const hide=effect.indexOf('for(const name of previous){');
  assert.ok(reveal>=0&&hide>reveal,"hydrate replacement garment before hiding old clothing");
  assert.ok(effect.includes('visibleGarmentMaterialsRef.current.delete(name)'));
  assert.ok(effect.includes('visibleGarmentMaterialsRef.current.add(name)'));
  assert.ok(effect.includes('if(isCurrent()) {setTailoringMaterialsReady(true);setTailoringPhase("ready");}'),
    "only physically finished shader work can mark the outfit visually ready");
  assert.ok(effect.includes('setTailoringMaterialsReady(false)'));
  assert.ok(actualViewerComponent.includes('data-tailoring-ready={tailoringMaterialsReady?"true":"false"}'));
});

test("four camera views require actual stable 3D shirt and trousers, never floating fragments",()=>{
  const ready=qa.slice(
    qa.indexOf('// M7.46 originally captured'),
    qa.indexOf('await captureCanvas("garment-angle-front.png")',qa.indexOf('// M7.46 originally captured'))
  );
  assert.ok(ready.includes('data-tailoring-ready'));
  assert.ok(ready.includes('visible("Shirt")&&visible("Trouser")'));
  assert.ok(ready.includes('timeout:20000'));
  assert.ok(!ready.includes('setBaseColorFactor('),"QA cannot fake visible clothing");
});

test("Mandarin stand collar includes a separate fabric-backed neck seal, also for white contrast",()=>{
  const source=readFileSync(new URL("../scripts/build-garment-viewer-model.mjs",import.meta.url),"utf8");
  assert.ok(source.includes('styleVariants.collars.filter((item)=>!["camp","one_piece"].includes(item.id))'));
  assert.ok(source.includes('if(["camp","one_piece"].includes(item.id)) continue;'));
  assert.ok(source.includes('addMesh(`ShirtNeckGasketVariantMesh__${key}`,neckGasket,`ShirtNeckGasketVariant__${key}`)'));
  assert.ok(qa.includes('"ShirtNeckGasketVariant__mandarin__soft_unfused"'));
  assert.ok(actualViewerComponent.includes('const neckGasket=await ensureViewerMaterialLoaded('));
  assert.ok(actualViewerComponent.includes('if(whiteCollar) neckGasket.pbrMetallicRoughness.baseColorTexture?.setTexture(null)'));
});

test("white-collar QA reports actual shader state instead of silently waiving real failures",()=>{
  assert.ok(qa.includes('garment-trim-failure.json'));
  assert.ok(qa.includes('texturePresent:Boolean(pbr?.baseColorTexture?.texture)'));
  assert.ok(qa.includes('whiteCollarRequested'));
  assert.ok(qa.includes('garmentVisibility:materials.filter('));
  assert.ok(qa.includes('timeout:8000'),"keep actual 8-second interactive material gate");
  assert.ok(!qa.includes('setBaseColorFactor([.97'),"tests must never forge contrasting cloth");
});

test("every 3D visual capture preserves an unapproved comparison with the original studio model",()=>{
  assert.ok(qa.includes('sharp("public/designer/studio-tucked.webp")'));
  assert.ok(qa.includes('unmodified3DSource:actualName'));
  assert.ok(qa.includes('visualMatchApproved:false'),"compositing pictures cannot certify model identity");
  assert.ok(qa.includes('studio-original-vs-3d-UNAPPROVED.png'));
  assert.ok(qa.includes('preserveOriginalVs3DReference("garment-angle-front.png")'));
  assert.ok(qa.includes('preserveOriginalVs3DReference("garment-current-exact-front-UNAPPROVED.png")'));
  assert.ok(qa.includes('Page.captureScreenshot'),"real Chromium compositor pixels are required");
});

test("actual 3D model is compared to the original studio with equivalent full-sleeve tucked styling",()=>{
  const viewer=readFileSync(new URL("../src/components/GarmentViewer.tsx",import.meta.url),"utf8");
  assert.ok(viewer.includes('function applyOriginalStudioOutfit()'));
  assert.ok(viewer.includes('onClick={applyOriginalStudioOutfit}'));
  assert.ok(viewer.includes('setShirtWearKey("tucked")'));
  assert.ok(viewer.includes('setSleeveKey("full")'));
  assert.ok(viewer.includes('setTrouserFitKey("straight")'));
  assert.ok(qa.includes("page.mouse.click(referenceButton.x,referenceButton.y)"),
    "native action must trigger the real React state flow");
  assert.ok(qa.includes('block:"center",inline:"nearest",behavior:"instant"'),
    "mobile-to-desktop transition must not race a smooth scroll before the real pointer click");
  assert.ok(qa.includes("document.elementFromPoint(x,y)"),
    "do not claim a native control was hit without hit testing");
  assert.ok(qa.includes("withinViewport&&hit===button"),
    "require a real unobstructed browser hit target inside the viewport");
  assert.ok(qa.includes("blockerTag:hit?.tagName"),
    "report the actual element blocking pointer actions when browser QA fails");
  assert.ok(qa.includes('studio-default-exact-front-UNAPPROVED.png'));
  assert.ok(qa.includes('studio-original-vs-styled-3d-UNAPPROVED.png'));
  assert.ok(qa.includes('shell?.getAttribute("data-tailoring-ready")==="true"'),
    "capture actual completed shirt and trouser geometry, not an intermediate frame");
  assert.ok(qa.includes("timeout:20000"),"retain the strict fully dressed WebGL timing gate");
  assert.ok(qa.includes('studio-style-reset-readiness-failure.json'),
    "a native studio-style readiness failure must retain actual material evidence");
  assert.ok(qa.includes('tailoringPhase:shell?.getAttribute("data-tailoring-phase")'),
    "classify actual WebGL phase instead of silently extending timing limits");
  assert.ok(qa.includes('loadedMaterialCount:loaded.length'),
    "verify the actual GPU-loaded PBR count when the 3D scene is not ready");
  for(const key of ["tailoringSelectedCount","tailoringLoadedOrdinal","tailoringLoadingMaterial","tailoringLastLoadedMaterial"]){
    assert.ok(actualViewerComponent.includes("viewer.dataset."+key+"="),
      "the production WebGL loader must expose real in-flight shader progress: "+key);
  }
  assert.ok(qa.includes('currentLoadingMaterial:viewer?.dataset?.tailoringLoadingMaterial'),
    "browser failure evidence must name the exact expensive shader without a new fake-ready signal");
  assert.ok(qa.includes('selectedMaterialApplied:Number(viewer?.dataset?.tailoringLoadedOrdinal'),
    "browser failure evidence must retain how many real selected style materials were committed");
  for(const key of ["tailoringOperation","tailoringLastYieldMs","tailoringLastLoadMs","tailoringLastBindMs"]){
    assert.ok(actualViewerComponent.includes("viewer.dataset."+key+"="),
      "diagnose genuine WebGL slowness without inventing visual readiness: "+key);
  }
  for(const marker of [
    'nativeOperation:viewer?.dataset?.tailoringOperation',
    'lastYieldMs:Number(viewer?.dataset?.tailoringLastYieldMs',
    'lastLoadMs:Number(viewer?.dataset?.tailoringLastLoadMs',
    'lastPbrBindMs:Number(viewer?.dataset?.tailoringLastBindMs',
  ]) assert.ok(qa.includes(marker),marker);
  assert.ok(qa.includes('identityVisualParity:shell?.getAttribute("data-identity-visual-parity")'),
    "the comparison must explicitly retain independent studio-image approval");
});

test("initial scene failures report actual material hydration phase and visible cloth",()=>{
  assert.ok(qa.includes("garment-initial-style-failure.json"));
  assert.ok(qa.includes("tailoringPhase:shell?.getAttribute"));
  assert.ok(qa.includes("visibleMaterialNames:visible.map("));
  assert.ok(qa.includes("sampleShirt:materials.filter("));
  assert.ok(qa.includes("sampleTrouser:materials.filter("));
  assert.ok(qa.includes("timeout:20000"),"real visual completeness gate must remain bounded");
  assert.ok(!qa.includes('setAttribute("data-tailoring-ready"'),"QA must not fabricate readiness");
  assert.ok(actualViewerComponent.includes("data-tailoring-phase={tailoringPhase}"));
  for(const stage of ["queued","enumerating-variants","loading-replacement-cloth","retiring-old-cloth","skin-and-hardware","collar-and-cuff","ready","error"]){
    assert.ok(actualViewerComponent.includes('setTailoringPhase("'+stage+'")'),stage);
  }
});

test("the original faceless ivory studio mannequin and white shoes use a matte nonmetallic provisional palette",()=>{
  const palette=JSON.parse(readFileSync(new URL("../public/model-identity/studio-material-palette.json",import.meta.url),"utf8"));
  const build=readFileSync(new URL("../scripts/build-garment-viewer-model.mjs",import.meta.url),"utf8");
  assert.equal(palette.identityId,"linen-earth-studio-model-v1");
  assert.equal(palette.status,"art-direction-only-unverified");
  for(const part of [palette.skin,palette.leather]){
    assert.equal(part.rgba.length,4);
    assert.equal(part.rgba[3],1);
    assert.ok(part.rgba.slice(0,3).every(value=>Number.isFinite(value)&&value>=.78&&value<=.94),
      "preserve the original matte white mannequin and white shoes; peach skin and dark shoes are wrong");
    assert.ok(part.roughness>=.75&&part.roughness<1);
  }
  assert.ok(build.includes("studioPalette.skin.rgba"));
  assert.ok(build.includes("studioPalette.leather.rgba"));
  assert.ok(actualViewerComponent.includes("studioPalette.skin.rgba.slice(0,3)"));
  assert.ok(actualViewerComponent.includes("studioPalette.skin.roughness"));
});

test("native WebGL QA observes only actually loaded materials",()=>{
  const initial=qa.slice(
    qa.indexOf('// M7.46 originally captured'),
    qa.indexOf('await captureCanvas("garment-angle-front.png")',qa.indexOf('// M7.46 originally captured'))
  );
  assert.ok(initial.includes('material.isLoaded===true&&'));
  assert.ok(initial.includes('&&m.isLoaded===true'));
  assert.ok(initial.includes('alpha:m.isLoaded===true?m.pbrMetallicRoughness?.baseColorFactor?.[3]:null'));
  const trim=qa.slice(qa.indexOf('  try {\n    await page.waitForFunction(()=>{\n      const materials=document.querySelector("model-viewer")?.model?.materials||[];'));
  assert.ok(trim.includes('if(material?.isLoaded!==true) return false;'));
  assert.ok(trim.includes('const pbr=material?.isLoaded===true?material.pbrMetallicRoughness:null;'));
  assert.ok(!initial.includes('material.ensureLoaded()'),"readiness checker must not hydrate unloaded shader slots");
  assert.ok(initial.includes('timeout:20000'),"do not weaken real full-outfit visual limit");
});


test("production 3D model contract is read from real DOM without compositor-blocked locator.evaluate",()=>{
  assert.ok(qa.includes('const modelState = await page.evaluate(() => {'));
  assert.ok(qa.includes('const element=document.querySelector("model-viewer");'));
  assert.ok(qa.includes('materialNames: materials.map((material) => material.name)'));
  assert.ok(!qa.includes('const modelState = await viewer.evaluate('),
    "native GitHub Chromium stalled 30 seconds on compositor-bound locator.evaluate");
  assert.ok(qa.includes('assert.equal(modelState.hasCreateTexture, true'),
    "do not replace actual production GLTF material checks with synthetic fixtures");
});
