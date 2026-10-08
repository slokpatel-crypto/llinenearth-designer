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
