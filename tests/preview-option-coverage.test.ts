import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("duplicate option identities cannot inflate an all-approved release gate",()=>{
  const approved={id:"preview:collar:point",styleKey:"collar",label:"Point",
    livePreview:"exact" as const,constructionStatus:"approved" as const,previewStatus:"approved" as const};
  const result=summarizePreviewOptionCoverage([approved,{...approved,label:"Conflicting point"}]);
  assert.equal(result.total,2);
  assert.equal(result.invalidRows,1);
  assert.equal(result.fullyCleared,1);
  assert.equal(result.coveragePercent,50);
  assert.equal(result.gateComplete,false);
});

test("malformed support/status and incomplete identities never count as approved",()=>{
  const approved={id:"a",styleKey:"collar",label:"Point",
    livePreview:"exact",constructionStatus:"approved",previewStatus:"approved"};
  const corrupt=[
    {...approved,id:" "},
    {...approved,id:"b",livePreview:"unsupported"},
    {...approved,id:"c",constructionStatus:"maybe"},
    {...approved,id:"d",previewStatus:"yes"},
    {...approved,id:"e",label:""},
    null,
  ];
  const result=summarizePreviewOptionCoverage(corrupt as unknown as Parameters<typeof summarizePreviewOptionCoverage>[0]);
  assert.equal(result.invalidRows,corrupt.length);
  assert.equal(result.fullyCleared,0);
  assert.equal(result.gateComplete,false);
});

test("missing runtime coverage data cannot be mistaken for a completed gate",()=>{
  const result=summarizePreviewOptionCoverage(null as unknown as Parameters<typeof summarizePreviewOptionCoverage>[0]);
  assert.equal(result.total,0);
  assert.equal(result.invalidRows,0);
  assert.equal(result.gateComplete,false);
});

test("operator UI visibly reports invalid or duplicate preview evidence",()=>{
  const source=readFileSync("src/app/operator/preview-option-coverage/PreviewOptionCoverageClient.tsx","utf8");
  assert.match(source,/INVALID \/ DUPLICATE/);
  assert.match(source,/summary\?\.invalidRows/);
  assert.match(source,/role="alert"/);
});

test("approved approximations cannot complete the strict photographic accuracy gate",()=>{
  const result=summarizePreviewOptionCoverage([
    {id:"preview:collar:point",styleKey:"collar",label:"Point",livePreview:"exact",constructionStatus:"approved",previewStatus:"approved"},
    {id:"preview:trouser:wide",styleKey:"trouser",label:"Wide",livePreview:"approximate",constructionStatus:"not_required",previewStatus:"approved"},
  ]);
  assert.equal(result.gateComplete,true,"existing customer exploration approval remains separate");
  assert.equal(result.exactlyCleared,1);
  assert.equal(result.exactPercent,50);
  assert.equal(result.accuracyGateComplete,false);
});

test("strict photo accuracy requires every row exact and independently approved",()=>{
  const result=summarizePreviewOptionCoverage([
    {id:"a",styleKey:"collar",label:"Point",livePreview:"exact",constructionStatus:"approved",previewStatus:"approved"},
    {id:"b",styleKey:"shirtWear",label:"Tucked",livePreview:"exact",constructionStatus:"not_required",previewStatus:"approved"},
  ]);
  assert.equal(result.exactlyCleared,2);
  assert.equal(result.exactPercent,100);
  assert.equal(result.accuracyGateComplete,true);
  const invalid=summarizePreviewOptionCoverage([
    {id:"a",styleKey:"collar",label:"Point",livePreview:"exact",constructionStatus:"approved",previewStatus:"approved"},
    {id:"a",styleKey:"collar",label:"Point",livePreview:"exact",constructionStatus:"approved",previewStatus:"approved"},
  ]);
  assert.equal(invalid.accuracyGateComplete,false,"duplicate evidence cannot certify exactness");
});

test("operator surface distinguishes exactness from usable approximate coverage",()=>{
  const source=readFileSync("src/app/operator/preview-option-coverage/PreviewOptionCoverageClient.tsx","utf8");
  assert.match(source,/EXACT ACCURACY/);
  assert.match(source,/accuracyGateComplete/);
  assert.match(source,/PHOTO-EXACT/);
});
