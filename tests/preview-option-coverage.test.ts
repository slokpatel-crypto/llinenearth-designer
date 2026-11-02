import test from "node:test";
import assert from "node:assert/strict";
import { summarizePreviewOptionCoverage } from "../src/lib/designer/preview-option-coverage.ts";

test("customer preview gate requires every visible option to be fully cleared",()=>{
  const rows=[
    {id:"a",styleKey:"collar",label:"A",livePreview:"exact" as const,constructionStatus:"not_required" as const,previewStatus:"approved" as const},
    {id:"b",styleKey:"cuff",label:"B",livePreview:"exact" as const,constructionStatus:"approved" as const,previewStatus:"approved" as const},
  ];
  const result=summarizePreviewOptionCoverage(rows);
  assert.equal(result.total,2);
  assert.equal(result.fullyCleared,2);
  assert.equal(result.gateComplete,true);
});

test("pending construction or preview support keeps coverage open",()=>{
  const result=summarizePreviewOptionCoverage([
    {id:"a",styleKey:"collar",label:"A",livePreview:"approximate",constructionStatus:"pending",previewStatus:"approved"},
    {id:"b",styleKey:"cuff",label:"B",livePreview:"approximate",constructionStatus:"not_required",previewStatus:"pending"},
  ]);
  assert.equal(result.fullyCleared,0);
  assert.equal(result.constructionPending,1);
  assert.equal(result.previewPending,1);
  assert.equal(result.gateComplete,false);
});

test("non-renderable or rejected choices can never count as fully cleared",()=>{
  const result=summarizePreviewOptionCoverage([
    {id:"a",styleKey:"trouser",label:"A",livePreview:"none",constructionStatus:"approved",previewStatus:"approved"},
    {id:"b",styleKey:"rise",label:"B",livePreview:"exact",constructionStatus:"rejected",previewStatus:"approved"},
  ]);
  assert.equal(result.noPreviewSupport,1);
  assert.equal(result.constructionBlocked,1);
  assert.equal(result.fullyCleared,0);
});

test("operator approval of an approximate preview cannot certify exact option production accuracy",()=>{
  const rows=[
    {id:"collar_a",styleKey:"collar",label:"Collar A",livePreview:"approximate" as const,constructionStatus:"approved" as const,previewStatus:"approved" as const},
    {id:"cuff_b",styleKey:"cuff",label:"Cuff B",livePreview:"exact" as const,constructionStatus:"approved" as const,previewStatus:"approved" as const},
  ];
  const summary=summarizePreviewOptionCoverage(rows);
  assert.equal(summary.previewApproved,2,"reviews remain recorded and visible");
  assert.equal(summary.approximatePreview,1);
  assert.equal(summary.fullyCleared,1,"only exact visual rendering with human approval clears");
  assert.equal(summary.coveragePercent,50);
  assert.equal(summary.gateComplete,false);
  const upgraded=summarizePreviewOptionCoverage(rows.map(row=>({...row,livePreview:"exact" as const})));
  assert.equal(upgraded.fullyCleared,2);
  assert.equal(upgraded.gateComplete,true);
});

test("no preview and rejected construction remain blocked even with exact reviews",()=>{
  const summary=summarizePreviewOptionCoverage([
    {id:"x",styleKey:"cuff",label:"x",livePreview:"none",constructionStatus:"not_required",previewStatus:"approved"},
    {id:"y",styleKey:"collar",label:"y",livePreview:"exact",constructionStatus:"rejected",previewStatus:"approved"},
  ]);
  assert.equal(summary.fullyCleared,0);
  assert.equal(summary.gateComplete,false);
});
