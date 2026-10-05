import test from "node:test";
import assert from "node:assert/strict";
import { garmentViewerAssetIdentityKey, garmentViewerAssetIdentityMatches, garmentViewerPromotionReadiness } from "../src/lib/garment-viewer-readiness.ts";
import {
  GARMENT_VIEWER_CONTRACT_VERSION,
  REQUIRED_GARMENT_VIEWER_MATERIALS,
  validateGarmentViewerModelContract,
  validateGarmentViewerModelManifest,
} from "../src/lib/garment-viewer-model-contract.ts";

const contract=validateGarmentViewerModelContract({
  modelId:"LE-OFFICEWEAR-V1",
  materialNames:[...REQUIRED_GARMENT_VIEWER_MATERIALS],
});
const manifest=validateGarmentViewerModelManifest({
  version:GARMENT_VIEWER_CONTRACT_VERSION,
  modelId:"LE-OFFICEWEAR-V1",
  referenceHeightMm:1727,
  panels:Object.fromEntries(REQUIRED_GARMENT_VIEWER_MATERIALS.map((name)=>[name,{widthMm:300,heightMm:600}])),
},"LE-OFFICEWEAR-V1");

function passingInput() {
  return {
    contract,
    manifest,
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


test("QA evidence identity is invalidated by any GLB or manifest revision",()=>{
  const current={modelId:"LE-OFFICEWEAR-V1",modelSha256:"a".repeat(64),manifestSha256:"b".repeat(64)};
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current}),true);
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current,modelSha256:"c".repeat(64)}),false);
  assert.equal(garmentViewerAssetIdentityMatches(current,{...current,manifestSha256:"d".repeat(64)}),false);
  assert.equal(garmentViewerAssetIdentityKey(current),`LE-OFFICEWEAR-V1:${"a".repeat(64)}:${"b".repeat(64)}`);
});
