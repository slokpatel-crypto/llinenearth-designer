import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRenderCreditCap, summarizeCrossViewIdentity } from "../src/lib/designer/render-release-evidence.ts";

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
