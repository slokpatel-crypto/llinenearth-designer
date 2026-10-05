import test from "node:test";
import assert from "node:assert/strict";
import {
  approvedGarmentViewerManifestSource,
  approvedGarmentViewerModelSource,
  GARMENT_VIEWER_CONTRACT_VERSION,
  REQUIRED_GARMENT_VIEWER_MATERIALS,
  validateGarmentViewerModelContract,
  validateGarmentViewerModelManifest,
} from "../src/lib/garment-viewer-model-contract.ts";
import { PROTOTYPE_MODEL_ID } from "../src/lib/garment-viewer-prototype.ts";

test("prototype satisfies panel contract but remains explicitly non-production",()=>{
  const result=validateGarmentViewerModelContract({
    modelId:PROTOTYPE_MODEL_ID,
    materialNames:[...REQUIRED_GARMENT_VIEWER_MATERIALS],
  });
  assert.equal(result.version,GARMENT_VIEWER_CONTRACT_VERSION);
  assert.equal(result.readiness,"prototype");
  assert.equal(result.physicallyScalable,true);
  assert.deepEqual(result.missingMaterials,[]);
  assert.equal(result.garmentPanels.shirt,3);
  assert.equal(result.garmentPanels.trouser,3);
});

test("approved model needs all six unique garment panels",()=>{
  const ready=validateGarmentViewerModelContract({
    modelId:"LE-OFFICEWEAR-V1",
    materialNames:[...REQUIRED_GARMENT_VIEWER_MATERIALS],
  });
  assert.equal(ready.readiness,"contract_ready");

  const failed=validateGarmentViewerModelContract({
    modelId:"LE-OFFICEWEAR-V1",
    materialNames:REQUIRED_GARMENT_VIEWER_MATERIALS.slice(1),
  });
  assert.equal(failed.readiness,"contract_failed");
  assert.equal(failed.physicallyScalable,false);
  assert.equal(failed.missingMaterials.length,1);
});

test("duplicate required material slots fail the production contract",()=>{
  const result=validateGarmentViewerModelContract({
    modelId:"LE-OFFICEWEAR-V1",
    materialNames:[...REQUIRED_GARMENT_VIEWER_MATERIALS,REQUIRED_GARMENT_VIEWER_MATERIALS[0]],
  });
  assert.equal(result.readiness,"contract_failed");
  assert.deepEqual(result.duplicateMaterials,[REQUIRED_GARMENT_VIEWER_MATERIALS[0]]);
});

test("approved model source is same-origin and restricted to models/*.glb",()=>{
  assert.equal(approvedGarmentViewerModelSource("/models/linen-earth-officewear-v1.glb"),"/models/linen-earth-officewear-v1.glb");
  assert.equal(approvedGarmentViewerModelSource("https://example.com/model.glb"),null);
  assert.equal(approvedGarmentViewerModelSource("/uploads/model.glb"),null);
  assert.equal(approvedGarmentViewerModelSource("/models/../secret.glb"),null);
  assert.equal(approvedGarmentViewerModelSource("/models/model.gltf"),null);
});


test("production manifest identity and all panel dimensions must match the approved model",()=>{
  const panels=Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}]));
  const good={
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
    panels,
  };
  assert.equal(validateGarmentViewerModelManifest(good,"LE-OFFICEWEAR-V1").valid,true);
  assert.equal(validateGarmentViewerModelManifest({...good,modelId:"OTHER"},"LE-OFFICEWEAR-V1").valid,false);
  assert.equal(approvedGarmentViewerManifestSource("/models/linen-earth-officewear-v1.glb"),"/models/linen-earth-officewear-v1.viewer.json");
});


test("panel phase controls stay bounded for production texture alignment",()=>{
  const panels=Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600,offsetU:.25,offsetV:-.1,rotationDeg:90}]));
  const valid=validateGarmentViewerModelManifest({
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
    panels,
  },"LE-OFFICEWEAR-V1");
  assert.equal(valid.valid,true);

  const invalidPanels={...panels,[REQUIRED_GARMENT_VIEWER_MATERIALS[0]]:{widthMm:300,heightMm:600,offsetU:11,offsetV:0,rotationDeg:0}};
  const invalid=validateGarmentViewerModelManifest({
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
    panels:invalidPanels,
  },"LE-OFFICEWEAR-V1");
  assert.equal(invalid.valid,false);
  assert(invalid.invalidPanels.includes(REQUIRED_GARMENT_VIEWER_MATERIALS[0]));
});


test("production manifest requires traceable source provenance",()=>{
  const panels=Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}]));
  const base={
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    panels,
  };
  const missing=validateGarmentViewerModelManifest(base,"LE-OFFICEWEAR-V1");
  assert.equal(missing.valid,false);
  assert.equal(missing.sourceReady,false);
  assert(missing.reasons.some((reason)=>reason.includes("source provenance")));

  const ready=validateGarmentViewerModelManifest({
    ...base,
    source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
  },"LE-OFFICEWEAR-V1");
  assert.equal(ready.valid,true);
  assert.equal(ready.sourceReady,true);
  assert.equal(ready.source?.license,"CC0");
});
