import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FINISHED_GARMENT_QC_CHECKS, normalizeFinishedGarmentQcDraft, latestQcDecision } from "../src/lib/designer/finished-garment-qc.ts";

function passingChecks(){
  return Object.fromEntries(FINISHED_GARMENT_QC_CHECKS.map((item)=>[item.id,true]));
}

test("finished garment approval requires named provenance and every physical QC check",()=>{
  assert.throws(()=>normalizeFinishedGarmentQcDraft({
    decision:"approved",checks:passingChecks(),inspector:"",inspectionReference:"QC-001",
  }),/Named inspector/i);
  assert.throws(()=>normalizeFinishedGarmentQcDraft({
    decision:"approved",checks:passingChecks(),inspector:"SP",inspectionReference:"",
  }),/inspection reference/i);
  assert.throws(()=>normalizeFinishedGarmentQcDraft({
    decision:"approved",checks:{...passingChecks(),pattern_alignment:false},inspector:"SP",inspectionReference:"QC-001",
  }),/Every finished-garment QC check/);
});

test("rework requires a recorded reason",()=>{
  assert.throws(()=>normalizeFinishedGarmentQcDraft({
    decision:"rework",checks:{},defects:[],note:"",inspector:"SP",inspectionReference:"QC-REWORK-1",
  }),/at least one defect/i);
});

test("approved QC normalizes fields",()=>{
  const result=normalizeFinishedGarmentQcDraft({
    decision:"approved",checks:passingChecks(),defects:["stitching","stitching"],
    note:" Final inspection passed. ",inspector:" SP ",inspectionReference:" Tailor QC sheet 42 ",
  });
  assert.equal(result.decision,"approved");
  assert.deepEqual(result.defects,["stitching"]);
  assert.equal(result.note,"Final inspection passed.");
  assert.equal(result.inspector,"SP");
  assert.equal(result.inspectionReference,"Tailor QC sheet 42");
});

test("latest QC decision follows inspection time",()=>{
  assert.equal(latestQcDecision([
    {decision:"approved",created_at:"2026-10-01T10:00:00Z"},
    {decision:"rework",created_at:"2026-10-01T11:00:00Z"},
  ]),"rework");
});

test("QC refuses lossy or coerced physical inspector identities and references",()=>{
  const base={decision:"approved",checks:passingChecks(),inspector:"Quality Checker",inspectionReference:"QC batch 001"};
  for(const inspector of ["a".repeat(121),["Quality Checker"],{name:"Quality Checker"},false]){
    assert.throws(()=>normalizeFinishedGarmentQcDraft({...base,inspector}),/Named inspector/,JSON.stringify(inspector));
  }
  for(const inspectionReference of ["r".repeat(241),["QC batch 001"],{id:"QC batch 001"},false]){
    assert.throws(()=>normalizeFinishedGarmentQcDraft({...base,inspectionReference}),/Physical inspection reference/,JSON.stringify(inspectionReference));
  }
  assert.equal(normalizeFinishedGarmentQcDraft({...base,inspector:"Q".repeat(120)}).inspector.length,120);
  assert.equal(normalizeFinishedGarmentQcDraft({...base,inspectionReference:"R".repeat(240)}).inspectionReference.length,240);
});

test("finished-garment QC rejects coerced or silently discarded release evidence",()=>{
  const base={decision:"approved",checks:passingChecks(),defects:[],note:"Checked against garment",inspector:"Quality Checker",inspectionReference:"QC sheet 123"};
  for(const decision of [["approved"],{value:"approved"},true,null,1]){
    assert.throws(()=>normalizeFinishedGarmentQcDraft({...base,decision}),/QC decision/,JSON.stringify(decision));
  }
  for(const note of [["Looks fine"],{text:"Looks fine"},false,42,"x".repeat(1201)]){
    assert.throws(()=>normalizeFinishedGarmentQcDraft({...base,note}),/QC note/,JSON.stringify(note));
  }
  for(const defects of [[["stitching"]],["invented"],["stitching",true],["stitching".repeat(30)],"stitching",Array(13).fill("stitching")]){
    assert.throws(()=>normalizeFinishedGarmentQcDraft({...base,defects}),/QC defects/,JSON.stringify(defects));
  }
  for(const checks of [[true],{recipe_match:"true"},{invented:true},{...passingChecks(),fabric_match:1},null]){
    assert.throws(()=>normalizeFinishedGarmentQcDraft({...base,checks}),/QC checks/,JSON.stringify(checks));
  }
  assert.equal(normalizeFinishedGarmentQcDraft({...base,note:"n".repeat(1200)}).note.length,1200);
  assert.deepEqual(normalizeFinishedGarmentQcDraft({...base,defects:["stitching","stitching"]}).defects,["stitching"]);
});

test("privileged finished-garment QC endpoint refuses forged identities and unconfirmed database receipts",()=>{
  const source=readFileSync("src/app/api/operator/garment-qc/route.ts","utf8");
  const http=readFileSync("scripts/verify-customer-production-boundary.cjs","utf8");
  assert.match(source,/secureJsonRequestError\(request,16384\)/);
  assert.match(source,/readSecureJsonObject\(request,16384\)/);
  assert.match(source,/normalizeVaultId\(body\.orderId\)/);
  assert.match(source,/normalizeVaultId\(receipt\)/);
  assert.match(source,/if\(!inspectionId\) return respond\(/);
  assert.match(source,/error instanceof SecureJsonBodyTooLarge/);
  assert.match(source,/error instanceof SecureJsonBodyInvalid/);
  assert.match(source,/private, no-store/);
  assert.doesNotMatch(source,/String\(body\.(?:action|orderId)/);
  assert.match(http,/\/api\/operator\/garment-qc/);
});
