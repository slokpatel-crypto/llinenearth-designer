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
import { LINEN_EARTH_MODEL_IDENTITY_ID, LINEN_EARTH_MODEL_REFERENCE_IMAGE } from "../src/lib/designer/model-identity.ts";

const PHYSICAL_TARGETS={
  height:1727,
  shoulderSeamWidth:388,
  outerArmSilhouette:574,
  shirtWaistWidth:294,
  trouserWaistWidth:344,
  handCenterSpacing:500,
  legCenterSpacing:210,
  hemWidth:64,
};
const MODEL_IDENTITY={id:LINEN_EARTH_MODEL_IDENTITY_ID,referenceImage:LINEN_EARTH_MODEL_REFERENCE_IMAGE,physicalTargetsMm:PHYSICAL_TARGETS};

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
    modelIdentity:MODEL_IDENTITY,
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
    modelIdentity:MODEL_IDENTITY,
    source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
    panels,
  },"LE-OFFICEWEAR-V1");
  assert.equal(valid.valid,true);

  const invalidPanels={...panels,[REQUIRED_GARMENT_VIEWER_MATERIALS[0]]:{widthMm:300,heightMm:600,offsetU:11,offsetV:0,rotationDeg:0}};
  const invalid=validateGarmentViewerModelManifest({
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    modelIdentity:MODEL_IDENTITY,
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
    modelIdentity:MODEL_IDENTITY,
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


test("wrong model identity fails production manifest",()=>{
  const panels=Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}]));
  const base={
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
    panels,
  };
  const wrong=validateGarmentViewerModelManifest({
    ...base,
    modelIdentity:{id:"another-model",referenceImage:"/designer/other.webp",physicalTargetsMm:PHYSICAL_TARGETS},
  },"LE-OFFICEWEAR-V1");
  assert.equal(wrong.valid,false);
  assert(wrong.reasons.some((reason)=>reason.includes("model identity")));
  const exact=validateGarmentViewerModelManifest({...base,modelIdentity:MODEL_IDENTITY},"LE-OFFICEWEAR-V1");
  assert.equal(exact.valid,true);

  const drifted=validateGarmentViewerModelManifest({
    ...base,
    modelIdentity:{...MODEL_IDENTITY,physicalTargetsMm:{...PHYSICAL_TARGETS,handCenterSpacing:510}},
  },"LE-OFFICEWEAR-V1");
  assert.equal(drifted.valid,false);
  assert(drifted.reasons.some((reason)=>reason.includes("handCenterSpacing")));
});

test("explicit source UV unit convention is validated; legacy manifests remain compatible",()=>{
  const panels=Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}]));
  const base={
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    modelIdentity:MODEL_IDENTITY,
    source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
    panels,
  };
  assert.equal(validateGarmentViewerModelManifest(base,"LE-OFFICEWEAR-V1").valid,true);
  assert.equal(validateGarmentViewerModelManifest({...base,uvCoordinateUnits:"panel_normalized"},"LE-OFFICEWEAR-V1").valid,true);
  assert.equal(validateGarmentViewerModelManifest({...base,uvCoordinateUnits:"mesh_metres"},"LE-OFFICEWEAR-V1").valid,true);
  const bad=validateGarmentViewerModelManifest({...base,uvCoordinateUnits:"unmeasured_uv"},"LE-OFFICEWEAR-V1");
  assert.equal(bad.valid,false);
  assert(bad.reasons.some(reason=>reason.includes("UV coordinate units")));
});

test("invalid garment-panel JSON entries cannot pass the physical-scale manifest gate",()=>{
  const panels=Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}]));
  const base={
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    modelIdentity:MODEL_IDENTITY,
    source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
    panels,
    uvCoordinateUnits:"mesh_metres",
  };
  const target=REQUIRED_GARMENT_VIEWER_MATERIALS[0];
  const invalidEntries=[
    null,false,0,"",[],{},
    {widthMm:"300",heightMm:600},
    {widthMm:300,heightMm:"600"},
    {widthMm:300,heightMm:600,offsetU:"0"},
    {widthMm:300,heightMm:600,offsetV:null},
    {widthMm:300,heightMm:600,rotationDeg:false},
    {widthMm:300,heightMm:600,rotationDeg:361},
    {widthMm:300,heightMm:600,offsetV:Number.POSITIVE_INFINITY},
  ];
  for(const badPanel of invalidEntries){
    const checked=validateGarmentViewerModelManifest({...base,panels:{...panels,[target]:badPanel}},"LE-OFFICEWEAR-V1");
    assert.equal(checked.valid,false,`bad panel: ${JSON.stringify(badPanel)}`);
    assert(checked.invalidPanels.includes(target));
  }
  const valid=validateGarmentViewerModelManifest({
    ...base,panels:{...panels,[target]:{widthMm:300,heightMm:600,offsetU:0,offsetV:-10,rotationDeg:360}},
  },"LE-OFFICEWEAR-V1");
  assert.equal(valid.valid,true);
});

test("model source verification calendar date must be real, not merely YYYY-MM-DD shaped",()=>{
  const panels=Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}]));
  const base={
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    modelIdentity:MODEL_IDENTITY,
    panels,
  };
  const checked=(verifiedAt:string)=>validateGarmentViewerModelManifest({
    ...base,source:{name:"Verified source",license:"CC0",verifiedAt},
  },"LE-OFFICEWEAR-V1");
  assert.equal(checked("2024-02-29").valid,true);
  for(const invalidDate of ["2026-02-29","2026-02-31","2026-04-31","2026-13-01","2026-00-01","2026-1-01","not verified"]){
    const result=checked(invalidDate);
    assert.equal(result.valid,false,invalidDate);
    assert.equal(result.sourceReady,false,invalidDate);
    assert(result.reasons.some(reason=>reason.includes("source provenance")),invalidDate);
  }
});
