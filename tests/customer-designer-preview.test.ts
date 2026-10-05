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

test("photo lighting normalization is panel-local inside adaptive garment masks",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/panelLightingMasks = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>/);
  assert.match(source,/function photoLightingMask\(mask\?:HTMLCanvasElement,path="",maskPrepared=false\)/);
  assert.match(source,/context\.drawImage\(maskPrepared\?mask:featherMaskInside\(mask\),0,0\)/);
  assert.match(source,/context\.globalCompositeOperation="destination-in"/);
  assert.match(source,/context\.drawImage\(featheredPathMask\(path\),0,0\)/);
  assert.match(source,/const lightingMask = photoLightingMask\(mask,path,Boolean\(placement\.maskPrepared\)\)/);
  assert.match(source,/exact photographed panel being[\s\S]*not the whole shirt or both trouser legs/);
});



test("tucked directional fabric follows photographed panel grain with stable pattern anchors",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const grain=readFileSync("src/lib/designer/photo-panel-grain.ts","utf8");
  assert.match(source,/PHOTO_TUCKED_PANEL_GRAIN_ROTATION/);
  assert.match(source,/PHOTO_TUCKED_PANEL_PATTERN_ANCHOR/);
  assert.match(source,/function fabricPatternTransform\(fabric:DesignerFabric,placement:FabricPatternPlacement,scale:number\)/);
  assert.match(source,/translate\(anchorX,anchorY\)[\s\S]*rotate\(rotation\)[\s\S]*scale\(scale\)[\s\S]*translate\(-anchorX,-anchorY\)/);
  assert.match(source,/rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION\.leftSleeve[\s\S]*anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR\.leftSleeve\.x/);
  assert.match(source,/rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION\.rightSleeve[\s\S]*anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR\.rightSleeve\.x/);
  assert.match(source,/rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION\.leftTrouser[\s\S]*anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR\.leftTrouser\.x/);
  assert.match(source,/rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION\.rightTrouser[\s\S]*anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR\.rightTrouser\.x/);
  assert.match(source,/rotationDeg:PHOTO_TUCKED_PANEL_GRAIN_ROTATION\.collar[\s\S]*anchorX:PHOTO_TUCKED_PANEL_PATTERN_ANCHOR\.collar\.x/);
  assert.match(grain,/screen-space layout anchors only[\s\S]*not tailoring or grain evidence/);
  assert.match(grain,/leftSleeve:\{x:PHOTO_TUCKED_PANEL_AXES\.leftSleeve\.topX/);
  assert.match(grain,/rightSleeve:\{x:PHOTO_TUCKED_PANEL_AXES\.rightSleeve\.topX/);
});


test("untucked photographic shirt projects fabric per torso sleeve and collar panel",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const geometry=readFileSync("src/lib/designer/photo-preview.ts","utf8");
  assert.match(geometry,/PHOTO_UNTUCKED_SHIRT_BODY_CLIP/);
  assert.match(geometry,/PHOTO_UNTUCKED_LEFT_SLEEVE_CLIP/);
  assert.match(geometry,/PHOTO_UNTUCKED_RIGHT_SLEEVE_CLIP/);
  assert.match(geometry,/PHOTO_UNTUCKED_COLLAR_CLIP/);
  assert.match(geometry,/const SHIRT_MASK = `\$\{PHOTO_UNTUCKED_SHIRT_BODY_CLIP\}/);
  assert.match(source,/PHOTO_UNTUCKED_SHIRT_GRAIN_ROTATION/);
  assert.match(source,/PHOTO_UNTUCKED_SHIRT_PATTERN_ANCHOR/);
  assert.match(source,/drawGarment\(atlas, modelPhoto, shirtImage, shirt, PHOTO_UNTUCKED_SHIRT_BODY_CLIP/);
  assert.match(source,/drawGarment\(atlas, modelPhoto, shirtImage, shirt, PHOTO_UNTUCKED_LEFT_SLEEVE_CLIP/);
  assert.match(source,/drawGarment\(atlas, modelPhoto, shirtImage, shirt, PHOTO_UNTUCKED_RIGHT_SLEEVE_CLIP/);
  assert.match(source,/drawGarment\(atlas, modelPhoto, shirtImage, shirt, PHOTO_UNTUCKED_COLLAR_CLIP/);
  assert.match(source,/directional[\s\S]*each traced arm instead of staying globally vertical/);
});

test("untucked trousers project fabric per photographed leg without seam alpha loss",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const grain=readFileSync("src/lib/designer/photo-panel-grain.ts","utf8");
  assert.match(source,/UNTUCKED_TROUSER_SEAM_X=512/);
  assert.match(source,/function splitUntuckedTrouserLegMasks\(mask:HTMLCanvasElement\)/);
  assert.match(source,/const prepared=featherMaskInside\(mask\)/);
  assert.match(source,/const rightWeight=clamp\(/);
  assert.match(source,/const leftWeight=1-rightWeight/);
  assert.match(source,/left\.data\.data\[index\+3\]=Math\.round\(alpha\*leftWeight\)/);
  assert.match(source,/right\.data\.data\[index\+3\]=Math\.round\(alpha\*rightWeight\)/);
  assert.match(source,/const trouserLegMasks=splitUntuckedTrouserLegMasks\(trouserMask\)/);
  assert.match(source,/const trouserGeometry=templateKey==="wide"\?"wide":"pleated"/);
  assert.match(source,/maskPrepared:true[\s\S]*PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION\[trouserGeometry\]\.leftTrouser/);
  assert.match(source,/maskPrepared:true[\s\S]*PHOTO_UNTUCKED_TROUSER_GRAIN_ROTATION\[trouserGeometry\]\.rightTrouser/);
  assert.match(source,/PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR\[trouserGeometry\]\.leftTrouser/);
  assert.match(source,/PHOTO_UNTUCKED_TROUSER_PATTERN_ANCHOR\[trouserGeometry\]\.rightTrouser/);
  assert.match(grain,/PHOTO_UNTUCKED_TROUSER_PANEL_AXES/);
  assert.match(grain,/visual projection geometry only/);
});

test("photo compositor removes source-template detail brightness calibration",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const geometry=readFileSync("src/lib/designer/photo-preview.ts","utf8");
  assert.doesNotMatch(source,/detailBrightness/);
  assert.doesNotMatch(geometry,/DetailBrightness/);
  assert.match(source,/Direct source-photo detail blending/);
  assert.match(source,/colour-neutral multi-band relief map/);
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


test("photo compositor restores garment-local colour-neutral photographic relief",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/photographicReliefMaps = new WeakMap<HTMLImageElement, Map<HTMLCanvasElement \| null, HTMLCanvasElement>>/);
  assert.match(source,/function photographicReliefMap\(photo: HTMLImageElement, garmentMask\?: HTMLCanvasElement\)/);
  assert.match(source,/preventing neck\/skin\/background values[\s\S]*false edge halos inside the cloth/);
  assert.match(source,/const garmentMean = weightedGarmentLuminanceMean\(original\.data, maskPixels\.data\)/);
  assert.match(source,/maskedPhotographicLuminance\(original\.data\[index\],garmentMean,maskPixels\.data\[index\+3\]\)/);
  assert.match(source,/blurContext\.drawImage\(source, 0, 0, reliefWidth, reliefHeight\)/);
  assert.match(source,/broadContext\.drawImage\(source, 0, 0, reliefWidth, reliefHeight\)/);
  assert.match(source,/const microDetail = localSource\.data\[index\] - soft\.data\[index\]/);
  assert.match(source,/const foldDetail = soft\.data\[index\] - broadPixels\.data\[index\]/);
  assert.match(source,/128 \+ microDetail \* 1\.8 \+ foldDetail \* 1\.15/);
  assert.match(source,/const relief = photographicReliefMap\(photo, lightingMask\)/);
  assert.match(source,/const relief = photographicReliefMap\(photo, detailMask\)/);
  assert.match(source,/globalCompositeOperation = "soft-light"[\s\S]*globalAlpha = \.7[\s\S]*drawImage\(relief, 0, 0, WIDTH, HEIGHT\)/);
  assert.match(source,/globalCompositeOperation = "overlay"[\s\S]*globalAlpha = \.14[\s\S]*drawImage\(relief, 0, 0, WIDTH, HEIGHT\)/);
});


test("instant photo compositor normalizes source albedo before borrowing studio depth",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/photographicShapeMaps = new WeakMap/);
  assert.match(source,/function photographicShapeMap\(photo: HTMLImageElement, garmentMask\?: HTMLCanvasElement\)/);
  assert.match(source,/blur\(5px\)/);
  assert.match(source,/weightedGarmentLuminanceMean\(original\.data, maskPixels\.data\)/);
  assert.match(source,/neutralizePhotographicLuminance\(input\.data\[index\], garmentMean\)/);
  assert.match(source,/const lightingMask = photoLightingMask\(mask,path,Boolean\(placement\.maskPrepared\)\)/);
  assert.match(source,/globalCompositeOperation = "soft-light"[\s\S]*globalAlpha = \.9[\s\S]*drawImage\(shape, 0, 0, WIDTH, HEIGHT\)/);
  assert.match(source,/globalCompositeOperation = "multiply"[\s\S]*globalAlpha = \.07[\s\S]*drawImage\(shape, 0, 0, WIDTH, HEIGHT\)/);
  assert.match(source,/selected Linen Earth cloth/);
  assert.doesNotMatch(source,/context\.globalAlpha = \.82/);

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


test("contrast collar and cuff shading reuses baseline-neutral photo structure",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/function drawWhiteDetail[\s\S]*const detailMask = featheredPathMask\(path\)/);
  assert.match(source,/function drawWhiteDetail[\s\S]*photographicShapeMap\(photo, detailMask\)/);
  assert.match(source,/function drawWhiteDetail[\s\S]*const relief = photographicReliefMap\(photo, detailMask\)/);
  assert.match(source,/function drawWhiteDetail[\s\S]*globalAlpha = \.42[\s\S]*drawImage\(shape, 0, 0, WIDTH, HEIGHT\)/);
  const whiteBlock=source.slice(source.indexOf("function drawWhiteDetail"),source.indexOf("export type PhotoPreviewCalibration"));
  assert.doesNotMatch(whiteBlock,/globalCompositeOperation = "luminosity"/);
  assert.doesNotMatch(whiteBlock,/drawImage\(photo, 0, 0, WIDTH, HEIGHT\)/);
  assert.doesNotMatch(whiteBlock,/brightness\(/);
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
  assert.match(preview,/onPreviewReadyRef\.current\(serializeLockedPreview\(canvas\),resolvedCalibrationIdentity\)/);
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
  assert.match(preview,/setShowCreativeAi\(false\);[\s\S]*const check=await inspectSelectedLook\(cachedResult,"front",request\);[\s\S]*check\?\.available && check\.status==="pass"/);
  assert.match(preview,/Final selected-look renders stay behind QA until fidelity passes/);
  assert.match(preview,/setShowCreativeAi\(Boolean\(creativeDirection\)\)/);
  assert.match(preview,/setSelectedRepairCount\(1\);[\s\S]*setShowCreativeAi\(false\);[\s\S]*repairCheck\?\.available && repairCheck\.status==="pass"/);
  assert.match(preview,/const check=await inspectSelectedLook\(data\.result,view,request\);[\s\S]*check\?\.available && check\.status==="pass"\) setPhotorealView\(view\)/);
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

  assert.match(preview,/lockedPreviewImage=serializeLockedPreview\(canvasRef\.current\)/);
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
  assert.match(preview,/const recheck=await inspectSelectedLook\(existing,view,request\)/);
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

  assert.match(preview,/serializeLockedPreview\(canvasRef\.current\)/);
  assert.match(preview,/lockedPreviewImage/);
  assert.match(route,/lockedPreviewImage:typeof body\.lockedPreviewImage==="string"/);
  assert.match(preview,/LOCKED_PREVIEW_MIME="image\/webp"/);
  assert.match(preview,/LOCKED_PREVIEW_QUALITY=\.96/);
  assert.match(ai,/LOCKED_PREVIEW_DATA_URI/);
  assert.match(ai,/LOCKED_PREVIEW_MAX_BYTES=4_500_000/);
  assert.match(ai,/\.webp\(\{quality:96,nearLossless:true,smartSubsample:true\}\)/);
  assert.match(ai,/data:image\/webp;base64/);
  assert.match(ai,/output_format: "png"/);
  assert.doesNotMatch(ai,/aspect_ratio: "4:5"/);
  assert.doesNotMatch(ai,/\.jpeg\(\{quality:92,chromaSubsampling:"4:4:4"\}\)/);
  assert.match(ai,/metadata\.width!==1024 \|\| metadata\.height!==1536/);
  assert.match(ai,/LOCKED_PREVIEW_IDENTITY_BOXES/);
  assert.match(ai,/average>\.16 \|\| maximum>\.28/);
  assert.match(ai,/usedLockedPreview\?"selected-look-locked-preview":"selected-look"/);
  assert.match(ai,/deterministic locked live preview/);
  assert.match(ai,/async function selectedLookGarmentEditMask/);
  assert.match(ai,/PHOTO_TUCKED_SHIRT_CLIP/);
  assert.match(ai,/PHOTO_TUCKED_TROUSER_CLIP/);
  assert.match(ai,/photoTemplateForStyle\(style\)/);
  assert.match(ai,/<rect width="1024" height="1536" fill="#000"\/>/);
  assert.match(ai,/<path d="\$\{shirtPath\}" fill="#fff"\/>/);
  assert.match(ai,/<path d="\$\{trouserPath\}" fill="#fff"\/>/);
  assert.match(ai,/mask,/);
  assert.match(ai,/selectedLookGarmentEditMask\(input\.style\)/);
  assert.match(ai,/runEdit\(source,selectedLookPrompt\(input,usedLockedPreview\),context,garmentMask\)/);
  assert.match(cache,/linen-final-render-cache-v3-locked-studio-model/);
  assert.match(cache,/modelIdentity:LINEN_EARTH_MODEL_IDENTITY_ID/);
  assert.match(cache,/function lockedPreviewIdentity/);
  assert.match(cache,/createHash\("sha256"\)\.update\(raw\)\.digest\("hex"\)/);
  assert.match(cache,/lockedPreview:view==="front"\?lockedPreviewIdentity\(input\.lockedPreviewImage\):""/);
});
