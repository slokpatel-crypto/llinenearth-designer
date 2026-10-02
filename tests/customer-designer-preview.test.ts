import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("customer Designer keeps photographic preview as the only model surface", () => {
  const source = readFileSync("src/components/DesignerModule.tsx", "utf8");
  assert.match(source, /<PhotoOutfitPreview/);
  assert.doesNotMatch(source, /LiveConstructionPreview/);
  assert.doesNotMatch(source, /Live cut study/);
  assert.doesNotMatch(source, /previewMode|PreviewMode/);

  const page = readFileSync("src/app/designer-studio/page.tsx", "utf8");
  assert.doesNotMatch(page, /live-construction\.css/);

  const css = readFileSync("src/app/designer-studio/designer-light.css", "utf8");
  assert.doesNotMatch(css, /newDesignerRenderMode/);

  const director = readFileSync("src/app/style-director/page.tsx", "utf8");
  assert.match(director, /StyleDirectorRealModelPreview/);
  assert.doesNotMatch(director, /<svg/);
});


test("photographic garment clips feather only inside the real cloth boundary",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/function featheredPathMask/);
  assert.match(source,/pathMasks = new Map/);
  assert.match(source,/context\.drawImage\(featheredPathMask\(path\), 0, 0\)/);
  assert.match(source,/if\(path\) context\.drawImage\(featheredPathMask\(path\),0,0\)/);
  assert.match(source,/Contrast collars\/cuffs sit directly beside skin and hands/);
  assert.match(source,/destination-in/);

  const css=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.doesNotMatch(css,/\.newDesignerConstruction\{/);
});
