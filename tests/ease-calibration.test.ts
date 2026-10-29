import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeEaseEvidenceDraft,
  normalizeHouseEaseCalibrationDraft,
  requiredEaseEvidenceKeys,
  summarizeEaseEvidence,
  canApproveHouseEaseModel,
  approvedHouseEaseModelFromRow,
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


test("approved house ease row becomes a validated runtime model",()=>{
  const model=approvedHouseEaseModelFromRow({
    model_id:"model-1",
    version:"house-ease-approved-v1",
    shirt_table:HOUSE_SHIRT_EASE,
    trouser_table:HOUSE_TROUSER_EASE,
    note:"tailor-approved",
    status:"approved",
    approved_by:"RJ",
    approved_at:"2026-10-01T12:00:00Z",
  });
  assert.ok(model);
  assert.equal(model?.version,"house-ease-approved-v1");
  assert.equal(model?.approvedBy,"RJ");
  assert.equal(model?.table.shirt.regular.chest.min,HOUSE_SHIRT_EASE.regular.chest.min);
});

test("draft or malformed ease models cannot enter runtime",()=>{
  assert.equal(approvedHouseEaseModelFromRow({
    model_id:"model-1",
    version:"house-ease-draft-v1",
    shirt_table:HOUSE_SHIRT_EASE,
    trouser_table:HOUSE_TROUSER_EASE,
    status:"draft",
    approved_by:"RJ",
  }),null);
  assert.equal(approvedHouseEaseModelFromRow({
    model_id:"model-2",
    version:"house-ease-approved-v2",
    shirt_table:{},
    trouser_table:HOUSE_TROUSER_EASE,
    status:"approved",
    approved_by:"RJ",
  }),null);
});

test("physical ease cannot be forged with JSON-coerced measurements or truncated notes",()=>{
  const good={caseId:"EASE-001",garment:"shirt",fitClass:"regular",field:"chest",
    bodyCm:100,finishedCm:112.4,tailor:"RJ",garmentRef:"SHIRT-07",note:"Measured"};
  assert.equal(normalizeEaseEvidenceDraft(good).easeCm,12.4);
  assert.throws(()=>normalizeEaseEvidenceDraft({...good,bodyCm:"100"}),/centimetre/i);
  assert.throws(()=>normalizeEaseEvidenceDraft({...good,finishedCm:[112.4]}),/centimetre/i);
  assert.throws(()=>normalizeEaseEvidenceDraft({...good,garment:["shirt"]}),/Garment must/i);
  assert.throws(()=>normalizeEaseEvidenceDraft({...good,caseId:["EASE-001"]}),/literal text/i);
  assert.throws(()=>normalizeEaseEvidenceDraft({...good,tailor:["RJ"]}),/literal text/i);
  assert.throws(()=>normalizeEaseEvidenceDraft({...good,note:"x".repeat(1001)}),/too long/i);
});

test("house ease model rejects coerced physical range and silently truncated rationale",()=>{
  const good={version:"house-ease-test-v1",shirt:HOUSE_SHIRT_EASE,trouser:HOUSE_TROUSER_EASE,note:"Tailor-reviewed"};
  assert.equal(normalizeHouseEaseCalibrationDraft(good).version,"house-ease-test-v1");
  assert.throws(()=>normalizeHouseEaseCalibrationDraft({...good,version:["house-ease-test-v1"]}),/literal text/i);
  assert.throws(()=>normalizeHouseEaseCalibrationDraft({...good,note:"x".repeat(1201)}),/too long/i);
  const shirt={...HOUSE_SHIRT_EASE,regular:{...HOUSE_SHIRT_EASE.regular,
    chest:{...HOUSE_SHIRT_EASE.regular.chest,min:"2"}}};
  assert.throws(()=>normalizeHouseEaseCalibrationDraft({...good,shirt}),/invalid ease range/i);
});

test("coerced database ease evidence cannot complete all 35 physical cells",()=>{
  const rows=requiredEaseEvidenceKeys().map((key,index)=>{
    const [garment,fit_class,field]=key.split(":");
    return {garment,fit_class,field,case_id:"CASE-"+index,ease_cm:5};
  });
  assert.equal(summarizeEaseEvidence(rows).evidenceCoverageComplete,true);
  assert.equal(summarizeEaseEvidence(rows.map((row)=>({...row,ease_cm:"5"}))).evidenceCoverageComplete,false);
  assert.equal(summarizeEaseEvidence(rows.map((row)=>({...row,case_id:[row.case_id]}))).evidenceCoverageComplete,false);
});

test("house ease operator POST bounds JSON and requires confirmed UUID/boolean RPC receipts",()=>{
  const source=readFileSync("src/app/api/operator/ease-calibration/route.ts","utf8");
  assert.match(source,/secureJsonRequestError\(request,16384\)/);
  assert.match(source,/readSecureJsonObject\(request,16384\)/);
  assert.match(source,/normalizeVaultId\(receipt\)/);
  assert.match(source,/receipt!==true/);
  assert.doesNotMatch(source,/request\.json\(\)/);
  assert.doesNotMatch(source,/Boolean\(updated\)/);
});
