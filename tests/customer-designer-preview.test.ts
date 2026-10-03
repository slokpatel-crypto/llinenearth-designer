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


test("photo compositor removes per-template brightness tuning before restoring folds",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const geometry=readFileSync("src/lib/designer/photo-preview.ts","utf8");
  assert.match(source,/photographicShapeMap\(photo, lightingMask\)/);
  assert.match(source,/photographicFoldMap\(photo\)/);
  assert.doesNotMatch(source,/detailBrightness/);
  assert.doesNotMatch(source,/brightness\(\$\{detailBrightness\}\)/);
  assert.doesNotMatch(geometry,/shirtDetailBrightness|trouserDetailBrightness/);
  assert.match(geometry,/no template[\s\S]*brightness multiplier is allowed to stand in for physical cloth evidence/);
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


test("photo compositor restores colour-neutral photographic micro-relief",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/photographicReliefMaps = new WeakMap/);
  assert.match(source,/function photographicReliefMap\(photo: HTMLImageElement\)/);
  assert.match(source,/Working at half resolution keeps the first preview fast/);
  assert.match(source,/128 \+ \(luminance - blurredLuminance\) \* 1\.8/);
  assert.match(source,/const relief = photographicReliefMap\(photo\)/);
  assert.match(source,/globalCompositeOperation = "soft-light"[\s\S]*globalAlpha = \.24[\s\S]*drawImage\(relief, 0, 0, WIDTH, HEIGHT\)/);
  assert.match(source,/drawImage\(photographicReliefMap\(photo\), 0, 0, WIDTH, HEIGHT\)/);
});


test("instant photo compositor uses garment-local neutral multiband studio depth",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/photographicShapeMaps = new WeakMap/);
  assert.match(source,/photographicFoldMaps = new WeakMap/);
  assert.match(source,/function photographicShapeMap\(photo: HTMLImageElement, garmentMask\?: HTMLCanvasElement\)/);
  assert.match(source,/function photographicFoldMap\(photo: HTMLImageElement\)/);
  assert.match(source,/grayscale\(1\) blur\(7px\)/);
  assert.match(source,/grayscale\(1\) blur\(1\.25px\)/);
  assert.match(source,/grayscale\(1\) blur\(12px\)/);
  assert.match(source,/weightedGarmentLuminanceMean\(input\.data, maskPixels\.data\)/);
  assert.match(source,/neutralizePhotographicLuminance\(input\.data\[index\], garmentMean\)/);
  assert.match(source,/neutralizePhotographicBandDifference\([\s\S]*finePixels\.data\[index\][\s\S]*broadPixels\.data\[index\][\s\S]*1\.42/);
  assert.match(source,/const lightingMask = mask \?\? \(path \? featheredPathMask\(path\) : undefined\)/);
  assert.match(source,/globalAlpha = \.58[\s\S]*drawImage\(shape, 0, 0, WIDTH, HEIGHT\)/);
  assert.match(source,/globalAlpha = \.34[\s\S]*drawImage\(folds, 0, 0, WIDTH, HEIGHT\)/);
  assert.match(source,/globalCompositeOperation = "overlay"[\s\S]*globalAlpha = \.07[\s\S]*drawImage\(folds, 0, 0, WIDTH, HEIGHT\)/);
  assert.match(source,/selected swatch remains the colour\/value authority/);
  assert.doesNotMatch(source,/context\.globalAlpha = \.82/);
  assert.doesNotMatch(source,/contrast\(1\.18\).*drawImage\(photo/);

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


test("contrast collar and cuff shading uses the same neutral multiband stack",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/function drawWhiteDetail[\s\S]*const detailMask = featheredPathMask\(path\)/);
  assert.match(source,/function drawWhiteDetail[\s\S]*photographicShapeMap\(photo, detailMask\)/);
  assert.match(source,/function drawWhiteDetail[\s\S]*const folds = photographicFoldMap\(photo\)/);
  assert.match(source,/function drawWhiteDetail[\s\S]*globalAlpha = \.42[\s\S]*drawImage\(shape, 0, 0, WIDTH, HEIGHT\)/);
  assert.match(source,/function drawWhiteDetail[\s\S]*globalAlpha = \.28[\s\S]*drawImage\(folds, 0, 0, WIDTH, HEIGHT\)/);
  const whiteBlock=source.slice(source.indexOf("function drawWhiteDetail"),source.indexOf("export type PhotoPreviewCalibration"));
  assert.doesNotMatch(whiteBlock,/globalCompositeOperation = "luminosity"/);
  assert.doesNotMatch(whiteBlock,/drawImage\(photo, 0, 0, WIDTH, HEIGHT\)/);
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


test("Style Director photoreal uses the same locked real-model preview instead of a flat source",()=>{
  const page=readFileSync("src/app/style-director/page.tsx","utf8");
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const css=readFileSync("src/app/style-director/style-director.css","utf8");
  assert.match(page,/visualizePhotoreal/);
  assert.match(page,/\/api\/designer\/look-render/);
  assert.match(page,/lockedPreviewImage:lockedPreviewImage \|\| undefined/);
  assert.match(page,/onPreviewReady=\{acceptLockedPreview\}/);
  assert.match(page,/Preparing real model…/);
  assert.match(page,/Photoreal unlocks when a photographed garment template supports this category/);
  assert.match(preview,/onPreviewReady\?:\(dataUrl:string,calibrationIdentity:string\)=>void/);
  assert.match(preview,/onPreviewReadyRef\.current\(canvas\.toDataURL\("image\/jpeg",\.92\),resolvedCalibrationIdentity\)/);
  assert.match(css,/\.directorPhotoPending/);
  assert.doesNotMatch(page,/\/api\/visualization\/fashn/);
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


test("selected-look photoreal stays hidden until automated fidelity QA passes",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(preview,/Promise<SelectedLookVisualCheck\|null>/);
  assert.match(preview,/setShowCreativeAi\(false\);[\s\S]*const check=await inspectSelectedLook\(cachedResult\);[\s\S]*check\?\.available && check\.status==="pass"/);
  assert.match(preview,/Final selected-look renders stay behind QA until fidelity passes/);
  assert.match(preview,/setShowCreativeAi\(Boolean\(creativeDirection\)\)/);
  assert.match(preview,/setSelectedRepairCount\(1\);[\s\S]*setShowCreativeAi\(false\);[\s\S]*repairCheck\?\.available && repairCheck\.status==="pass"/);
  assert.match(preview,/const check=await inspectSelectedLook\(data\.result,view\);[\s\S]*check\?\.available && check\.status==="pass"\) setPhotorealView\(view\)/);
  assert.match(preview,/The render has not cleared customer-facing fidelity QA/);
});


test("customer-facing photoreal fails closed to the trusted instant preview when QA requests review",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const css=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.match(preview,/if\(!data\.check\.available \|\| data\.check\.status==="review"\) setShowCreativeAi\(false\)/);
  assert.match(preview,/if\(!data\.check\.available \|\| data\.check\.status==="review"\) setPhotorealView\("front"\)/);
  assert.match(preview,/PHOTOREAL HELD FOR REVIEW/);
  assert.match(preview,/Review photoreal/);
  assert.match(preview,/generated result available for human review\/repair/);
  assert.match(css,/\.newDesignerPhotoQaHold/);
});


test("server binds secondary generation to the exact front image that passed QA",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const renderRoute=readFileSync("src/app/api/designer/look-render/route.ts","utf8");
  const inspectRoute=readFileSync("src/app/api/designer/look-inspect/route.ts","utf8");
  const outcomes=readFileSync("src/lib/designer/render-outcomes.ts","utf8");

  assert.match(preview,/frontJobId:creativeAi\.jobId/);
  assert.match(renderRoute,/frontJobId\?:string/);
  assert.match(renderRoute,/approvedFrontRenderEvidence/);
  assert.match(renderRoute,/Front photoreal must pass server-verified fidelity QA before generating another view/);
  assert.match(inspectRoute,/inspectedImageSha256:renderImageIdentity\(image\)/);
  assert.match(outcomes,/export function renderImageIdentity/);
  assert.match(outcomes,/row\.qa_status!=="pass"/);
  assert.match(outcomes,/row\.shirt_id!==input\.shirtId \|\| row\.pant_id!==input\.pantId/);
  assert.match(outcomes,/payload\?\.inspectedImageSha256===imageIdentity/);
});


test("targeted front repair replaces stale memory and durable cache identity",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const renderRoute=readFileSync("src/app/api/designer/look-render/route.ts","utf8");
  const ai=readFileSync("src/lib/ai-visualization.ts","utf8");

  assert.match(preview,/lockedPreviewImage=canvasRef\.current\.toDataURL\("image\/jpeg",\.92\)/);
  assert.match(preview,/selectedLookSessionCache\.set\([\s\S]*renderSignature,[\s\S]*repairCheck\?\.available/);
  assert.match(renderRoute,/repairSelectedLookFashnFront[\s\S]*storeDurableSelectedLookRender\(input,result,"front"\)/);
  assert.match(ai,/A repair replaces the stale in-memory front result/);
  assert.match(ai,/storeSelectedRender\(input,result\)/);
});


test("cached renders are backfilled into outcome evidence before QA attachment",()=>{
  const renderRoute=readFileSync("src/app/api/designer/look-render/route.ts","utf8");
  assert.match(renderRoute,/if\(memoryCached\) \{[\s\S]*recordRenderOutcome\(\{result:memoryCached,view:"front"/);
  assert.match(renderRoute,/if\(durableCached\) \{[\s\S]*recordRenderOutcome\(\{result:durableCached,view:"front"/);
  assert.match(renderRoute,/recordRenderOutcome\(\{result:durableCached,view,shirtId:input\.shirt\.id,pantId:input\.pant\.id\}\)/);
});


test("existing secondary views require their own fidelity state before normal display",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(preview,/const existingCheck=existing\.selectedCheck/);
  assert.match(preview,/existingCheck\?\.available && existingCheck\.status==="pass"/);
  assert.match(preview,/existingCheck\?\.available && existingCheck\.status==="review"/);
  assert.match(preview,/const recheck=await inspectSelectedLook\(existing,view\)/);
  assert.match(preview,/This view has not cleared fidelity QA/);
  assert.match(preview,/const ownReview=view!=="front"/);
  assert.match(preview,/const ownUnchecked=view!=="front"/);
  assert.match(preview,/"Review "\+baseLabel/);
  assert.match(preview,/"Recheck "\+baseLabel/);
});


test("secondary photoreal views cannot spend credits until front fidelity QA passes",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(preview,/const frontCheck=creativeAi\.selectedCheck/);
  assert.match(preview,/if\(!frontCheck\?\.available \|\| frontCheck\.status!=="pass"\)/);
  assert.match(preview,/Front photoreal must pass fidelity QA before generating another view/);
  assert.match(preview,/Never spend another generation credit or propagate identity/);
  assert.match(preview,/const frontQaReady=Boolean\(creativeAi\.selectedCheck\?\.available && creativeAi\.selectedCheck\.status==="pass"\)/);
  assert.match(preview,/const frontBlocked=view!=="front" && !frontQaReady/);
  assert.match(preview,/Front QA first/);
});


test("identical session-cached photoreal reuses completed QA without reinspection",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(preview,/if\(!creativeDirection && data\.check\.available\)/);
  assert.match(preview,/selectedLookSessionCache\.set\(renderSignature,\{\.\.\.cached,selectedCheck:data\.check\}\)/);
  assert.match(preview,/setShowCreativeAi\(Boolean\(cached\.selectedCheck\?\.available && cached\.selectedCheck\.status==="pass"\)\)/);
  assert.match(preview,/if\(!cached\.selectedCheck\?\.available\) \{/);
  assert.match(preview,/retrying later when QA was temporarily unavailable/);
});


test("Save never exports an unapproved selected-look photoreal",()=>{
  const preview=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(preview,/const selectedPhotorealApproved=Boolean\(/);
  assert.match(preview,/activeSelectedCheck\?\.available && activeSelectedCheck\.status==="pass"/);
  assert.match(preview,/if\(showCreativeAi && creativeAi && selectedPhotorealApproved\)/);
  assert.match(preview,/silently become the saved design asset before fidelity QA passes/);
  assert.match(preview,/Save trusted preview/);
  assert.match(preview,/trusted instant studio preview remains the save\/export source until QA passes/);
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
