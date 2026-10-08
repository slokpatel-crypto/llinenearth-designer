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
    "target.isVisible()",
    "target.isEnabled()",
    "inputValue({timeout:3000})",
  ]) assert.ok(qa.includes(token),token);
  assert.ok(!qa.includes("target.selectOption("),"avoid WebGL compositor-dependent Playwright selected-option stall");
  assert.ok(!qa.includes("dispatchEvent(new Event("),"QA must never forge change events");
  assert.ok(!qa.includes("force:true"),"do not bypass actual native interactivity gates");
});

test("native 3D selector refuses occluded or mismatched options",()=>{
  assert.ok(qa.includes("uncovered,true"));
  assert.ok(qa.includes("options.filter((option)=>"));
  assert.ok(qa.includes("Date.now()-started<6000"));
});
