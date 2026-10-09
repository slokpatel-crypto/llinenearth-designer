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
  const reveal=effect.indexOf('for(const name of next){');
  const hide=effect.indexOf('for(const name of previous){');
  assert.ok(reveal>=0&&hide>reveal,"hydrate replacement garment before hiding old clothing");
  assert.ok(effect.includes('visibleGarmentMaterialsRef.current.delete(name)'));
  assert.ok(effect.includes('visibleGarmentMaterialsRef.current.add(name)'));
  assert.ok(effect.includes('if(isCurrent()) setTailoringMaterialsReady(true)'));
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
