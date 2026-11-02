import test from "node:test";
import assert from "node:assert/strict";
import { summarizePreviewOptionCoverage } from "../src/lib/designer/preview-option-coverage.ts";

test("customer preview gate requires every visible option to be fully cleared",()=>{
  const rows=[
    {id:"a",styleKey:"collar",label:"A",livePreview:"exact" as const,constructionStatus:"not_required" as const,previewStatus:"approved" as const},
    {id:"b",styleKey:"cuff",label:"B",livePreview:"exact" as const,constructionStatus:"approved" as const,previewStatus:"approved" as const},
  ];
  const result=summarizePreviewOptionCoverage(rows,rows.map(row=>row.id));
  assert.equal(result.total,2);
  assert.equal(result.fullyCleared,2);
  assert.equal(result.gateComplete,true);
});

test("pending construction or preview support keeps coverage open",()=>{
  const result=summarizePreviewOptionCoverage([
    {id:"a",styleKey:"collar",label:"A",livePreview:"approximate",constructionStatus:"pending",previewStatus:"approved"},
    {id:"b",styleKey:"cuff",label:"B",livePreview:"approximate",constructionStatus:"not_required",previewStatus:"pending"},
  ],["a","b"]);
  assert.equal(result.fullyCleared,0);
  assert.equal(result.constructionPending,1);
  assert.equal(result.previewPending,1);
  assert.equal(result.gateComplete,false);
});

test("non-renderable or rejected choices can never count as fully cleared",()=>{
  const result=summarizePreviewOptionCoverage([
    {id:"a",styleKey:"trouser",label:"A",livePreview:"none",constructionStatus:"approved",previewStatus:"approved"},
    {id:"b",styleKey:"rise",label:"B",livePreview:"exact",constructionStatus:"rejected",previewStatus:"approved"},
  ],["a","b"]);
  assert.equal(result.noPreviewSupport,1);
  assert.equal(result.constructionBlocked,1);
  assert.equal(result.fullyCleared,0);
});

test("operator approval of an approximate preview cannot certify exact option production accuracy",()=>{
  const rows=[
    {id:"collar_a",styleKey:"collar",label:"Collar A",livePreview:"approximate" as const,constructionStatus:"approved" as const,previewStatus:"approved" as const},
    {id:"cuff_b",styleKey:"cuff",label:"Cuff B",livePreview:"exact" as const,constructionStatus:"approved" as const,previewStatus:"approved" as const},
  ];
  const summary=summarizePreviewOptionCoverage(rows,rows.map(row=>row.id));
  assert.equal(summary.previewApproved,2,"reviews remain recorded and visible");
  assert.equal(summary.approximatePreview,1);
  assert.equal(summary.fullyCleared,1,"only exact visual rendering with human approval clears");
  assert.equal(summary.coveragePercent,50);
  assert.equal(summary.gateComplete,false);
  const upgraded=summarizePreviewOptionCoverage(rows.map(row=>({...row,livePreview:"exact" as const})),rows.map(row=>row.id));
  assert.equal(upgraded.fullyCleared,2);
  assert.equal(upgraded.gateComplete,true);
});

test("no preview and rejected construction remain blocked even with exact reviews",()=>{
  const summary=summarizePreviewOptionCoverage([
    {id:"x",styleKey:"cuff",label:"x",livePreview:"none",constructionStatus:"not_required",previewStatus:"approved"},
    {id:"y",styleKey:"collar",label:"y",livePreview:"exact",constructionStatus:"rejected",previewStatus:"approved"},
  ],["x","y"]);
  assert.equal(summary.fullyCleared,0);
  assert.equal(summary.gateComplete,false);
});

test("missing, duplicated or unknown selectable style rows cannot turn a partial review into production approval",()=>{
  const sample={id:"preview:collar:classic",styleKey:"collar",label:"Classic",livePreview:"exact" as const,constructionStatus:"approved" as const,previewStatus:"approved" as const};
  const approved=[sample,{...sample,id:"preview:cuff:barrel",styleKey:"cuff",label:"Barrel"}];
  const ids=approved.map((item)=>item.id);
  const full=summarizePreviewOptionCoverage(approved,ids);
  assert.equal(full.catalogueComplete,true);
  assert.equal(full.gateComplete,true);

  const missing=summarizePreviewOptionCoverage([sample],ids);
  assert.equal(missing.missingOptionCount,1);
  assert.equal(missing.catalogueComplete,false);
  assert.equal(missing.gateComplete,false);

  const duplicate=summarizePreviewOptionCoverage([sample,sample,approved[1]],ids);
  assert.equal(duplicate.duplicateOptionCount,1);
  assert.equal(duplicate.gateComplete,false);

  const unknown=summarizePreviewOptionCoverage([...approved,{...sample,id:"preview:collar:invented"}],ids);
  assert.equal(unknown.unknownOptionCount,1);
  assert.equal(unknown.gateComplete,false);

  const malformedReference=summarizePreviewOptionCoverage(approved,[ids[0],ids[0]]);
  assert.equal(malformedReference.catalogueComplete,false);
  assert.equal(malformedReference.gateComplete,false);
  assert.equal(summarizePreviewOptionCoverage(approved,[]).gateComplete,false);
});
