import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

test("Blender exporter creates replaceable base-colour and linen-normal texture slots",()=>{
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  for(const token of [
    "configure_texture_ready_material",
    "LE_BASECOLOR_SLOT",
    "LE_NORMAL_SLOT",
    "LE_NORMAL_MAP",
    "LE_FABRIC_PLACEHOLDER_WHITE",
    "LE_NORMAL_PLACEHOLDER",
    "surface_render_method",
  ]) assert(exporter.includes(token),token);
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
    "center_body_xy",
    "apply_body_transforms",
    "retain_locked_body_only",
    "linen_earth_removed_auxiliary_objects_json",
    "create_identity_shoes",
    "LE_ShoeL",
    "LE_ShoeR",
    "minimal-dress-shoe-v1",
    "align_arm_stance_to_identity",
    "linen_earth_arm_stance_json",
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
    "smooth_open_boundaries",
    "import bmesh",
    "open-edge-laplacian-v1",
    "shape_officewear_to_identity",
    "scale_x_profile",
    "shift_x_profile",
    "shirtShoulderCorrection",
    "corrected_shoulder",
    "shirt_clearance_m",
    "trouser_clearance_m",
    "linen_earth_identity_fit_profile_json",
    "auto-authored-production-candidate-needs-tailor-review",
  ]) assert(source.includes(token),token);
});

test("deterministic shell and Blender production candidate are explicitly distinguished",()=>{
  const builder=readFileSync("scripts/build-garment-viewer-model.mjs","utf8");
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  const contract=readFileSync("src/lib/garment-viewer-model-contract.ts","utf8");
  assert(builder.includes("deterministic-preview-shell-not-realistic-production-asset"));
  assert(builder.includes("realistic production asset still requires Blender-source fit/evidence"));
  assert(exporter.includes("realistic-body-production-candidate"));
  assert(contract.includes('"deterministic-preview-shell-not-realistic-production-asset"|"realistic-body-production-candidate"'));
});

test("Blender preflight performs world-space collision and clearance checks",()=>{
  const source=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  for(const token of ["world_bvh","BVHTree.FromPolygons","evaluated.matrix_world","intersection_pair_count","nearest_distance_stats_mm","signed_clearance_stats_mm","world_normal_orientation_sign","penetrationSamples","maxPenetrationMm","identityShoeMeasurementsMm","LE_ShoeL","LE_ShoeR","floor contact","shirtTrouserTuck","--json-output","output.write_text"]) {
    assert(source.includes(token),token);
  }
  assert(!source.includes("BVHTree.FromObject(left"));
  assert(!source.includes("BVHTree.FromObject(target"));
});

test("Blender exporter carries fit and boundary preflight evidence into the production manifest",()=>{
  const preflight=readFileSync("scripts/blender/preflight-linen-earth-officewear.py","utf8");
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  for(const token of ["return report","boundaryClearanceMm","identityFitMeasurementsMm","boundaryIntersections"]) assert(preflight.includes(token),token);
  for(const token of ["preflight_report = run_scene_preflight()","productionFitEvidence","\"ready\": preflight_report.get(\"ready\") is True","identityFitMeasurementsMm","identityShoeMeasurementsMm","boundaryIntersections","boundaryClearanceMm"]) assert(exporter.includes(token),token);
});

test("realistic candidate creates a physical-measurement worksheet without treating geometry estimates as evidence",()=>{
  const packageJson=JSON.parse(readFileSync("package.json","utf8"));
  const source=readFileSync("scripts/blender/write-panel-measurement-worksheet.py","utf8");
  const workflow=readFileSync(".github/workflows/realistic-3d-candidate.yml","utf8");
  assert.match(packageJson.scripts["garment:model-production:measurement-worksheet"],/write-panel-measurement-worksheet\.py/);
  for(const token of [
    "WORKSHEET_ONLY_NOT_PRODUCTION_EVIDENCE",
    "geometryEstimate",
    "verifiedPhysicalMeasurement",
    "Do not copy the 3D bounding-box estimate into the production panel spec.",
    "worldBoundingWidthMm",
    "worldBoundingHeightMm",
  ]) assert(source.includes(token),token);
  assert(workflow.includes("Write physical panel measurement worksheet"));
  assert(workflow.includes("garment:model-production:measurement-worksheet"));
});

test("rendered realistic review has an automated garment/shoe visibility gate",()=>{
  const packageJson=JSON.parse(readFileSync("package.json","utf8"));
  const source=readFileSync("scripts/evaluate-realistic-review.mjs","utf8");
  const workflow=readFileSync(".github/workflows/realistic-3d-candidate.yml","utf8");
  assert.equal(packageJson.scripts["garment:model-production:review-check"],"node scripts/evaluate-realistic-review.mjs artifacts/realistic-3d/review");
  for(const token of [
    "linen-earth-realistic-review-visibility-v1",
    "isTrouser",
    "isShoe",
    "trouserRatio",
    "shoeRatio",
    "review-visibility.json",
    "review-contact-sheet.png",
    "tileWidth=360",
    "tileHeight=540",
  ]) assert(source.includes(token),token);
  assert(workflow.includes("Verify garment and shoe visibility"));
  assert(workflow.includes("review_visibility"));
  assert(workflow.includes('test "${{ steps.review_visibility.outcome }}" = "success"'));
});

test("realistic production candidate renders front, three-quarter, side and back review views",()=>{
  const packageJson=JSON.parse(readFileSync("package.json","utf8"));
  const source=readFileSync("scripts/blender/render-linen-earth-officewear-review.py","utf8");
  const workflow=readFileSync(".github/workflows/realistic-3d-candidate.yml","utf8");
  assert.match(packageJson.scripts["garment:model-production:render-review"],/render-linen-earth-officewear-review\.py/);
  for(const token of [
    '("front", 0.0)',
    '("three-quarter", 35.0)',
    '("side", 90.0)',
    '("back", 180.0)',
    "BLENDER_EEVEE_NEXT",
    "LE_REVIEW_KEY",
    "LE_REVIEW_FILL",
    "LE_REVIEW_RIM",
    "scene.view_settings.exposure = -0.65",
    'default=480',
    'default=720',
    '#303843',
    '#A97C62',
    "SHOE_OBJECTS",
    '#241B16',
    "review-views.txt",
  ]) assert(source.includes(token),token);
  assert(workflow.includes("Render four-angle fit review"));
  assert(workflow.includes("garment:model-production:render-review"));
  assert(workflow.includes("continue-on-error: true"));
  assert(workflow.includes("--json-output artifacts/realistic-3d/preflight.json"));
  assert(workflow.includes("Enforce candidate gates"));
  assert(workflow.includes("libegl1"));
  assert(workflow.includes("libgl1"));
});

test("realistic scene can absorb the deterministic tailoring variant library without a second mannequin",()=>{
  const source=readFileSync("scripts/garment-import-tailoring-library.py","utf8");
  for(const token of [
    "bpy.ops.import_scene.gltf",
    "linen_earth_tailoring_variant",
    "deterministic-library-fit-to-locked-identity",
    "Variant__",
    "Length__",
    "MannequinSkinArmVariant__",
    "Deterministic base geometry leaked into realistic scene",
    "Retained variant materials",
  ]) assert(source.includes(token),token);
  for(const name of [
    "Body",
    "ShirtTorsoFabric",
    "ShirtSleeveLFabric",
    "ShirtSleeveRFabric",
    "TrouserWaistFabric",
    "TrouserLegLFabric",
    "TrouserLegRFabric",
  ]) assert(source.includes(name),name);
});

test("production scene assembly chains realistic body preparation, garment authoring and Blender preflight",()=>{
  const packageJson=JSON.parse(readFileSync("package.json","utf8"));
  const source=readFileSync("scripts/assemble-production-garment-scene.mjs","utf8");
  assert.equal(packageJson.scripts["garment:model-production:assemble"],"node scripts/assemble-production-garment-scene.mjs");
  for(const token of [
    "bootstrap-human-base-meshes.py",
    'process.env.PYTHON||"python3"',
    "build-garment-viewer-model.mjs",
    "prepare-linen-earth-body.py",
    "author-linen-earth-officewear.py",
    "garment-import-tailoring-library.py",
    "LINEN_TAILORING_LIBRARY_GLB",
    "preflight-linen-earth-officewear.py",
    "linen-earth-officewear-authored.blend",
    '"--python-exit-code","1"',
    "visually/tailor review",
  ]) assert(source.includes(token),token);
  for(const key of ["garment:model-body:prepare","garment:model-scene:check","garment:model-production:render-review","garment:model-production:lab-export","garment:model-production:measurement-worksheet"]){
    assert.match(packageJson.scripts[key],/--python-exit-code 1/,key);
  }
});

test("tailoring coverage counts only materials actually assigned to GLB primitives",()=>{
  const source=readFileSync("src/lib/garment-viewer-glb.ts","utf8");
  assert(source.includes("const usedMaterialNames=new Set<string>()"));
  assert(source.includes("usedMaterialNames.add(name)"));
  assert(source.includes("garmentViewerStyleMaterialCoverage([...usedMaterialNames])"));
  assert(!source.includes("garmentViewerStyleMaterialCoverage(materialNames)"));
});

test("operator reviewer evidence is locked to a realistic production candidate",()=>{
  const page=readFileSync("src/app/operator/garment-viewer/page.tsx","utf8");
  const form=readFileSync("src/app/operator/garment-viewer/GarmentViewerEvidenceForm.tsx","utf8");
  const server=readFileSync("src/lib/garment-viewer-model-server.ts","utf8");
  assert(page.includes("productionCandidateReady={status.productionCandidateReady}"));
  assert(page.includes("STRUCTURE READY / EVIDENCE OPEN"));
  assert(form.includes("productionCandidateReady:boolean"));
  assert(form.includes("realistic production candidate with measured-panel and passed Blender fit evidence"));
  assert(server.includes("const productionCandidateReady=Boolean(assetReady&&manifest?.productionAssetReady===true)"));
});

test("realistic lab export is explicit, unverified for physical scale and cannot masquerade as production evidence",()=>{
  const packageJson=JSON.parse(readFileSync("package.json","utf8"));
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  const workflow=readFileSync(".github/workflows/realistic-3d-candidate.yml","utf8");
  assert.match(packageJson.scripts["garment:model-production:lab-export"],/--lab-preview/);
  for(const token of [
    "--lab-preview",
    "geometry_panel_spec",
    "geometry-estimate-unverified",
    "realistic-body-lab-preview-unverified-panel-scale",
    "Panel dimensions are geometry estimates only; physical pattern scale is unverified.",
    "LAB-ONLY viewer manifest written",
  ]) assert(exporter.includes(token),token);
  assert(workflow.includes("Export realistic lab-only GLB"));
  assert(workflow.includes("garment:model-production:lab-export"));
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
  assert.equal(template.measurementEvidence.source,"REPLACE_WITH_OWNER_OR_TAILOR_MEASUREMENT");
  assert.equal(template.measurementEvidence.measuredAt,"YYYY-MM-DD");
  for(const panel of Object.values(template.panels) as Array<{widthMm:number;heightMm:number}>){
    assert.equal(panel.widthMm,0);
    assert.equal(panel.heightMm,0);
  }
  const exporter=readFileSync("scripts/blender/export-linen-earth-officewear.py","utf8");
  assert(exporter.includes("widthMm must be a measured value between 0 and 2000 mm"));
  assert(exporter.includes("heightMm must be a measured value between 0 and 2500 mm"));
  assert(exporter.includes("Panel spec requires measurementEvidence"));
  assert(exporter.includes("owner_measured"));
  assert(exporter.includes("tailor_measured"));
  assert(exporter.includes("pattern_room_measured"));
  assert(exporter.includes("supplier_pattern_verified"));
  assert(exporter.includes("panelMeasurementEvidence"));
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
    "outerArmSilhouetteMm",
    "bodyHandCenterSpacingMm",
    "side_center_x_at_z",
    "nearest_distance_stats_mm",
    "boundaryClearanceMm",
    "upperTorsoBody",
    "shirtWaistBody",
    "leftCuffBody",
    "rightCuffBody",
    "trouserWaistBody",
    "trouserInnerGap",
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
