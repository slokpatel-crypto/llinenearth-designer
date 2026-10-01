import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEaseEvidenceDraft,
  normalizeHouseEaseCalibrationDraft,
  requiredEaseEvidenceKeys,
  summarizeEaseEvidence,
  canApproveHouseEaseModel,
} from "../src/lib/designer/ease-calibration.ts";
import { HOUSE_SHIRT_EASE,HOUSE_TROUSER_EASE } from "../src/lib/designer/house-ease.ts";

test("finished garment evidence computes observed ease without inventing a target",()=>{
  const result=normalizeEaseEvidenceDraft({
    caseId:"EASE-001",garment:"shirt",fitClass:"regular",field:"chest",
    bodyCm:100,finishedCm:112.4,tailor:"RJ",garmentRef:"SHIRT-07",
  });
  assert.equal(result.easeCm,12.4);
  assert.equal(result.fitClass,"regular");
});

test("ease evidence rejects mismatched garment classes and fields",()=>{
  assert.throws(()=>normalizeEaseEvidenceDraft({
    caseId:"EASE-002",garment:"shirt",fitClass:"wide",field:"chest",
    bodyCm:100,finishedCm:112,tailor:"RJ",garmentRef:"SHIRT-08",
  }),/Fit class/);
  assert.throws(()=>normalizeEaseEvidenceDraft({
    caseId:"EASE-003",garment:"trouser",fitClass:"flat",field:"bicep",
    bodyCm:55,finishedCm:60,tailor:"RJ",garmentRef:"TROUSER-01",
  }),/Measurement field/);
});

test("replacement table must preserve the complete current house-ease contract",()=>{
  const draft=normalizeHouseEaseCalibrationDraft({
    version:"house-ease-test-v1",
    shirt:HOUSE_SHIRT_EASE,
    trouser:HOUSE_TROUSER_EASE,
  });
  assert.equal(draft.shirt.regular.chest.min,HOUSE_SHIRT_EASE.regular.chest.min);
  assert.equal(draft.trouser.pleated.seat.max,HOUSE_TROUSER_EASE.pleated.seat.max);
  assert.equal(requiredEaseEvidenceKeys().length,35);
});

test("evidence coverage completes only when every current table cell is represented",()=>{
  const keys=requiredEaseEvidenceKeys();
  const rows=keys.map((key,index)=>{
    const [garment,fit_class,field]=key.split(":");
    return {garment,fit_class,field,case_id:"CASE-"+index,ease_cm:5};
  });
  const complete=summarizeEaseEvidence(rows);
  assert.equal(complete.requiredCells,35);
  assert.equal(complete.coveredCells,35);
  assert.equal(complete.evidenceCoverageComplete,true);

  const incomplete=summarizeEaseEvidence(rows.slice(0,-1));
  assert.equal(incomplete.evidenceCoverageComplete,false);
  assert.equal(incomplete.uncoveredCells.length,1);
});

test("house ease approval needs complete evidence coverage and named human",()=>{
  assert.equal(canApproveHouseEaseModel({evidenceCoverageComplete:false,approvedBy:"RJ"}),false);
  assert.equal(canApproveHouseEaseModel({evidenceCoverageComplete:true,approvedBy:""}),false);
  assert.equal(canApproveHouseEaseModel({evidenceCoverageComplete:true,approvedBy:"RJ"}),true);
});
