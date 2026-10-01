import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRenderOutcomes, summarizeRenderPatternCalibrations } from "../src/lib/designer/render-outcome-metrics.ts";

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


test("pattern calibration uses the roadmap 8 percent physical-scale gate",()=>{
  const result=summarizeRenderPatternCalibrations([
    {scale_error_pct:4,axis_status:"match"},
    {scale_error_pct:8,axis_status:"match"},
    {scale_error_pct:9,axis_status:"match"},
    {scale_error_pct:2,axis_status:"mismatch"},
  ]);
  assert.equal(result.total,4);
  assert.equal(result.pass,2);
  assert.equal(result.fail,2);
  assert.equal(result.passRate,50);
  assert.equal(result.averageScaleErrorPct,5.75);
});
