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


test("photo compositor neutralizes source-template luminance before restoring folds",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/detailBrightness\?:number/);
  assert.match(source,/const detailBrightness = placement\.detailBrightness \?\? 1\.3/);
  assert.match(source,/brightness\(\$\{detailBrightness\}\)/);
  assert.match(source,/detailBrightness: template\.shirtDetailBrightness/);
  assert.match(source,/detailBrightness: template\.trouserDetailBrightness/);
  const geometry=readFileSync("src/lib/designer/photo-preview.ts","utf8");
  assert.match(geometry,/shirtDetailBrightness: 3\.05/);
  assert.match(geometry,/trouserDetailBrightness: 1\.9/);
});


test("customer final photoreal keeps the full model in frame",()=>{
  const css=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.match(css,/\.newDesignerPhotoAi\{[^}]*object-fit:contain/);
  assert.doesNotMatch(css,/\.newDesignerPhotoAi\{[^}]*object-fit:cover/);
});


test("Style Director keeps the full photographed model visible",()=>{
  const css=readFileSync("src/app/style-director/style-director.css","utf8");
  assert.match(css,/\.directorExistingModel canvas\{[^}]*object-fit:contain/);
  assert.doesNotMatch(css,/\.directorExistingModel canvas\{[^}]*object-fit:cover/);
});


test("Style Director generated photoreal also stays full-body",()=>{
  const css=readFileSync("src/app/style-director/style-director.css","utf8");
  assert.match(css,/\.lookVisual img\{[^}]*object-fit:contain/);
  assert.doesNotMatch(css,/\.lookVisual img\{[^}]*object-fit:cover/);
});


test("customer Designer exposes the selected details photo-match state without switching models",()=>{
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.match(source,/photoPreviewSupportForChoice/);
  assert.match(source,/photoMatchSummary/);
  assert.match(source,/PHOTO MATCH · MIXED/);
  assert.match(source,/selected details directly match a photographed template/);

  const css=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.match(css,/\.newDesignerPhotoMatch/);
  assert.match(css,/data-state="mixed"/);
});


test("instant photo compositor preserves selected fabric colour while borrowing studio depth",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/globalCompositeOperation = "luminosity"/);
  assert.match(source,/globalAlpha = \.82/);
  assert.match(source,/globalCompositeOperation = "multiply"[\s\S]*globalAlpha = \.16/);
  assert.match(source,/selected swatch hue\/saturation dominant/);

  const css=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.match(css,/\.newDesignerPhotoStage\{[^}]*background:#0a1726/);
  assert.match(css,/\.newDesignerPhotoAi\{[^}]*background:#0a1726/);
});
