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

test("white-collar QA reports actual shader state instead of silently waiving real failures",()=>{
  assert.ok(qa.includes('garment-trim-failure.json'));
  assert.ok(qa.includes('texturePresent:Boolean(pbr?.baseColorTexture?.texture)'));
  assert.ok(qa.includes('whiteCollarRequested'));
  assert.ok(qa.includes('garmentVisibility:materials.filter('));
  assert.ok(qa.includes('timeout:8000'),"keep actual 8-second interactive material gate");
  assert.ok(!qa.includes('setBaseColorFactor([.97'),"tests must never forge contrasting cloth");
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

test("provisional studio mannequin skin and formal leather shoes use a single nonwhite palette",()=>{
  const palette=JSON.parse(readFileSync(new URL("../public/model-identity/studio-material-palette.json",import.meta.url),"utf8"));
  const build=readFileSync(new URL("../scripts/build-garment-viewer-model.mjs",import.meta.url),"utf8");
  assert.equal(palette.identityId,"linen-earth-studio-model-v1");
  assert.equal(palette.status,"art-direction-only-unverified");
  for(const part of [palette.skin,palette.leather]){
    assert.equal(part.rgba.length,4);
    assert.equal(part.rgba[3],1);
    assert.ok(part.rgba.slice(0,3).every(value=>Number.isFinite(value)&&value>0&&value<.75),
      "do not show white head/hands or white shoes when studio reference needs natural color");
    assert.ok(part.roughness>.2&&part.roughness<1);
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
