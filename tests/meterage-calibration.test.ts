import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMeterageCalibrationDraft,
  normalizeProductionCutEvidenceDraft,
  meterageForWidth,
  canApproveMeterageModel,
  verifiedMeterageEvidenceCase,
  distinctMeasuredCutCaseIds,
} from "../src/lib/designer/meterage-calibration.ts";

test("meterage calibration rejects overlapping width bands",()=>{
  assert.throws(()=>normalizeMeterageCalibrationDraft({
    garment:"shirt",version:"shirt-v1",
    bands:[
      {label:"narrow",minFabricWidthCm:90,maxFabricWidthCm:120,baseMetres:2.1,patternAllowanceMetres:.2},
      {label:"overlap",minFabricWidthCm:120,maxFabricWidthCm:150,baseMetres:1.8,patternAllowanceMetres:.2},
    ],
  }),/must not overlap/);
});

test("meterage lookup only uses an explicit approved table band",()=>{
  const draft=normalizeMeterageCalibrationDraft({
    garment:"shirt",version:"shirt-v1",
    bands:[{label:"standard",minFabricWidthCm:140,maxFabricWidthCm:160,baseMetres:1.8,patternAllowanceMetres:.25}],
  });
  assert.deepEqual(meterageForWidth(draft.bands,150,true),{
    bandLabel:"standard",metres:2.05,baseMetres:1.8,patternAllowanceMetres:.25,
  });
  assert.equal(meterageForWidth(draft.bands,130,false),null);
});

test("approval requires at least twenty real evidence cases and a named approver",()=>{
  assert.equal(canApproveMeterageModel(19,"Tailor"),false);
  assert.equal(canApproveMeterageModel(20,""),false);
  assert.equal(canApproveMeterageModel(20,"RJ"),true);
});


test("legacy production usage cannot count as verified meterage evidence",()=>{
  assert.equal(verifiedMeterageEvidenceCase({
    subtype:"production_usage_case",version:"production-usage-v1",caseId:"CUT-001",
    garment:"shirt",fabricWidthCm:150,actualMetres:1.8,
    checkedBy:"RJ",evidenceReference:"Cut ticket 001",
  },"shirt"),null);
});

test("verified meterage evidence requires physical checker and reference",()=>{
  assert.equal(verifiedMeterageEvidenceCase({
    subtype:"production_usage_case",version:"production-usage-v2",caseId:"CUT-002",
    garment:"shirt",fabricWidthCm:150,actualMetres:1.8,
    checkedBy:"",evidenceReference:"",
  },"shirt"),null);
  const evidence=verifiedMeterageEvidenceCase({
    subtype:"production_usage_case",version:"production-usage-v2",caseId:"CUT-003",
    garment:"shirt",fabricWidthCm:150,actualMetres:1.85,
    checkedBy:"RJ",evidenceReference:"Tailor cut ticket 003",
  },"shirt");
  assert.equal(evidence?.caseId,"CUT-003");
  assert.equal(evidence?.checkedBy,"RJ");
  assert.equal(evidence?.evidenceReference,"Tailor cut ticket 003");
});

test("meterage evidence cannot be reused across garment classes",()=>{
  const payload={
    subtype:"production_usage_case",version:"production-usage-v2",caseId:"CUT-004",
    garment:"trouser",fabricWidthCm:150,actualMetres:1.4,
    checkedBy:"RJ",evidenceReference:"Tailor cut ticket 004",
  };
  assert.equal(verifiedMeterageEvidenceCase(payload,"shirt"),null);
  assert.equal(verifiedMeterageEvidenceCase(payload,"trouser")?.garment,"trouser");
});


test("production cut evidence draft requires a real order and physical provenance",()=>{
  assert.throws(()=>normalizeProductionCutEvidenceDraft({
    caseId:"CUT-ORDER-1",orderId:"not-a-uuid",garment:"shirt",fabricId:"shirt-1",
    fabricWidthCm:150,actualMetres:1.8,checkedBy:"RJ",evidenceReference:"Cut ticket 1",
  }),/production order ID/i);
  assert.throws(()=>normalizeProductionCutEvidenceDraft({
    caseId:"CUT-ORDER-1",orderId:"11111111-1111-4111-8111-111111111111",garment:"shirt",fabricId:"shirt-1",
    fabricWidthCm:150,actualMetres:1.8,checkedBy:"",evidenceReference:"",
  }),/tailor or checker/i);
  const draft=normalizeProductionCutEvidenceDraft({
    caseId:"CUT-ORDER-1",orderId:"11111111-1111-4111-8111-111111111111",garment:"shirt",fabricId:"shirt-1",
    fabricWidthCm:150.126,actualMetres:1.8126,patternRepeatMm:12.345,patternMatching:true,
    cutContext:" Regular full sleeve ",checkedBy:" Rajesh Jain ",evidenceReference:" Job card 118 ",
  });
  assert.equal(draft.fabricWidthCm,150.13);
  assert.equal(draft.actualMetres,1.813);
  assert.equal(draft.patternRepeatMm,12.35);
  assert.equal(draft.checkedBy,"Rajesh Jain");
  assert.equal(draft.evidenceReference,"Job card 118");
});

test("production cut evidence rejects implausible physical usage",()=>{
  const base={
    caseId:"CUT-ORDER-2",orderId:"22222222-2222-4222-8222-222222222222",garment:"trouser",fabricId:"pant-1",
    checkedBy:"RJ",evidenceReference:"Cut sheet 22",
  };
  assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,fabricWidthCm:40,actualMetres:1.5}),/Fabric width/i);
  assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,fabricWidthCm:150,actualMetres:0}),/Actual cloth usage/i);
});

test("real cutting case IDs must be independent within each garment class",()=>{
  const rows=Array.from({length:20},(_,i)=>({
    case_id:`LE-CUT-${String(i+1).padStart(2,"0")}`,garment:"shirt",
  }));
  assert.equal(distinctMeasuredCutCaseIds(rows,"shirt")?.length,20);
  assert.deepEqual(distinctMeasuredCutCaseIds(rows,"trouser"),[]);
  for(const variant of [
    [...rows,{case_id:"le-cut-01",garment:"shirt"}],
    [...rows,{case_id:rows[0].case_id,garment:"shirt"}],
    [...rows,{case_id:"x".repeat(81),garment:"shirt"}],
    [...rows,{case_id:null,garment:"shirt"}],
  ])assert.equal(distinctMeasuredCutCaseIds(variant,"shirt"),null);
  assert.equal(distinctMeasuredCutCaseIds({}, "shirt"),null);
});

test("cutting normalizer rejects aliased real fabric and case identities",()=>{
  const base={
    caseId:"CUT-ORDER-VALID",
    orderId:"11111111-1111-4111-8111-111111111111",
    garment:"shirt",fabricId:"linen-formal-60",
    fabricWidthCm:150,actualMetres:1.8,
    checkedBy:"Tailor RJ",evidenceReference:"physical-cut-ticket-12",
  };
  for(const caseId of ["x".repeat(80)+"-other","y".repeat(81)]){
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,caseId}),/Anonymous cut case ID/);
  }
  for(const fabricId of ["z".repeat(160)+"-different",null,1234]){
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,fabricId}),/Locked fabric ID/);
  }
  for(const field of ["checkedBy","evidenceReference"]){
    const invalid={...base,[field]:"q".repeat(field==="checkedBy"?121:241)};
    assert.throws(()=>normalizeProductionCutEvidenceDraft(invalid),
      field==="checkedBy"?/Named tailor or checker/:/Physical cutting evidence reference/);
  }
});

test("stored usage cases with truncated or missing original provenance cannot count toward twenty",()=>{
  const input={
    subtype:"production_usage_case",version:"production-usage-v2",caseId:"CUT-0123",
    garment:"shirt",fabricWidthCm:150,actualMetres:1.8,
    checkedBy:"Tailor RJ",evidenceReference:"physical-cut-ticket-12",
  };
  for(const invalid of [
    {...input,caseId:"c".repeat(81)},
    {...input,checkedBy:"d".repeat(121)},
    {...input,evidenceReference:"e".repeat(241)},
  ])assert.equal(verifiedMeterageEvidenceCase(invalid,"shirt"),null);
});

test("calibration versions and width band labels cannot be aliased by truncation",()=>{
  const valid={garment:"shirt",version:"linen-shirting-v1",
    bands:[{label:"standard",minFabricWidthCm:140,maxFabricWidthCm:160,baseMetres:1.8,patternAllowanceMetres:.25}]};
  assert.throws(()=>normalizeMeterageCalibrationDraft({...valid,version:"v".repeat(80)+"different"}),/Version must be/);
  assert.throws(()=>normalizeMeterageCalibrationDraft({...valid,bands:[{
    ...valid.bands[0],label:"a".repeat(81),
  }]}),/label of at most 80/);
});

test("production-calibration routes consume de-duplicated physical evidence subjects",async()=>{
  const {readFileSync}=await import("node:fs");
  const record=readFileSync("src/app/api/operator/production-calibration/route.ts","utf8");
  const model=readFileSync("src/app/api/operator/meterage-model/route.ts","utf8");
  assert.ok(record.includes('distinctMeasuredCutCaseIds(rows,"shirt")'));
  assert.ok(record.includes('distinctMeasuredCutCaseIds(rows,"trouser")'));
  assert.ok(record.includes("shirtIds!==null&&trouserIds!==null"));
  assert.ok(model.includes("distinctMeasuredCutCaseIds(rows,garment)"));
  assert.ok(model.includes("if(identities===null) throw new Error"));
});

test("physical cut receipts reject JSON-coerced numbers, repeat, matching and notes",()=>{
  const base={caseId:"CUT-ORDER-VALID",orderId:"11111111-1111-4111-8111-111111111111",
    garment:"shirt",fabricId:"linen-formal-60",fabricWidthCm:150,actualMetres:1.8,
    checkedBy:"Tailor RJ",evidenceReference:"physical-cut-ticket-12"};
  for(const value of [null,false,true,"150","",[],{}]){
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,fabricWidthCm:value}),/Fabric width/);
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,actualMetres:value}),/Actual cloth usage/);
  }
  for(const value of [false,true,"12.3",[],{},-1,0])
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,patternRepeatMm:value}),/Pattern repeat/);
  for(const value of ["true",1,null,[],{}])
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,patternMatching:value}),/Pattern matching/);
  for(const value of [["shirt"],{label:"shirt"},true])
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,garment:value}),/Garment must/);
  for(const value of [["CUT-ORDER-VALID"],{id:"CUT-ORDER-VALID"}])
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,caseId:value}),/Anonymous cut case ID/);
  for(const value of [["cut"],{},true,"c".repeat(161)])
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,cutContext:value}),/Cut context/);
  for(const value of [["note"],{},true,"n".repeat(1201)])
    assert.throws(()=>normalizeProductionCutEvidenceDraft({...base,note:value}),/Cut evidence note/);
  assert.equal(normalizeProductionCutEvidenceDraft({...base,patternRepeatMm:null,patternMatching:false,note:"n".repeat(1200)}).note.length,1200);
});
test("production cut API requires a confirmed UUID and bounded operator JSON",async()=>{
  const {readFileSync}=await import("node:fs");
  const route=readFileSync("src/app/api/operator/production-calibration/route.ts","utf8");
  const http=readFileSync("scripts/verify-customer-production-boundary.cjs","utf8");
  assert.match(route,/secureJsonRequestError\(request,16384\)/);
  assert.match(route,/readSecureJsonObject\(request,16384\)/);
  assert.match(route,/normalizeVaultId\(receipt\)/);
  assert.match(route,/if\(!evidenceId\) return respond\(/);
  assert.match(route,/error instanceof SecureJsonBodyTooLarge/);
  assert.match(route,/error instanceof SecureJsonBodyInvalid/);
  assert.match(route,/private, no-store/);
  assert.match(http,/\/api\/operator\/production-calibration/);
});

test("meterage model bands refuse coerced physical values and silently truncated provenance",()=>{
  const base={garment:"shirt",version:"linen-shirting-v1",
    bands:[{label:"standard",minFabricWidthCm:140,maxFabricWidthCm:160,baseMetres:1.8,patternAllowanceMetres:.25}]};
  for(const garment of [["shirt"],{value:"shirt"},true])
    assert.throws(()=>normalizeMeterageCalibrationDraft({...base,garment}),/Garment must/);
  for(const version of [["linen-shirting-v1"],{value:"linen-shirting-v1"}])
    assert.throws(()=>normalizeMeterageCalibrationDraft({...base,version}),/Version must/);
  for(const key of ["minFabricWidthCm","maxFabricWidthCm","baseMetres","patternAllowanceMetres"]){
    for(const value of [null,false,true,"1.8",[],{}]){
      const band={...base.bands[0],[key]:value};
      assert.throws(()=>normalizeMeterageCalibrationDraft({...base,bands:[band]}),/Band 1/);
    }
  }
  for(const label of [["standard"],{text:"standard"}])
    assert.throws(()=>normalizeMeterageCalibrationDraft({...base,bands:[{...base.bands[0],label}]}),/Band 1/);
  for(const cutContext of [["cut"],{text:"cut"},true,"c".repeat(161)])
    assert.throws(()=>normalizeMeterageCalibrationDraft({...base,bands:[{...base.bands[0],cutContext}]}),/cut context/);
  for(const note of [["note"],{text:"note"},true,"n".repeat(1201)])
    assert.throws(()=>normalizeMeterageCalibrationDraft({...base,note}),/Meterage model note/);
  assert.equal(normalizeMeterageCalibrationDraft({...base,note:"n".repeat(1200)}).note.length,1200);
});

test("meterage approval/retirement API requires strict human identity and confirmed database changes",async()=>{
  const {readFileSync}=await import("node:fs");
  const route=readFileSync("src/app/api/operator/meterage-model/route.ts","utf8");
  const http=readFileSync("scripts/verify-customer-production-boundary.cjs","utf8");
  assert.match(route,/secureJsonRequestError\(request,16384\)/);
  assert.match(route,/readSecureJsonObject\(request,16384\)/);
  assert.match(route,/normalizeVaultId\(body\.modelId\)/);
  assert.match(route,/normalizeVaultId\(receipt\)/);
  assert.match(route,/updated!==true/);
  assert.match(route,/error instanceof SecureJsonBodyTooLarge/);
  assert.match(route,/error instanceof SecureJsonBodyInvalid/);
  assert.match(route,/private, no-store/);
  assert.match(http,/\/api\/operator\/meterage-model/);
});
