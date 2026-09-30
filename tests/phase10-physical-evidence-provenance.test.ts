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
});
