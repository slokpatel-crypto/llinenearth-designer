import test from "node:test";
import assert from "node:assert/strict";
import { garmentViewerAssetIdentityKey, garmentViewerAssetIdentityMatches, garmentViewerPromotionReadiness } from "../src/lib/garment-viewer-readiness.ts";
import {
  GARMENT_VIEWER_CONTRACT_VERSION,
  REQUIRED_GARMENT_VIEWER_MATERIALS,
  validateGarmentViewerModelContract,
  validateGarmentViewerModelManifest,
} from "../src/lib/garment-viewer-model-contract.ts";
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

const contract=validateGarmentViewerModelContract({
  modelId:"LE-OFFICEWEAR-V1",
  materialNames:[...REQUIRED_GARMENT_VIEWER_MATERIALS],
});
const manifest=validateGarmentViewerModelManifest({
  version:GARMENT_VIEWER_CONTRACT_VERSION,
  modelId:"LE-OFFICEWEAR-V1",
  referenceHeightMm:1727,
  modelIdentity:{id:LINEN_EARTH_MODEL_IDENTITY_ID,referenceImage:LINEN_EARTH_MODEL_REFERENCE_IMAGE,physicalTargetsMm:PHYSICAL_TARGETS},
  source:{name:"Blender Human Base Meshes",license:"CC0",verifiedAt:"2026-10-05"},
  panels:Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}])),
  panelMeasurementEvidence:{source:"tailor_measured",measuredAt:"2026-10-05",note:"Measured directly from the approved garment pattern."},
  productionFitEvidence:{
    gate:"linen-earth-officewear-scene-preflight-v1",
    ready:true,
    identityFitMeasurementsMm:{shirtWaistWidth:294},
    identityShoeMeasurementsMm:{LE_ShoeL:{lengthMm:280},LE_ShoeR:{lengthMm:280},symmetry:{lengthDifferenceMm:0}},
    boundaryIntersections:{bodyShirtTorso:0},
    boundaryClearanceMm:{shirtWaistBody:{median:8}},
    totals:{triangles:120000,vertices:160000},
  },
  productionAssetStatus:"realistic-body-production-candidate",
},"LE-OFFICEWEAR-V1");

function passingInput() {
  return {
    contract,
    manifest,
    styleVariantCoverage:{ready:true,required:320,present:320,missing:[]},
    patternScaleSamples:[
      {fabricId:"stripe-a",pattern:"stripe" as const,errorPct:4.1,verified:true},
      {fabricId:"check-b",pattern:"check" as const,errorPct:6.4,verified:true},
    ],
    interactionLatencyMs:[110,120,105,130,125,115,118,122,109,111,126,128],
    realismAssessments:Array.from({length:8},(_,index)=>({
      viewerId:`viewer-${index+1}`,
      rating:index<6?4:3,
    })),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
    assetIdentity:{modelId:"LE-OFFICEWEAR-V1",modelSha256:"c".repeat(64),manifestSha256:"d".repeat(64)},
    uvAxisEvidence:{
      modelSha256:"c".repeat(64),
      panels:Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[
        name,{uAxisMedianDriftPct:2,vAxisMedianDriftPct:4,sourceOrCandidateCollapsedUvTriangles:0,physicalRepeatVerified:true}
      ])),
    },
    studioDrapeApproval:{
      modelSha256:"c".repeat(64),
      referenceImage:LINEN_EARTH_MODEL_REFERENCE_IMAGE,
      selectedStyleMatchesReference:true,
      approvedAngles:["front","three-quarter","side","back"],
      reviewedByOwner:true,
      calibratedLinenColourAndDrape:true,
    },
  };
}

test("production GarmentViewer can only promote when every realism and physical gate passes",()=>{
  const result=garmentViewerPromotionReadiness(passingInput());
  assert.equal(result.ready,true);
  assert.equal(result.contractReady,true);
  assert.equal(result.manifestReady,true);
  assert.equal(result.productionAssetReady,true);
  assert.equal(result.styleVariantReady,true);
  assert.equal(result.scaleReady,true);
  assert.equal(result.latencyReady,true);
  assert.equal(result.realismReady,true);
  assert.equal(result.boundaryReady,true);
  assert.equal(result.uvAxisReady,true);
  assert.equal(result.studioReady,true);
  assert.deepEqual(result.reasons,[]);
});

test("valid deterministic preview shell cannot be promoted as the production 3D model",()=>{
  const deterministicManifest=validateGarmentViewerModelManifest({
    version:GARMENT_VIEWER_CONTRACT_VERSION,
    modelId:"LE-OFFICEWEAR-V1",
    referenceHeightMm:1727,
    modelIdentity:{id:LINEN_EARTH_MODEL_IDENTITY_ID,referenceImage:LINEN_EARTH_MODEL_REFERENCE_IMAGE,physicalTargetsMm:PHYSICAL_TARGETS},
    source:{name:"Linen Earth deterministic viewer shell",license:"Project asset",verifiedAt:"2026-10-07"},
    panels:Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}])),
    productionAssetStatus:"deterministic-preview-shell-not-realistic-production-asset",
  },"LE-OFFICEWEAR-V1");
  assert.equal(deterministicManifest.valid,true);
  assert.equal(deterministicManifest.productionAssetReady,false);
  const input=passingInput();
  input.manifest=deterministicManifest;
  const result=garmentViewerPromotionReadiness(input);
  assert.equal(result.ready,false);
  assert.equal(result.productionAssetReady,false);
  assert(result.reasons.some((reason)=>reason.includes("realistic-body Blender candidate")));
});

test("prototype or invalid model contract blocks promotion",()=>{
  const input=passingInput();
  input.contract=validateGarmentViewerModelContract({
    modelId:"LE-GARMENT-M1",
    materialNames:[...REQUIRED_GARMENT_VIEWER_MATERIALS],
  });
  const result=garmentViewerPromotionReadiness(input);
  assert.equal(result.ready,false);
  assert.equal(result.contractReady,false);
});

test("incomplete tailoring variant coverage blocks customer promotion",()=>{
  const input=passingInput();
  input.styleVariantCoverage={ready:false,required:320,present:118,missing:["ShirtCollarVariant__cutaway__stiff_fused"]};
  const result=garmentViewerPromotionReadiness(input);
  assert.equal(result.ready,false);
  assert.equal(result.styleVariantReady,false);
  assert(result.reasons.some((reason)=>reason.includes("tailoring variants are incomplete")));
});

test("scale gate requires both verified stripe and check samples within eight percent",()=>{
  const missingCheck=passingInput();
  missingCheck.patternScaleSamples=[{fabricId:"stripe-a",pattern:"stripe",errorPct:2,verified:true}];
  assert.equal(garmentViewerPromotionReadiness(missingCheck).scaleReady,false);

  const drift=passingInput();
  drift.patternScaleSamples[1].errorPct=8.1;
  assert.equal(garmentViewerPromotionReadiness(drift).scaleReady,false);
});

test("realism, latency and boundary evidence cannot be bypassed",()=>{
  const input=passingInput();
  input.interactionLatencyMs=[100,110];
  input.realismAssessments=[{viewerId:"one",rating:5}];
  input.boundaryChecks={neck:true,cuffs:true,waist:false,trouserGap:true};
  const result=garmentViewerPromotionReadiness(input);
  assert.equal(result.ready,false);
  assert.equal(result.latencyReady,false);
  assert.equal(result.realismReady,false);
  assert.equal(result.boundaryReady,false);
  assert(result.reasons.length>=3);
});


test("production cannot promote visually mismatched or physically uncalibrated garment UVs",()=>{
  const noPhoto=passingInput();
  noPhoto.studioDrapeApproval.reviewedByOwner=false;
  let result=garmentViewerPromotionReadiness(noPhoto);
  assert.equal(result.ready,false);
  assert.equal(result.studioReady,false);
  assert(result.reasons.some((reason)=>reason.includes("four-angle reference identity")));

  const unsafeUv=passingInput();
  unsafeUv.uvAxisEvidence.panels.ShirtTorsoFabric.uAxisMedianDriftPct=20.765;
  result=garmentViewerPromotionReadiness(unsafeUv);
  assert.equal(result.ready,false);
  assert.equal(result.uvAxisReady,false);

  const unmeasured=passingInput();
  unmeasured.uvAxisEvidence.panels.TrouserWaistFabric.physicalRepeatVerified=false;
  assert.equal(garmentViewerPromotionReadiness(unmeasured).uvAxisReady,false);

  const collapsed=passingInput();
  collapsed.uvAxisEvidence.panels.ShirtSleeveLFabric.sourceOrCandidateCollapsedUvTriangles=1;
  assert.equal(garmentViewerPromotionReadiness(collapsed).uvAxisReady,false);

  const stale=passingInput();
  stale.uvAxisEvidence.modelSha256="e".repeat(64);
  assert.equal(garmentViewerPromotionReadiness(stale).uvAxisReady,false);

  const wrongView=passingInput();
  wrongView.studioDrapeApproval.approvedAngles=["front","side"];
  assert.equal(garmentViewerPromotionReadiness(wrongView).studioReady,false);

  const candidateOnly=passingInput();
  candidateOnly.studioDrapeApproval.calibratedLinenColourAndDrape=false;
  assert.equal(garmentViewerPromotionReadiness(candidateOnly).ready,false);
});

test("QA evidence identity is invalidated by any GLB or manifest revision",()=>{
  const current={modelId:"LE-OFFICEWEAR-V1",modelSha256:"a".repeat(64),manifestSha256:"b".repeat(64)};
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current}),true);
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current,modelSha256:"c".repeat(64)}),false);
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current,manifestSha256:"d".repeat(64)}),false);
  assert.equal(garmentViewerAssetIdentityKey(current),`LE-OFFICEWEAR-V1:${"a".repeat(64)}:${"b".repeat(64)}`);
});
