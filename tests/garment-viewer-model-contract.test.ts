import test from "node:test";
import assert from "node:assert/strict";
import {
  approvedGarmentViewerModelSource,
  GARMENT_VIEWER_CONTRACT_VERSION,
  REQUIRED_GARMENT_VIEWER_MATERIALS,
  validateGarmentViewerModelContract,
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
