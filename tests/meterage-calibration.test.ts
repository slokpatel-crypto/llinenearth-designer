import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMeterageCalibrationDraft,
  normalizeProductionCutEvidenceDraft,
  meterageForWidth,
  canApproveMeterageModel,
  verifiedMeterageEvidenceCase,
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
