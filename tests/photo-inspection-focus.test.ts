import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHOTO_INSPECTION_FOCUS, PHOTO_INSPECTION_TARGETS } from "../src/lib/designer/photo-inspection-focus.ts";

test("inspection targets cover photographed details without altering real source geometry", () => {
  assert.deepEqual([...PHOTO_INSPECTION_TARGETS],["collar","sleeves","waist","hem"]);
  assert.deepEqual(PHOTO_INSPECTION_FOCUS.full,{label:"Full view",scale:1,originX:50,originY:35});
  assert.deepEqual(PHOTO_INSPECTION_FOCUS.fit,{label:"Zoom fit",scale:1.42,originX:50,originY:35});
  const targets=PHOTO_INSPECTION_TARGETS.map(key=>PHOTO_INSPECTION_FOCUS[key]);
  assert.equal(new Set(targets.map(x=>x.originY)).size,targets.length);
  for(const focus of targets) {
    assert.ok(focus.scale>1 && focus.scale<=2.5);
    assert.ok(focus.originX>=0 && focus.originX<=100);
    assert.ok(focus.originY>=0 && focus.originY<=100);
  }
});

test("customer focus stays out of saved design and resets on look change", () => {
  const component=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(component,/const \[photoFocus, setPhotoFocus\] = useState<PhotoInspectionFocus>\("full"\)/);
  assert.match(component,/setPhotoFocus\("full"\)/);
  assert.match(component,/data-photo-focus=\{photoFocus\}/);
  assert.match(component,/style=\{photoInspectionStyle\}/);
  assert.match(component,/PHOTO_INSPECTION_TARGETS\.map\(target=>/);
  assert.match(component,/aria-pressed=\{photoFocus===target\}/);
  assert.match(component,/transform:inspectFit\?`scale\(\$\{photoInspection\.scale\}\)`/);
  assert.doesNotMatch(component,/const \[inspectFit, setInspectFit\]/);
  const script=readFileSync("scripts/verify-photo-form.cjs","utf8");
  assert.match(script,/detailInspectionFocusVerified=true/);
  assert.match(script,/target\.id==="collar"\|\|target\.id==="hem"/);
  assert.match(script,/inspected-\$\{target\.id\}-390\.png/);
  assert.match(script,/boundary QA must track fabric pixels/);
  assert.match(script,/44px mobile touch target/);
});

test("responsive focus controls keep source image and diagnostic overlay transforms in sync", () => {
  const stylesheet=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.match(stylesheet,/--studio-inspect-scale,1\.42/);
  assert.match(stylesheet,/--studio-inspect-origin,50% 35%/);
  assert.match(stylesheet,/\.newDesignerPhotoStage\.inspectFit \.newDesignerPhotoAi/);
  assert.match(stylesheet,/\.newDesignerFocusTargets\{display:flex;flex-wrap:wrap/);
  assert.match(stylesheet,/\.newDesignerFocusTargets button\[aria-pressed="true"\]/);
  assert.match(stylesheet,/min-height:44px/);
});
