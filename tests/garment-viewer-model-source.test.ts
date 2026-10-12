import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("unverified configured GLB never masquerades as the real studio model",()=>{
  const page=readFileSync("src/app/lab/garment-viewer/page.tsx","utf8");
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert.match(page,/approvedModelSrc=production\.assetReady\s*\?/);
  assert.match(page,/candidateModelSrc=!production\.assetReady/);
  assert.match(page,/production\.model\?\.placeholderGeometry/);
  assert.match(page,/modelManifestSrc=previewModelSrc\s*\?/);
  assert.match(viewer,/PROTOTYPE GEOMETRY · NOT THE STUDIO MODEL/);
  assert.match(viewer,/ENGINEERING CANDIDATE · NOT APPROVED STUDIO MODEL/);
  assert.match(viewer,/modelSrc&&assetIdentity/);
});

test("realistic model source plan stays aligned with the production GarmentViewer contract",()=>{
  const plan=readFileSync("docs/REALISTIC_MODEL_SOURCE_PLAN.md","utf8");
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8","utf8");
  for(const token of [
    "Blender Human Base Meshes",
    "MakeHuman / MPFB",
    "ShirtTorsoFabric",
    "TrouserLegRFabric",
    "1727 mm",
    "npm run garment:model-check",
  ]) assert(plan.includes(token),token);
  for(const token of [
    "LinenEarthExport",
    "REFERENCE_HEIGHT_M = 1.727",
    "ShirtTorsoFabric",
    "TrouserLegRFabric",
    "export_scene.gltf",
    "export_format=\"GLB\"",
    "load_panel_spec",
    "scene_source_provenance",
    "write_viewer_manifest",
    "--panel-spec",
  ]) assert(exporter.includes(token),token);
});

test("Blender exporter cannot bypass the production scene preflight",()=>{
  const source=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  for(const token of [
    "run_scene_preflight",
    "preflight-linen-earth-officewear.py",
    "runpy.run_path",
    "Production scene preflight failed; export is blocked",
  ]) assert(source.includes(token),`missing exporter preflight token: ${token}`);
});

test("Blender exporter refuses silent body scaling and requires garment UVs",()=>{
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  assert(exporter.includes("Adjust the body intentionally before export rather than auto-scaling"));
  assert(exporter.includes("needs a UV map before export"));
  assert(exporter.includes("obj.data.materials.clear()"));
});

test("Blender base source bootstrap stays pinned, licensed and non-promotional",()=>{
  const bootstrap=readFileSync("scripts/blender/bootstrap-human-base-meshes.py","utf8");
  const packageJson=readFileSync("package.json","utf8","utf8");
  for(const token of [
    'BUNDLE_VERSION = "1.4.1"',
    'BUNDLE_LICENSE = "CC0"',
    "human-base-meshes-bundle-v1.4.1.zip",
    "EXPECTED_ARCHIVE_BYTES = 50_643_039",
    "safe_extract",
    "source-library-only-not-production-model",
  ]) assert(bootstrap.includes(token),token);
  assert(packageJson.includes('"garment:model-base:fetch"'));
});

test("realistic body intake is explicit, licensed and does not fake garment geometry",()=>{
  const prepare=readFileSync("scripts/blender/prepare-linen-earth-body.py","utf8","utf8");
  for(const token of [
    'TARGET_HEIGHT_M = 1.727',
    'SOURCE_VERSION = "1.4.1"',
    'SOURCE_LICENSE = "CC0"',
    "discover_candidate",
    "normalize_height",
    "linen_earth_asset_status",
    "body-source-prepared-garments-required",
    "No production GLB has been approved",
  ]) assert(prepare.includes(token),token);
  assert(!prepare.includes("ShirtTorsoFabric"),"Body intake must not invent garment meshes.");
});

test("realistic-body garment authoring creates the six canonical production shells without claiming tailor approval",()=>{
  const packageJson=JSON.parse(readFileSync("package.json","utf8"));
  const source=readFileSync("scripts/blender/author-linen-earth-officewear.py","utf8");
  assert.match(packageJson.scripts["garment:model-garments:author"],/author-linen-earth-officewear\.py/);
  for(const token of [
    "ShirtTorsoFabric",
    "ShirtSleeveLFabric",
    "ShirtSleeveRFabric",
    "TrouserWaistFabric",
    "TrouserLegLFabric",
    "TrouserLegRFabric",
    "NEAREST_SURFACEPOINT",
    "OUTSIDE_SURFACE",
    "CORRECTIVE_SMOOTH",
    "SOLIDIFY",
    "planar_grain_uv",
    "auto-authored-production-candidate-needs-tailor-review",
  ]) assert(source.includes(token),token);
});

test("production 3D export command runs Blender export and structural validation in one path",()=>{
  const packageJson=JSON.parse(readFileSync("package.json","utf8"));
  const source=readFileSync("scripts/build-production-garment-model.mjs","utf8");
  assert.equal(packageJson.scripts["garment:model-production:export"],"node scripts/build-production-garment-model.mjs");
  for(const token of [
    "LINEN_GARMENT_BLEND",
    "LINEN_GARMENT_PANEL_SPEC",
    "LINEN_GARMENT_OUTPUT",
    "export-linen-earth-officewear.py",
    "check-garment-viewer-model.mjs",
    "Customer promotion still requires physical scale, latency, realism and boundary evidence",
  ]) assert(source.includes(token),token);
});

test("panel spec template cannot pass as guessed production scale",()=>{
  const template=JSON.parse(readFileSync("docs/examples/linen-earth-officewear-panel-spec.template.json","utf8"));
  assert.equal(template.status,"TEMPLATE_REPLACE_ZERO_VALUES_WITH_MEASURED_PATTERN_DIMENSIONS");
  for(const panel of Object.values(template.panels) as Array<{widthMm:number;heightMm:number}>){
    assert.equal(panel.widthMm,0);
    assert.equal(panel.heightMm,0);
  }
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  assert(exporter.includes("widthMm must be a measured value between 0 and 2000 mm"));
  assert(exporter.includes("heightMm must be a measured value between 0 and 2500 mm"));
});

test("Blender scene preflight rejects garment/body boundary intersections",()=>{
  const source=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  for(const token of [
    "BVHTree",
    "intersection_pair_count",
    "bodyShirtTorso",
    "bodyTrouserWaist",
    "shirtTrouserTuck",
    "boundaryIntersections",
  ]) assert(source.includes(token),`missing boundary QA token: ${token}`);
});

test("Blender scene preflight verifies canonical identity guide geometry",()=>{
  const source=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  for(const token of [
    "identityGuideMeasurementsMm",
    "guide_length_mm",
    "guide_center",
    "LE_GUIDE_OUTER_ARM_SILHOUETTE",
    "handCenterSpacing",
    "legCenterSpacing",
    "shirtCenterOffsetMm",
    "trouserCenterOffsetMm",
    "hemWidthAsymmetryMm",
    "legCenterSpacingMm",
    "sleeveCenterSpacingMm",
    "cuffWidthAsymmetryMm",
    "center_x_at_z",
    "must remain non-rendering",
  ]) assert(source.includes(token),`missing guide QA token: ${token}`);
});

test("Blender scene preflight catches structural garment quality risks without requiring watertight clothing",()=>{
  const preflight=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8","utf8");
  for(const token of [
    "linen-earth-officewear-scene-preflight-v1",
    "evaluated_mesh_stats",
    "degenerateFaces",
    "activeUv",
    "transformApplied",
    "MAX_TOTAL_TRIANGLES = 220_000",
    "MAX_TOTAL_VERTICES = 280_000",
    "Apply transforms before measuring panels or exporting",
  ]) assert(preflight.includes(token),token);
  assert(!preflight.includes("non_manifold"),"Tailored garment openings must not be rejected as if clothing were watertight.");
});


test("canonical Real Model Designer identity is one four-view turntable contract",()=>{
  const identity=JSON.parse(readFileSync("public/model-identity/linen-earth-studio-model-v1.json","utf8"));
  assert.equal(identity.version,"linen-earth-studio-model-v1");
  assert.equal(identity.referenceImage,"/designer/studio-tucked.webp");
  assert.equal(identity.referenceHeightMm,1727);
  assert.deepEqual(identity.views.map((view:{id:string})=>view.id),["front","three-quarter","side","back"]);
  assert.deepEqual(identity.views.map((view:{yawDeg:number})=>view.yawDeg),[0,35,90,180]);
  assert.equal(identity.frontSilhouetteAnchors.shirtShoulder.leftPx,351);
  assert.equal(identity.frontSilhouetteAnchors.shirtShoulder.rightPx,669);
});

test("Blender body, preflight and exporter all carry the same locked model identity",()=>{
  const prepare=readFileSync("scripts/blender/prepare-linen-earth-body.py","utf8");
  const preflight=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  for(const source of [prepare,preflight,exporter]){
    assert(source.includes('MODEL_IDENTITY_ID = "linen-earth-studio-model-v1"'));
    assert(source.includes('MODEL_REFERENCE_IMAGE = "/designer/studio-tucked.webp"'));
  }
  assert(prepare.includes("linen_earth_model_identity_locked"));
  assert(preflight.includes("Model identity lock is not enabled"));
  assert(exporter.includes("scene_model_identity"));
  assert(exporter.includes('"modelIdentity": model_identity'));
});


test("opaque garment alternatives use binary alpha cutouts instead of blending hundreds of shells",()=>{
  const exporter=readFileSync("scripts/build-garment-viewer-model.mjs","utf8");
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert.equal(exporter.split('alphaMode:"MASK",alphaCutoff:.5,').length-1,4);
  assert(!exporter.includes('alphaMode:"BLEND"'));
  assert(exporter.includes('baseColorFactor:[1,1,1,0]'));
  assert(exporter.includes('baseColorFactor:[1,1,1,1]'));
  assert(viewer.includes('visible?1:0'));
  assert(viewer.includes('material?.pbrMetallicRoughness.setBaseColorFactor'));
  // Material-cutout optimization cannot touch model identity or measured fabric.
  assert(exporter.includes('MODEL_ID="LE-OFFICEWEAR-V1"'));
  assert(exporter.includes('const garmentPanels=['));
});
