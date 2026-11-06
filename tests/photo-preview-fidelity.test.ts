import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { DesignerStyle } from "../src/lib/designer/engine.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";
import { photoConstructionMismatches } from "../src/lib/designer/photo-preview-fidelity.ts";

const baseStyle: DesignerStyle = {
  collar: "Point (Standard) Collar",
  collarFinish: "Self-fabric",
  cuff: "Barrel Cuff (1-button)",
  placket: "Standard (visible stitch)",
  shirtFit: "Regular / Classic Fit",
  shirtWear: "Tucked",
  trouser: "Pleated Trouser",
  rise: "Mid Rise",
  waistband: "Belt Loops",
  break: "Slight Break",
  button: "Plastic / Resin",
};
const baseSpec: StyleSpecV2 = {
  styleSchemaVersion: 2,
  shirt: {
    type: "dress_shirt",
    collar: "point_standard_collar",
    collarFinish: "Self-fabric",
    cuff: "barrel_cuff_1_button",
    placket: "standard_visible_placket",
    pocket: "no_pocket",
    sleeve: "full_sleeve",
    fit: "regular_classic_fit",
    length: "shirt_length_tuck",
    hem: "curved_shirttail",
    back: "plain_back",
    wear: "tucked",
    button: "plastic_resin",
  },
  pant: {
    type: "pleated_trouser",
    fit: "pleated_straight",
    rise: "mid_rise",
    pleat: "single_pleat_forward",
    waistband: "belt_loops",
    hem: "plain_hem",
    break: "slight_break",
  },
  legacy: baseStyle,
};
const fields = (style: DesignerStyle, spec?: StyleSpecV2) =>
  photoConstructionMismatches(style, spec).map((gap) => gap.field);

test("photographed point collar, cuff, standard placket and tucked pleat baseline have no construction mismatch", () => {
  assert.deepEqual(fields(baseStyle, baseSpec), []);
});

test("selected collar, cuff and hidden placket are not described as photo geometry", () => {
  const style = {...baseStyle, collar: "Spread Collar", cuff: "French / Double Cuff", placket: "Hidden Placket"};
  const actual = fields(style);
  assert.deepEqual(actual.filter((x)=>x.startsWith("shirt.")), ["shirt.collar", "shirt.cuff", "shirt.placket"]);
});

test("advanced v2 collar and short sleeve are reported even when legacy photographic labels stay unchanged", () => {
  const spec:StyleSpecV2 = {...baseSpec, shirt:{...baseSpec.shirt,collar:"cuban_camp_collar",sleeve:"half_sleeve",cuff:"open_short_hem_cuff"}};
  assert.deepEqual(fields(baseStyle,spec).filter((x)=>x.startsWith("shirt.")),["shirt.collar","shirt.cuff","shirt.sleeve"]);
});

test("default untucked straight construction does not silently claim the pictured curved shirt hem matches", () => {
  const style:DesignerStyle={...baseStyle,shirtWear:"Untucked"};
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,wear:"untucked",length:"shirt_length_regular",hem:"straight_flat_hem"},legacy:style};
  assert.ok(fields(style,spec).includes("shirt.hem"));
  assert.equal(fields(style,{...spec,shirt:{...spec.shirt,hem:"curved_shirttail"}}).includes("shirt.hem"),false);
});

test("untucked wide source matches wide silhouette but not a flat-front v2 pleat", () => {
  const style:DesignerStyle={...baseStyle,shirtWear:"Untucked",trouser:"Wide-leg / Relaxed Drape Trouser",break:"Full Break"};
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,wear:"untucked",length:"shirt_length_regular"},pant:{...baseSpec.pant,type:"wide_leg_relaxed_drape",fit:"wide_leg_drape",pleat:"flat_front",break:"full_break"},legacy:style};
  const gaps=fields(style,spec);
  assert.ok(gaps.includes("pant.pleat"));
  assert.equal(gaps.includes("pant.type"),false);
  assert.equal(gaps.includes("pant.fit"),false);
});

test("tucked wide leg is explicitly a straight-leg photo mismatch", () => {
  const style:DesignerStyle={...baseStyle,trouser:"Wide-leg / Relaxed Drape Trouser"};
  const gaps=photoConstructionMismatches(style);
  assert.ok(gaps.some((row)=>row.field==="pant.type" && /tucked straight-leg photograph/i.test(row.reason)));
});

test("advanced flat front, rise and waistband cannot be claimed from tucked photograph", () => {
  const spec:StyleSpecV2={...baseSpec,pant:{...baseSpec.pant,pleat:"flat_front",rise:"high_rise",waistband:"extended_tab"}};
  assert.deepEqual(fields(baseStyle,spec),["pant.pleat","pant.rise","pant.waistband"]);
});

test("button material selections are specification-only on the original photographed model", () => {
  const style:DesignerStyle={...baseStyle,button:"Mother-of-Pearl"};
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,button:"mother_of_pearl"},legacy:style};
  const snapshot=JSON.stringify(spec);
  const rows=photoConstructionMismatches(style,spec);
  assert.ok(rows.some(row=>row.field==="shirt.button" && /specification-only/.test(row.reason)));
  assert.equal(rows.filter(row=>row.field==="shirt.button").length,1);
  assert.ok(fields(baseStyle,{...baseSpec,shirt:{...baseSpec.shirt,button:"corozo"}}).includes("shirt.button"));
  assert.ok(!fields(baseStyle,baseSpec).includes("shirt.button"));
  assert.equal(JSON.stringify(spec),snapshot);
});

test("hidden tucked shirt length and hem variations are never described as rebuilt geometry", () => {
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,length:"shirt_length_regular",hem:"straight_flat_hem"}};
  const rows=photoConstructionMismatches(baseStyle,spec);
  assert.ok(rows.some(row=>row.field==="shirt.length" && /hidden by the waistband/.test(row.reason)));
  assert.ok(rows.some(row=>row.field==="shirt.hem" && /hidden by the waistband/.test(row.reason)));
  assert.ok(!fields(baseStyle,baseSpec).includes("shirt.length"));
  assert.ok(!fields(baseStyle,baseSpec).includes("shirt.hem"));
});

test("mismatch reporting is stable and never changes versioned garment data", () => {
  const snapshot=JSON.stringify(baseSpec);
  assert.deepEqual(photoConstructionMismatches(baseStyle,baseSpec),photoConstructionMismatches(baseStyle,baseSpec));
  assert.equal(JSON.stringify(baseSpec),snapshot);
});

test("customer photographic preview displays selected construction mismatch notice",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/photoConstructionMismatches\(style,styleSpec\)/);
  assert.match(source,/data-photo-construction-mismatch/);
  assert.match(source,/not reconstructed in the fixed studio photograph/);
  assert.match(source,/FRONT \/ STUDIO MODEL · CUTS APPROX\./);
  // Construction details must be legible above the photo, away from the
  // fixed contact dock; preserve exactly one independent status for screen readers.
  const previewStart=source.lastIndexOf('return <section className="newDesignerPhoto"');
  const photoStage=source.indexOf('    <div className={`newDesignerPhotoStage',previewStart);
  const notice=source.indexOf('data-photo-construction-mismatch="true"',previewStart);
  assert.ok(previewStart>=0 && notice>previewStart && notice<photoStage);
  assert.match(source,/<div className="newDesignerPhotoConstructionNotice" data-photo-construction-mismatch="true" role="status"/);
  assert.doesNotMatch(source,/<p className="newDesignerPhotoConstructionNotice"/);
  const introEnd=source.indexOf('    </div>',previewStart);
  assert.ok(notice>introEnd,"contact-safe notice must be outside compact intro's hidden-paragraph CSS");
  const stylesheet=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.match(stylesheet,/\.newDesignerPhotoIntroCompact p\{display:none!important\}/);
  assert.equal((source.match(/data-photo-construction-mismatch="true"/g)||[]).length,1);
  assert.equal((source.match(/<p className="newDesignerPhotoApproximation"/g)||[]).length,1);
  assert.doesNotMatch(source,/<p className="newDesignerPhotoApproximation" data-photo-construction-mismatch/);
});

test("versioned wear choice cannot silently borrow the legacy tucked photograph", () => {
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,wear:"untucked",collarFinish:"White contrast collar"}};
  const rows=photoConstructionMismatches(baseStyle,spec);
  assert.ok(rows.some((x)=>x.field==="shirt.wear" && /photographed tuck mode/i.test(x.reason)));
  assert.ok(rows.some((x)=>x.field==="shirt.collarFinish"));
});

test("versioned trouser cut and break do not inherit legacy photographic support", () => {
  const spec:StyleSpecV2={...baseSpec,pant:{...baseSpec.pant,type:"formal_flat_front",break:"cropped_above_ankle"}};
  const rows=photoConstructionMismatches(baseStyle,spec);
  assert.ok(rows.some((x)=>x.field==="pant.type"));
  assert.ok(rows.some((x)=>x.field==="pant.break"));
  assert.equal(new Set(rows.map((x)=>x.field)).size,rows.length);
});

test("rear construction stays explicitly unverified in the fixed front photograph", () => {
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,back:"darts_back"}};
  const rows=photoConstructionMismatches(baseStyle,spec);
  assert.deepEqual(rows.map((x)=>x.field),["shirt.back"]);
  assert.match(rows[0].reason,/front photograph cannot verify/i);
});

test("original Compare switches to the actual selected photographic template, not a default pleated image", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/showOriginal && ready && !showCreativeAi && <img className="newDesignerPhotoOriginal" src=\{template\.src\}/);
  assert.doesNotMatch(source,/newDesignerPhotoOriginal" src=\{tucked \? template\.src : DESIGNER_PHOTO_TEMPLATES\.pleated\.src\}/);
  assert.match(source,/SOURCE \/ WIDE TROUSER PHOTO/);
  assert.match(source,/data-photo-source-comparison=\{templateId==="wide"\?"wide":"studio"\}/);
  assert.match(source,/shirt in the instant preview comes from the separate pleated studio photograph/);
});

test("photographic browser harness verifies actual customer advanced-cut and legacy controls at responsive widths", () => {
  const script=readFileSync("scripts/verify-photo-form.cjs","utf8");
  assert.match(script,/name:"Sleeve length",exact:true/);
  assert.match(script,/selectOption\("half_sleeve"\)/);
  assert.match(script,/name:"Trouser pleats",exact:true/);
  assert.match(script,/selectOption\("double_pleat_forward"\)/);
  assert.match(script,/name:"Shirt collar",exact:true/);
  assert.match(script,/name:"Shirt cuff",exact:true/);
  assert.match(script,/name:"Shirt placket",exact:true/);
  assert.match(script,/advanced-construction-disclosed-/);
  assert.match(script,/collar-cuff-placket-disclosed-1440/);
  assert.match(script,/advancedConstructionDisclosed=true/);
  assert.match(script,/newDesignerPhotoTag/);
  assert.match(script,/CUTS APPROX/);
  assert.match(script,/actualPhotoPixelHash\(page\)/);
  assert.match(script,/specOnlyPhotoPixelsUnchanged=true/);
  assert.match(script,/name:"Button material",exact:true/);
  assert.match(script,/selectOption\("Mother-of-Pearl"\)/);
  assert.match(script,/button-material-disclosed-/);
  assert.match(script,/buttonMaterialDisclosed=true/);
  assert.match(script,/construction-notice-readable-/);
  assert.match(script,/constructionNoticeUnobstructed=true/);
  assert.match(script,/floatingContactDock/);
  assert.match(script,/wide-source-compared-/);
  assert.match(script,/wideSourceComparisonVerified=true/);
  assert.match(script,/sourceCaptionModeVerified=true/);
  assert.match(script,/sourceHeaderAndFabricLabelsVerified=true/);
  assert.match(script,/SELECTED SHIRT/);
  assert.match(script,/SELECTED TROUSER/);
  assert.match(script,/the source caption must close with Compare/);
  assert.match(script,/sourceCanvasAccessibilityIsolated=true/);
  assert.match(script,/boundaryQaSourceIsolationVerified=true/);
  assert.match(script,/boundaryQaZoomAligned=true/);
  assert.match(script,/Zoom Fit outlines must follow photographed garment scale/);
  assert.match(script,/source Compare must never inherit selected-preview garment boundary geometry/);
  assert.match(script,/Show design to save/);
  assert.match(script,/source Compare must not silently save/);
  assert.match(script,/rapidFabricSwitchStable=true/);
  assert.match(script,/newLookStartsFullView=true/);
  assert.match(script,/pendingPreviewStatusTruthful=true/);
  assert.match(script,/new look must not inherit the previous garment\'s Zoom Fit crop/);
  assert.match(script,/old canvas must be hidden while the new fabric is pending/);
  assert.match(script,/name:"Trouser shape",exact:true/);
  assert.match(script,/advanced spec-only sleeve\/pleat options must not repaint/);
});

test("fabric changes cannot leave stale canvas or source-compare imagery visible", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  // Loading another fabric must not show the previous finished canvas.
  assert.ok(source.includes('aria-busy={!ready && !error}'));
  assert.ok(source.includes('style={{visibility:ready?"visible":"hidden"}}'));
  assert.ok(source.includes('setShowOriginal(false);\n    setCreativeAi(null);'));
  assert.ok(source.includes('showOriginal && ready && !showCreativeAi && <img className="newDesignerPhotoOriginal"'));
  // The source comparison and reviewed photoreal image cannot overlay each other.
  assert.ok(source.includes('showCreativeAi && creativeAi ? `${photorealView.toUpperCase()} / PHOTOREAL` : showOriginal && ready'));
  assert.ok(source.includes('onClick={()=>{setShowOriginal(false);setShowCreativeAi((value)=>!value);}}'));
  assert.ok(source.includes('onClick={() => {setShowCreativeAi(false);setShowOriginal((value) => !value);}}'));
});

test("source comparison cannot silently export or lock a different pictured design", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.ok(source.includes('disabled={!ready || showOriginal}>{showOriginal ? "Show design to save"'));
  assert.ok(source.includes('disabled={!ready || showOriginal}>Lock final design'));
  assert.ok(source.includes('disabled={!ready || creativeAiLoading || showOriginal}>{creativeAiLoading ? "Rendering…"'));
});

test("Compare shows original-photo provenance above the canvas instead of selected-cut claims", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const start=source.lastIndexOf('return <section className="newDesignerPhoto"');
  const stage=source.indexOf('    <div className={`newDesignerPhotoStage',start);
  const sourceBanner=source.indexOf('data-photo-source-comparison={templateId==="wide"?"wide":"studio"}',start);
  assert.ok(sourceBanner>start && sourceBanner<stage,"source provenance belongs above displayed source image");
  assert.ok(source.includes('Original source photo, not your selected design'));
  assert.ok(source.includes('!showOriginal && !showCreativeAi && constructionMismatches.length>0'));
  assert.equal((source.match(/data-photo-source-comparison=/g)||[]).length,1);
  assert.ok(source.includes('Choose Show design to view your selected fabrics and cuts.'));
});


test("boundary QA belongs only to the ready deterministic garment canvas", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.ok(source.includes('showBoundaries && ready && !showOriginal && !showCreativeAi && <svg className="newDesignerBoundaryQa"'));
  assert.ok(source.includes('disabled={!ready || showOriginal || showCreativeAi} aria-pressed={showBoundaries && !showOriginal && !showCreativeAi}'));
  // Boundary outlines are derived from original garment masks and must never
  // be advertised as validated photoreal geometry or source-photo contours.
  assert.ok(source.includes('Garment boundary QA overlay'));
});


test("Zoom Fit uses the same scale and origin for the garment canvas and its QA contours", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const css=readFileSync("src/app/designer-studio/designer-light.css","utf8");
  assert.match(css,/\.newDesignerPhotoStage\.inspectFit canvas[^\n]*transform:scale\(1\.42\)/);
  assert.ok(source.includes('style={{transform:inspectFit?"scale(1.42)":"scale(1)",transformOrigin:"50% 35%",transition:"transform .28s ease"}}'));
  assert.ok(source.includes('showBoundaries && ready && !showOriginal && !showCreativeAi && <svg className="newDesignerBoundaryQa"'));
});

test("a changed look does not keep a previous photo zoom or diagnostic garment seams", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  const reset=source.slice(source.indexOf("useLayoutEffect(() => {"),source.indexOf("},[requestScope]);"));
  assert.ok(reset.includes("setInspectFit(false);"),"new selected look must start in full-view mode");
  assert.ok(reset.includes("setShowBoundaries(false);"),"new selected look must not inherit old seam QA");
  assert.ok(reset.includes("setShowOriginal(false);"),"new selected look must not inherit source comparison");
  assert.ok(reset.includes("setFinalLocked(false);"),"new selection must not retain old design lock");
});

test("the underlying deterministic image is not announced when a source/photoreal view is displayed", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.ok(source.includes('aria-hidden={!ready || showOriginal || showCreativeAi}'));
  assert.ok(source.includes('role="img" aria-hidden={!ready || showOriginal || showCreativeAi}'));
  assert.ok(source.includes('showOriginal && ready && !showCreativeAi && <img className="newDesignerPhotoOriginal"'));
});

test("preview status does not claim a rendered photograph while pending or failed", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.ok(source.includes('error ? "PREVIEW UNAVAILABLE" : !ready ? "PREPARING SELECTED LOOK"'));
  assert.ok(source.includes('aria-busy={!ready && !error}'));
  assert.ok(source.includes('style={{visibility:ready?"visible":"hidden"}}'));
});


test("source comparison caption never describes a raw photograph as the rendered garment", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.ok(source.includes('!showCreativeAi && ready && <p className="newDesignerPhotoApproximation" data-photo-caption={showOriginal?"source":"instant"}'));
  assert.ok(source.includes('<strong>Original source photograph</strong>'));
  assert.ok(source.includes('Unchanged studio reference, not the selected garment fabrics or construction.'));
  assert.ok(source.includes('Choose Show design to return to the selected look.'));
  assert.ok(source.includes('<strong>Instant preview</strong> · Studio model;'));
  assert.equal((source.match(/<p className="newDesignerPhotoApproximation"/g)||[]).length,1);
});


test("source reference header and selected-fabric labels are not mistaken for photographed clothes", () => {
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.ok(source.includes('showOriginal && ready && !showCreativeAi ? "SOURCE REFERENCE" : "LIVE PREVIEW"'));
  assert.ok(source.includes('showOriginal && !showCreativeAi ? "SELECTED SHIRT" : "SHIRT"'));
  assert.ok(source.includes('showOriginal && !showCreativeAi ? "SELECTED TROUSER" : "TROUSER"'));
  assert.ok(source.includes('Original source photo, not your selected design'));
});
