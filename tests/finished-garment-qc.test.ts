import test from "node:test";
import assert from "node:assert/strict";
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
    decision:"approved",checks:passingChecks(),defects:["stitching","not-real"],
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
