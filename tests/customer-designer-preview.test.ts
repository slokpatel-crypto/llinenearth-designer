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


test("Designer recommendation cards keep the photographic mannequin full-body",()=>{
  const css=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.match(css,/\.newDesignerBriefModel \.directorExistingModel canvas\{[^}]*object-fit:contain/);
  assert.doesNotMatch(css,/\.newDesignerBriefModel \.directorExistingModel canvas\{[^}]*object-fit:cover/);
});


test("Style Director photoreal letterbox matches the navy studio",()=>{
  const css=readFileSync("src/app/style-director/style-director.css","utf8");
  assert.match(css,/\.lookVisual img\{[^}]*object-fit:contain[^}]*background:#081827/);
  assert.doesNotMatch(css,/\.lookVisual img\{[^}]*background:#eeeae4/);
});


test("contrast collar and cuff shading stays photographic without source-colour contamination",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/function drawWhiteDetail[\s\S]*globalCompositeOperation = "luminosity"[\s\S]*globalAlpha = \.9/);
  assert.match(source,/function drawWhiteDetail[\s\S]*globalCompositeOperation = "multiply"[\s\S]*globalAlpha = \.12/);
  assert.match(source,/clean white while retaining the real folded edge beside neck and hands/);
});


test("Style Director never falls back to a simulated mannequin",()=>{
  const page=readFileSync("src/app/style-director/page.tsx","utf8");
  assert.doesNotMatch(page,/abstractLook/);
  assert.match(page,/directorFabricFallback/);
  assert.match(page,/REAL STOCK \/ PHOTO TEMPLATE PENDING/);
  assert.match(page,/Real fabric · no simulated mannequin/);
  assert.match(page,/Garment geometry stays unvisualized until a photographed template supports this category/);

  const css=readFileSync("src/app/style-director/style-director.css","utf8");
  assert.doesNotMatch(css,/\.abstractLook/);
  assert.match(css,/\.directorFabricFallback/);
});


test("Style Director no longer offers a flat alternate preview",()=>{
  const page=readFileSync("src/app/style-director/page.tsx","utf8");
  assert.match(page,/visualizePhotoreal/);
  assert.match(page,/\/api\/visualization\/fashn/);
  assert.match(page,/Make photoreal/);
  assert.doesNotMatch(page,/\/api\/visualization\/render/);
  assert.doesNotMatch(page,/Generate alternate preview/);
});


test("legacy customer design routes consolidate onto the photo-first experiences",()=>{
  const designer=readFileSync("src/app/designer/page.tsx","utf8");
  const visual=readFileSync("src/app/visual/page.tsx","utf8");
  const brief=readFileSync("src/app/designer-brief/page.tsx","utf8");
  const home=readFileSync("src/app/page.tsx","utf8");

  assert.match(designer,/redirect\("\/designer-studio"\)/);
  assert.match(visual,/redirect\("\/style-director"\)/);
  assert.match(brief,/redirect\("\/style-director"\)/);
  assert.doesNotMatch(designer,/StudioDashboard|AtelierMannequin/);
  assert.doesNotMatch(visual,/HomeVisualExplorer|OutfitStudio/);
  assert.doesNotMatch(brief,/OccasionDesignerPreview/);
  assert.doesNotMatch(home,/\/visual\?garment=(?:suit|blazer)/);
  assert.match(home,/name: "Suits"[\s\S]*href: "\/style-director"/);
  assert.match(home,/name: "Blazers"[\s\S]*href: "\/style-director"/);
});


test("legacy customer modules redirect into the consolidated experience",()=>{
  const catalog=readFileSync("src/app/catalog/page.tsx","utf8");
  const atelier=readFileSync("src/app/atelier/page.tsx","utf8");
  const designs=readFileSync("src/app/designs/page.tsx","utf8");
  const knowledge=readFileSync("src/app/knowledge/page.tsx","utf8");

  assert.match(catalog,/redirect\("\/designer-studio"\)/);
  assert.match(atelier,/redirect\("\/account"\)/);
  assert.match(designs,/redirect\("\/account"\)/);
  assert.match(knowledge,/redirect\("\/style-director"\)/);
  assert.doesNotMatch(catalog,/catalogGarments|Live Visual/);
  assert.doesNotMatch(atelier,/AtelierQueueClient/);
  assert.doesNotMatch(designs,/SavedDesignsClient/);
  assert.doesNotMatch(knowledge,/FASHION BRAIN|WearTypeVisual/);
});


test("plain linen swatches retain visible microtexture without reusing catalogue shadows",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/const plainTextureDetailGain = \.34/);
  assert.match(source,/high-frequency linen weave to avoid a flat painted-shirt look/);
  assert.match(source,/original\.data\[index \+ channel\] - blurred\[index \+ channel\]\) \* plainTextureDetailGain/);
});


test("final photoreal render is seeded from the validated locked live preview",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const route=readFileSync("src/app/api/designer/look-render/route.ts","utf8");
  const ai=readFileSync("src/lib/ai-visualization.ts","utf8");
  const cache=readFileSync("src/lib/designer/render-cache-key.ts","utf8");

  assert.match(preview,/canvasRef\.current\.toDataURL\("image\/jpeg",\.92\)/);
  assert.match(preview,/lockedPreviewImage/);
  assert.match(route,/lockedPreviewImage:typeof body\.lockedPreviewImage==="string"/);
  assert.match(ai,/LOCKED_PREVIEW_DATA_URI/);
  assert.match(ai,/LOCKED_PREVIEW_MAX_BYTES=4_500_000/);
  assert.match(ai,/metadata\.width!==1024 \|\| metadata\.height!==1536/);
  assert.match(ai,/LOCKED_PREVIEW_IDENTITY_BOXES/);
  assert.match(ai,/average>\.16 \|\| maximum>\.28/);
  assert.match(ai,/usedLockedPreview\?"selected-look-locked-preview":"selected-look"/);
  assert.match(ai,/deterministic locked live preview/);
  assert.match(cache,/linen-final-render-cache-v2-locked-preview-source/);
  assert.match(cache,/function lockedPreviewIdentity/);
  assert.match(cache,/createHash\("sha256"\)\.update\(raw\)\.digest\("hex"\)/);
  assert.match(cache,/lockedPreview:view==="front"\?lockedPreviewIdentity\(input\.lockedPreviewImage\):""/);
});
