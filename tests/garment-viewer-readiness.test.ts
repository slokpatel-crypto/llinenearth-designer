import {readFileSync} from "node:fs";
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
},"LE-OFFICEWEAR-V1");

function passingInput() {
  return {
    contract,
    manifest,
    patternScaleSamples:[
      {fabricId:"stripe-a",pattern:"stripe" as const,errorPct:4.1,verified:true,repeatMm:20,observedRepeatPx:104.1,referenceMm:100,referencePx:500,physicalEvidenceNote:"Measured with fabric ruler A, same plane"},
      {fabricId:"check-b",pattern:"check" as const,errorPct:6.4,verified:true,repeatMm:20,observedRepeatPx:106.4,referenceMm:100,referencePx:500,physicalEvidenceNote:"Measured with fabric ruler B, same plane"},
    ],
    interactionLatencyMs:[110,120,105,130,125,115,118,122,109,111,126,128],
    realismAssessments:Array.from({length:8},(_,index)=>({
      viewerId:`viewer-${index+1}`,
      rating:index<6?4:3,
    })),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  };
}

test("production GarmentViewer can only promote when every realism and physical gate passes",()=>{
  const result=garmentViewerPromotionReadiness(passingInput());
  assert.equal(result.ready,true);
  assert.equal(result.contractReady,true);
  assert.equal(result.manifestReady,true);
  assert.equal(result.scaleReady,true);
  assert.equal(result.latencyReady,true);
  assert.equal(result.realismReady,true);
  assert.equal(result.boundaryReady,true);
  assert.deepEqual(result.reasons,[]);
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

test("scale gate requires both verified stripe and check samples within eight percent",()=>{
  const missingCheck=passingInput();
  missingCheck.patternScaleSamples=[{...missingCheck.patternScaleSamples[0]}];
  assert.equal(garmentViewerPromotionReadiness(missingCheck).scaleReady,false);

  const drift=passingInput();
  drift.patternScaleSamples[1].observedRepeatPx=108.1;
  drift.patternScaleSamples[1].errorPct=0; // Claimed success must not override measured 8.1% error.
  assert.equal(garmentViewerPromotionReadiness(drift).scaleReady,false);

  const roundingBoundary=passingInput();
  roundingBoundary.patternScaleSamples[1].observedRepeatPx=108.004;
  roundingBoundary.patternScaleSamples[1].errorPct=8;
  assert.equal(garmentViewerPromotionReadiness(roundingBoundary).scaleReady,false);

  const baseline=passingInput();
  const legacy={...baseline,patternScaleSamples:baseline.patternScaleSamples.map(
    ({fabricId,pattern,errorPct,verified})=>({fabricId,pattern,errorPct,verified}),
  )};
  assert.equal(garmentViewerPromotionReadiness(legacy).scaleReady,false);

  const invalid=passingInput();
  invalid.patternScaleSamples[1].physicalEvidenceNote="";
  assert.equal(garmentViewerPromotionReadiness(invalid).scaleReady,false);
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


test("QA evidence identity is invalidated by any GLB or manifest revision",()=>{
  const current={modelId:"LE-OFFICEWEAR-V1",modelSha256:"a".repeat(64),manifestSha256:"b".repeat(64)};
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current}),true);
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current,modelSha256:"c".repeat(64)}),false);
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current,manifestSha256:"d".repeat(64)}),false);
  assert.equal(garmentViewerAssetIdentityKey(current),`LE-OFFICEWEAR-V1:${"a".repeat(64)}:${"b".repeat(64)}`);
});


test("viewer late-load recovery is bounded by the original twenty-second loading contract",()=>{
  const source=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert.ok(source.includes("viewer.loaded || (viewer.model?.materials?.length||0)>0"));
  assert.ok(source.includes("if(attempt<160) readinessTimer=window.setTimeout(()=>recoverReadyState(attempt+1),125)"));
  assert.ok(source.includes("setModelReady(true);setProgress(1);setError(\"\")"));
  assert.ok(!source.includes("if(attempt<80) readinessTimer="));
});
