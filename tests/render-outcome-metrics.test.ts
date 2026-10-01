import test from "node:test";
import assert from "node:assert/strict";
import { summarizeApprovedPatternCalibrationCoverage, summarizeRenderOutcomes, summarizeRenderPatternCalibrations } from "../src/lib/designer/render-outcome-metrics.ts";

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


test("approved patterned renders require a passing calibration for each patterned garment",()=>{
  const result=summarizeApprovedPatternCalibrationCoverage([
    {outcome_id:"o1",shirt_id:"stripe-shirt",pant_id:"solid-pant",human_status:"approved"},
    {outcome_id:"o2",shirt_id:"check-shirt",pant_id:"check-pant",human_status:"approved"},
    {outcome_id:"o3",shirt_id:"stripe-shirt",pant_id:"check-pant",human_status:"rejected"},
  ],[
    {outcome_id:"o1",garment:"shirt",scale_error_pct:4,axis_status:"match",created_at:"2026-10-01T10:00:00Z"},
    {outcome_id:"o2",garment:"shirt",scale_error_pct:7,axis_status:"match",created_at:"2026-10-01T10:00:00Z"},
    {outcome_id:"o2",garment:"trouser",scale_error_pct:2,axis_status:"mismatch",created_at:"2026-10-01T10:00:00Z"},
  ],new Set(["stripe-shirt","check-shirt","check-pant"]));
  assert.equal(result.requiredPairs,3);
  assert.equal(result.passedPairs,2);
  assert.equal(result.failedPairs,1);
  assert.equal(result.pendingPairs,0);
  assert.equal(result.gateComplete,false);
});

test("latest pattern calibration controls release coverage",()=>{
  const result=summarizeApprovedPatternCalibrationCoverage([
    {outcome_id:"o1",shirt_id:"stripe-shirt",pant_id:"solid-pant",human_status:"approved"},
  ],[
    {outcome_id:"o1",garment:"shirt",scale_error_pct:12,axis_status:"match",created_at:"2026-10-01T10:00:00Z"},
    {outcome_id:"o1",garment:"shirt",scale_error_pct:5,axis_status:"match",created_at:"2026-10-01T10:05:00Z"},
  ],new Set(["stripe-shirt"]));
  assert.equal(result.requiredPairs,1);
  assert.equal(result.passedPairs,1);
  assert.equal(result.failedPairs,0);
  assert.equal(result.pendingPairs,0);
  assert.equal(result.gateComplete,true);
});

test("pattern release gate stays open until at least one approved patterned render exists",()=>{
  const result=summarizeApprovedPatternCalibrationCoverage([
    {outcome_id:"o1",shirt_id:"solid-shirt",pant_id:"solid-pant",human_status:"approved"},
  ],[],new Set(["stripe-shirt"]));
  assert.equal(result.requiredPairs,0);
  assert.equal(result.gateComplete,false);
});


test("stale calibration is invalidated when reviewed repeat truth changes",()=>{
  const result=summarizeApprovedPatternCalibrationCoverage([
    {outcome_id:"o1",shirt_id:"stripe-shirt",pant_id:"solid-pant",human_status:"approved"},
  ],[
    {outcome_id:"o1",garment:"shirt",expected_repeat_mm:10,scale_error_pct:2,axis_status:"match",created_at:"2026-10-01T10:00:00Z"},
  ],new Set(["stripe-shirt"]),new Map([["stripe-shirt",12]]));
  assert.equal(result.requiredPairs,1);
  assert.equal(result.passedPairs,0);
  assert.equal(result.pendingPairs,1);
  assert.equal(result.staleCalibrationPairs,1);
  assert.equal(result.gateComplete,false);
});

test("missing reviewed repeat truth blocks final render pattern coverage",()=>{
  const result=summarizeApprovedPatternCalibrationCoverage([
    {outcome_id:"o1",shirt_id:"stripe-shirt",pant_id:"solid-pant",human_status:"approved"},
  ],[
    {outcome_id:"o1",garment:"shirt",expected_repeat_mm:10,scale_error_pct:2,axis_status:"match",created_at:"2026-10-01T10:00:00Z"},
  ],new Set(["stripe-shirt"]),new Map());
  assert.equal(result.requiredPairs,1);
  assert.equal(result.passedPairs,0);
  assert.equal(result.pendingPairs,1);
  assert.equal(result.missingTruthPairs,1);
  assert.equal(result.gateComplete,false);
});

test("current reviewed repeat truth can satisfy final render pattern coverage",()=>{
  const result=summarizeApprovedPatternCalibrationCoverage([
    {outcome_id:"o1",shirt_id:"stripe-shirt",pant_id:"solid-pant",human_status:"approved"},
  ],[
    {outcome_id:"o1",garment:"shirt",expected_repeat_mm:10,scale_error_pct:4,axis_status:"match",created_at:"2026-10-01T10:00:00Z"},
  ],new Set(["stripe-shirt"]),new Map([["stripe-shirt",10]]));
  assert.equal(result.passedPairs,1);
  assert.equal(result.pendingPairs,0);
  assert.equal(result.staleCalibrationPairs,0);
  assert.equal(result.gateComplete,true);
});
