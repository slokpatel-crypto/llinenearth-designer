import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFinalRenderReleaseEvidence, evaluateRenderCreditCap, summarizeCrossViewIdentity } from "../src/lib/designer/render-release-evidence.ts";

test("cross-view identity only counts concepts with at least two rendered views",()=>{
  const outcomes=[
    {concept_id:"a",view:"front",human_status:"approved" as const},
    {concept_id:"a",view:"side",human_status:"approved" as const},
    {concept_id:"b",view:"front",human_status:"approved" as const},
  ];
  const reviews=[
    {concept_id:"a",status:"pass" as const,reviewed_views:["front","side"],created_at:"2026-10-01T10:00:00Z"},
  ];
  assert.deepEqual(summarizeCrossViewIdentity(outcomes,reviews),{
    eligibleConcepts:1,reviewedConcepts:1,pendingConcepts:0,passedConcepts:1,failedConcepts:0,passRate:100,
  });
});

test("latest identity review controls the current evidence state",()=>{
  const outcomes=[
    {concept_id:"a",view:"front",human_status:"approved" as const},
    {concept_id:"a",view:"back",human_status:"approved" as const},
  ];
  const reviews=[
    {concept_id:"a",status:"pass" as const,reviewed_views:["front","back"],created_at:"2026-10-01T10:00:00Z"},
    {concept_id:"a",status:"fail" as const,reviewed_views:["front","back"],created_at:"2026-10-01T11:00:00Z"},
  ];
  const result=summarizeCrossViewIdentity(outcomes,reviews);
  assert.equal(result.failedConcepts,1);
  assert.equal(result.passRate,0);
});

test("render credit cap stays unknown until owner enters a cap and real approvals exist",()=>{
  assert.deepEqual(evaluateRenderCreditCap(null,null),{configured:false,withinCap:null,ownerCap:null});
  assert.deepEqual(evaluateRenderCreditCap(null,1.5),{configured:true,withinCap:null,ownerCap:1.5});
  assert.equal(evaluateRenderCreditCap(1.2,1.5).withinCap,true);
  assert.equal(evaluateRenderCreditCap(1.7,1.5).withinCap,false);
});


test("final render release requires approval evidence, clean identity evidence, and owner cost cap",()=>{
  const result=evaluateFinalRenderReleaseEvidence({
    reviewed:20,
    approvalRate:65,
    identity:{eligibleConcepts:3,reviewedConcepts:3,pendingConcepts:0,passedConcepts:3,failedConcepts:0},
    creditCap:{configured:true,withinCap:true},
  });
  assert.equal(result.gateComplete,true);
  assert.equal(result.progressPercent,100);
  assert.equal(result.remainingReviews,0);
});

test("final render release stays open when any human evidence boundary is unresolved",()=>{
  const result=evaluateFinalRenderReleaseEvidence({
    reviewed:19,
    approvalRate:90,
    identity:{eligibleConcepts:2,reviewedConcepts:2,pendingConcepts:0,passedConcepts:1,failedConcepts:1},
    creditCap:{configured:true,withinCap:null},
  });
  assert.equal(result.approvalGateComplete,false);
  assert.equal(result.identityGateComplete,false);
  assert.equal(result.costGateComplete,false);
  assert.equal(result.gateComplete,false);
  assert.equal(result.progressPercent,66);
  assert.equal(result.remainingReviews,1);
});

test("cross-view release evidence cannot pass before a multi-view concept exists",()=>{
  const result=evaluateFinalRenderReleaseEvidence({
    reviewed:25,
    approvalRate:80,
    identity:{eligibleConcepts:0,reviewedConcepts:0,pendingConcepts:0,passedConcepts:0,failedConcepts:0},
    creditCap:{configured:true,withinCap:true},
  });
  assert.equal(result.approvalGateComplete,true);
  assert.equal(result.identityGateComplete,false);
  assert.equal(result.costGateComplete,true);
  assert.equal(result.progressPercent,67);
  assert.equal(result.gateComplete,false);
});


test("a newly generated view makes an older identity review pending again",()=>{
  const outcomes=[
    {concept_id:"a",view:"front",human_status:"approved" as const},
    {concept_id:"a",view:"side",human_status:"approved" as const},
    {concept_id:"a",view:"back",human_status:"pending" as const},
  ];
  const reviews=[
    {concept_id:"a",status:"pass" as const,reviewed_views:["front","side"],created_at:"2026-10-01T10:00:00Z"},
  ];
  const result=summarizeCrossViewIdentity(outcomes,reviews);
  assert.equal(result.eligibleConcepts,1);
  assert.equal(result.reviewedConcepts,0);
  assert.equal(result.pendingConcepts,1);
  assert.equal(result.passedConcepts,0);
  assert.equal(result.passRate,null);
});
