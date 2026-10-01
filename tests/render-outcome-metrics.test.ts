import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRenderOutcomes } from "../src/lib/designer/render-outcome-metrics.ts";

test("render outcome metrics exclude cached renders from provider credit spend",()=>{
  const result=summarizeRenderOutcomes([
    {credits_used:1.2,cached:false,human_status:"approved",qa_status:"pass"},
    {credits_used:1.0,cached:false,human_status:"rejected",qa_status:"review"},
    {credits_used:1.2,cached:true,human_status:"approved",qa_status:"pass"},
  ]);
  assert.equal(result.generated,2);
  assert.equal(result.cached,1);
  assert.equal(result.totalCredits,2.2);
  assert.equal(result.approved,2);
  assert.equal(result.approvalRate,66.7);
  assert.equal(result.creditsPerApproved,1.1);
});

test("render approval metrics stay unknown before human review",()=>{
  const result=summarizeRenderOutcomes([
    {credits_used:.8,cached:false,human_status:"pending",qa_status:"pass"},
  ]);
  assert.equal(result.approvalRate,null);
  assert.equal(result.creditsPerApproved,null);
  assert.equal(result.pending,1);
});
