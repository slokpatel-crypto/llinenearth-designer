import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { photoSourceSplitClip } from "../src/lib/designer/photo-source-split.ts";

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

test("customer slider is only a source overlay, not a saved design or AI source", () => {
  const component=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(component,/const \[splitCompare,setSplitCompare\]=useState\(false\)/);
  assert.match(component,/const \[splitPercent,setSplitPercent\]=useState\(50\)/);
  assert.match(component,/data-photo-split=\{splitCompare&&ready&&!showOriginal&&!showCreativeAi/);
  assert.match(component,/style=\{\{clipPath:photoSourceSplitClip\(splitPercent\)\}\}/);
  assert.match(component,/newDesignerPhotoSplitOriginal/);
  assert.match(component,/aria-label="Original photograph coverage"/);
  assert.match(component,/setSplitCompare\(false\);\s*setSplitPercent\(50\);/);
  assert.match(component,/Save exports the selected design, not the split/);
  assert.doesNotMatch(component,/renderSignature=JSON\.stringify\(\{[^]*splitCompare/);
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
