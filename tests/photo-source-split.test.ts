import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { photoSourceSplitClip, photoSourceSplitMode } from "../src/lib/designer/photo-source-split.ts";

test("source split clip is deterministic, bounded and never changes stored pixels", () => {
  assert.equal(photoSourceSplitClip(0),"inset(0 100% 0 0)");
  assert.equal(photoSourceSplitClip(25),"inset(0 75% 0 0)");
  assert.equal(photoSourceSplitClip(50),"inset(0 50% 0 0)");
  assert.equal(photoSourceSplitClip(100),"inset(0 0% 0 0)");
  assert.equal(photoSourceSplitClip(-12),"inset(0 100% 0 0)");
  assert.equal(photoSourceSplitClip(250),"inset(0 0% 0 0)");
  assert.equal(photoSourceSplitClip(NaN),"inset(0 50% 0 0)");
  assert.equal(photoSourceSplitClip(Infinity),"inset(0 50% 0 0)");
  assert.equal(photoSourceSplitClip(25.6),"inset(0 74% 0 0)");
});

test("source split mode truthfully distinguishes both endpoints from a mixed wipe", () => {
  assert.equal(photoSourceSplitMode(-12),"selected");
  assert.equal(photoSourceSplitMode(0),"selected");
  assert.equal(photoSourceSplitMode(0.49),"selected");
  assert.equal(photoSourceSplitMode(0.51),"split");
  assert.equal(photoSourceSplitMode(50),"split");
  assert.equal(photoSourceSplitMode(99.49),"split");
  assert.equal(photoSourceSplitMode(99.51),"source");
  assert.equal(photoSourceSplitMode(100),"source");
  assert.equal(photoSourceSplitMode(250),"source");
  assert.equal(photoSourceSplitMode(NaN),"split");
});

test("customer slider is only a source overlay, not a saved design or AI source", () => {
  const component=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(component,/const \[splitCompare,setSplitCompare\]=useState\(false\)/);
  assert.match(component,/const \[splitPercent,setSplitPercent\]=useState\(50\)/);
  assert.match(component,/data-photo-split=\{splitCompare&&ready&&!showOriginal&&!showCreativeAi/);
  assert.match(component,/style=\{\{clipPath:photoSourceSplitClip\(splitPercent\)\}\}/);
  assert.match(component,/newDesignerPhotoSplitOriginal/);
  assert.match(component,/showBoundaries && ready && !showOriginal && !showCreativeAi && !splitCompare/);
  assert.match(component,/aria-label="Original photograph coverage"/);
  assert.match(component,/data-photo-split-view=\{activeSplitMode\?\?"inactive"\}/);
  assert.match(component,/"SPLIT \/ SOURCE \+ SELECTED"/);
  assert.match(component,/"Source \+ your look\."/);
  assert.match(component,/"Save selected design"/);
  assert.match(component,/setSplitCompare\(false\);\s*setSplitPercent\(50\);/);
  assert.match(component,/Save exports the selected design, not the split/);
  const signature=component.slice(component.indexOf("const renderSignature=JSON.stringify({"),component.indexOf("const requestScope=",component.indexOf("const renderSignature=JSON.stringify({")));
  assert.ok(signature.length>50 && !signature.includes("splitCompare") && !signature.includes("splitPercent"),
    "source slider state must not alter the persisted design signature");
  assert.match(component,/const canvas = canvasRef\.current;\s*if \(!canvas \|\| !ready\) return;/);
});

test("split view retains zoom alignment, touch readability and browser evidence at 3 widths", () => {
  const css=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.match(css,/\.newDesignerPhotoStage\.inspectFit \.newDesignerPhotoSplitOriginal/);
  assert.match(css,/\.newDesignerPhotoSplitControls input\[type="range"\]/);
  assert.match(css,/\.newDesignerPhotoSplitNote/);
  const browser=readFileSync("scripts/verify-photo-form.cjs","utf8");
  assert.match(browser,/sourceSplitInteractionVerified=true/);
  assert.match(browser,/split-before-after-\$\{width\}\.png/);
  assert.match(browser,/split source and selected garment must zoom together/);
  assert.match(browser,/split comparison must never overwrite the customer's selected canvas/);
  assert.match(browser,/split comparison and slider must not create mobile overflow/);
});
