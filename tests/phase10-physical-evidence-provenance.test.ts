import test from "node:test";
import assert from "node:assert/strict";
import { hasVerifiedPhysicalEvidence, validateVerifiedPhysicalEvidence } from "../src/lib/physical-evidence-provenance.ts";

test("physical evidence requires an auditable source URL or evidence note",()=>{
  assert.equal(hasVerifiedPhysicalEvidence({verifiedGsm:145}),true);
  assert.throws(()=>validateVerifiedPhysicalEvidence({verifiedGsm:145}),/source URL or a short evidence note/i);
  assert.doesNotThrow(()=>validateVerifiedPhysicalEvidence({verifiedGsm:145,verifiedPhysicalEvidenceNote:"Owner weighed this roll with the shop GSM cutter."}));
  assert.doesNotThrow(()=>validateVerifiedPhysicalEvidence({verifiedFiberContent:"100% linen",verifiedPhysicalSourceUrl:"https://supplier.example/spec"}));
});

test("physical evidence source URL must be HTTPS",()=>{
  assert.throws(()=>validateVerifiedPhysicalEvidence({verifiedDrape:"Balanced",verifiedPhysicalSourceUrl:"http://supplier.example/spec"}),/must use HTTPS/i);
});

test("physical value ranges are bounded",()=>{
  assert.throws(()=>validateVerifiedPhysicalEvidence({verifiedGsm:10,verifiedPhysicalEvidenceNote:"Owner measured GSM."}),/between 20 and 1000/i);
  assert.throws(()=>validateVerifiedPhysicalEvidence({repeatRealMm:6000,verifiedPhysicalEvidenceNote:"Owner measured pattern repeat."}),/between 0 and 5000/i);
  assert.doesNotThrow(()=>validateVerifiedPhysicalEvidence({swatchRealWidthMm:250,verifiedPhysicalEvidenceNote:"Owner measured photographed swatch width."}));
  assert.throws(()=>validateVerifiedPhysicalEvidence({verifiedStructure:1.2,verifiedPhysicalEvidenceNote:"Owner ran a structure test."}),/between 0 and 1/i);
  assert.throws(()=>validateVerifiedPhysicalEvidence({verifiedBreathability:-0.1,verifiedPhysicalEvidenceNote:"Owner ran a breathability test."}),/between 0 and 1/i);
  assert.doesNotThrow(()=>validateVerifiedPhysicalEvidence({verifiedStructure:0,verifiedBreathability:1,verifiedWrinkleResistance:.65,verifiedStretch:.08,verifiedPhysicalEvidenceNote:"Owner recorded repeatable shop test indices."}));
});

test("supplied nonfinite or nonnumeric physical values fail validation instead of becoming unknown",()=>{
  const note="Owner recorded the fabric physical measurement.";
  assert.throws(()=>validateVerifiedPhysicalEvidence({verifiedGsm:Infinity,verifiedPhysicalEvidenceNote:note}),/finite number between 20 and 1000/i);
  assert.throws(()=>validateVerifiedPhysicalEvidence({verifiedGsm:"145" as never,verifiedPhysicalEvidenceNote:note}),/finite number/i);
  assert.throws(()=>validateVerifiedPhysicalEvidence({repeatRealMm:NaN,verifiedPhysicalEvidenceNote:note}),/finite number/i);
  assert.throws(()=>validateVerifiedPhysicalEvidence({swatchRealWidthMm:-Infinity,verifiedPhysicalEvidenceNote:note}),/finite number/i);
  assert.throws(()=>validateVerifiedPhysicalEvidence({verifiedDrape:"Rigid" as never,verifiedPhysicalEvidenceNote:note}),/Verified drape/i);
});

test("a protocol prefix alone is not an auditable HTTPS physical source",()=>{
  assert.throws(()=>validateVerifiedPhysicalEvidence({
    repeatRealMm:24,verifiedPhysicalSourceUrl:"https://",
  }),/valid URL/i);
  assert.doesNotThrow(()=>validateVerifiedPhysicalEvidence({
    repeatRealMm:24,verifiedPhysicalSourceUrl:"https://supplier.example/certificate/24",
  }));
});

test("padded physical receipts cannot bypass literal size limits at intake",()=>{
  const measurement={verifiedGsm:145,verifiedPhysicalEvidenceNote:"Owner measured the physical roll."};
  for(const [field,value] of [
    ["verifiedFiberContent"," ".repeat(221)+"100% linen"],
    ["verifiedPhysicalSourceUrl"," ".repeat(1801)+"https://supplier.example/lot"],
    ["verifiedPhysicalEvidenceNote"," ".repeat(501)+"Owner measured the physical roll."],
  ] as const){
    assert.throws(()=>validateVerifiedPhysicalEvidence({...measurement,[field]:value}),/allowed length/i,field);
  }
  assert.doesNotThrow(()=>validateVerifiedPhysicalEvidence({
    verifiedGsm:145,verifiedPhysicalEvidenceNote:"R".repeat(500),
  }));
});

test("malformed JSON text fields cannot become supplier proof",()=>{
  const evidence={verifiedGsm:145,verifiedPhysicalEvidenceNote:"Supplier checked this lot in person."};
  assert.equal(hasVerifiedPhysicalEvidence({verifiedFiberContent:["100% linen"] as never}),false);
  for(const field of ["verifiedFiberContent","verifiedPhysicalSourceUrl","verifiedPhysicalEvidenceNote"] as const){
    for(const malformed of [["https://supplier.example/report"],{value:"Physical roll certificate"}]){
      assert.throws(()=>validateVerifiedPhysicalEvidence({...evidence,[field]:malformed} as never),/text string/i,field);
    }
  }
  assert.throws(()=>validateVerifiedPhysicalEvidence({
    verifiedFiberContent:"100% cotton",verifiedPhysicalEvidenceNote:"Supplier measured physical fabric. ".repeat(30),
  }),/allowed length/i);
  assert.throws(()=>validateVerifiedPhysicalEvidence({
    verifiedFiberContent:"W".repeat(221),verifiedPhysicalEvidenceNote:"Supplier reviewed and measured this roll.",
  }),/allowed length/i);
  assert.throws(()=>validateVerifiedPhysicalEvidence({
    verifiedFiberContent:"   ",verifiedPhysicalEvidenceNote:"Supplier reviewed and measured this roll.",
  }),/whitespace-only/i);
  assert.doesNotThrow(()=>validateVerifiedPhysicalEvidence({
    verifiedFiberContent:"100% linen",verifiedPhysicalEvidenceNote:"Physical inspector reviewed this roll.",
  }));
});
