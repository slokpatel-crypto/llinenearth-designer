import test from "node:test";
import assert from "node:assert/strict";
import { summarizePreviewOptionCoverage } from "../src/lib/designer/preview-option-coverage.ts";

test("customer preview gate requires every visible option to be fully cleared",()=>{
  const rows=[
    {id:"a",styleKey:"collar",label:"A",livePreview:"approximate" as const,constructionStatus:"not_required" as const,previewStatus:"approved" as const},
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
