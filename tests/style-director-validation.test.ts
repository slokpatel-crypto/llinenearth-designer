import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStyleDirectorUserTest,
  normalizeStyleDirectorValidationSignoff,
  summarizeStyleDirectorValidation,
} from "../src/lib/designer/style-director-validation.ts";

test("Style Director user tests require all explicit observations",()=>{
  assert.throws(()=>normalizeStyleDirectorUserTest({
    caseId:"SD-001",
    deviceClass:"mobile",
    directionsUnderstandable:true,
  }),/Every Style Director validation result/);
});

test("blocking Style Director user tests require evidence note",()=>{
  assert.throws(()=>normalizeStyleDirectorUserTest({
    caseId:"SD-002",
    deviceClass:"desktop",
    directionsUnderstandable:false,
    directionsDistinct:false,
    stockHandoffWorked:true,
    blockingIssue:true,
    note:"",
  }),/require a short note/i);
});

test("Style Director validation requires real evidence plus human approval",()=>{
  const tests=[{
    case_id:"SD-003",
    device_class:"mobile",
    directions_understandable:true,
    directions_distinct:true,
    stock_handoff_worked:true,
    blocking_issue:false,
    created_at:"2026-10-01T10:00:00Z",
  }];
  const review=summarizeStyleDirectorValidation(tests,[{
    status:"review",signed_by:"Owner",created_at:"2026-10-01T11:00:00Z",
  }]);
  assert.equal(review.evidenceRecorded,true);
  assert.equal(review.validationComplete,false);

  const approved=summarizeStyleDirectorValidation(tests,[{
    status:"approved",signed_by:"Owner",created_at:"2026-10-01T12:00:00Z",
  }]);
  assert.equal(approved.validationComplete,true);
});

test("Style Director sign-off normalization requires named human reviewer",()=>{
  assert.throws(()=>normalizeStyleDirectorValidationSignoff({
    status:"approved",signedBy:"",
  }),/Named owner\/reviewer sign-off/);
});
