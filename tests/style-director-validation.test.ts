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
    handoffAuditId:"11111111-1111-4111-8111-111111111111",
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
    handoff_audit_id:"22222222-2222-4222-8222-222222222222",
    blocking_issue:false,
    created_at:"2026-10-01T10:00:00Z",
  }];
  const review=summarizeStyleDirectorValidation(tests,[{
    status:"review",required_positive_cases:1,signed_by:"Owner",created_at:"2026-10-01T11:00:00Z",
  }]);
  assert.equal(review.evidenceRecorded,true);
  assert.equal(review.validationComplete,false);

  const approved=summarizeStyleDirectorValidation(tests,[{
    status:"approved",required_positive_cases:1,signed_by:"Owner",created_at:"2026-10-01T12:00:00Z",
  }]);
  assert.equal(approved.validationComplete,true);
});

test("Style Director sign-off normalization requires human target and named reviewer",()=>{
  assert.throws(()=>normalizeStyleDirectorValidationSignoff({
    status:"approved",requiredPositiveCases:0,signedBy:"Owner",
  }),/documented positive-case target/i);
  assert.throws(()=>normalizeStyleDirectorValidationSignoff({
    status:"approved",requiredPositiveCases:2,signedBy:"",
  }),/Named owner\/reviewer sign-off/);
});


test("approved sign-off cannot complete validation below its documented clean-case target",()=>{
  const tests=[{
    case_id:"SD-THRESHOLD-1",device_class:"mobile",
    directions_understandable:true,directions_distinct:true,stock_handoff_worked:true,
    handoff_audit_id:"33333333-3333-4333-8333-333333333333",blocking_issue:false,
    created_at:"2026-10-01T10:00:00Z",
  }];
  const summary=summarizeStyleDirectorValidation(tests,[{
    status:"approved",required_positive_cases:2,signed_by:"Owner",created_at:"2026-10-01T12:00:00Z",
  }]);
  assert.equal(summary.positiveCases,1);
  assert.equal(summary.requiredPositiveCases,2);
  assert.equal(summary.thresholdMet,false);
  assert.equal(summary.validationComplete,false);
});

test("legacy approval without a documented clean-case target never completes validation",()=>{
  const tests=[{
    case_id:"SD-LEGACY",device_class:"desktop",
    directions_understandable:true,directions_distinct:true,stock_handoff_worked:true,blocking_issue:false,
    created_at:"2026-10-01T10:00:00Z",
  }];
  const summary=summarizeStyleDirectorValidation(tests,[{
    status:"approved",signed_by:"Owner",created_at:"2026-10-01T12:00:00Z",
  }]);
  assert.equal(summary.requiredPositiveCases,null);
  assert.equal(summary.validationComplete,false);
});


test("successful handoff observation requires a verified audit id",()=>{
  assert.throws(()=>normalizeStyleDirectorUserTest({
    caseId:"SD-HANDOFF",
    deviceClass:"mobile",
    directionsUnderstandable:true,
    directionsDistinct:true,
    stockHandoffWorked:true,
    handoffAuditId:"",
    blockingIssue:false,
  }),/handoff audit ID/i);
});

test("unverified handoff rows cannot count as clean Style Director evidence",()=>{
  const summary=summarizeStyleDirectorValidation([{
    case_id:"SD-UNVERIFIED",device_class:"mobile",
    directions_understandable:true,directions_distinct:true,stock_handoff_worked:true,
    blocking_issue:false,created_at:"2026-10-01T10:00:00Z",
  }],[{
    status:"approved",required_positive_cases:1,signed_by:"Owner",created_at:"2026-10-01T12:00:00Z",
  }]);
  assert.equal(summary.handoffCases,1);
  assert.equal(summary.verifiedHandoffCases,0);
  assert.equal(summary.positiveCases,0);
  assert.equal(summary.validationComplete,false);
});


test("duplicate handoff audit cannot inflate the Style Director clean-case count",()=>{
  const sharedAudit="44444444-4444-4444-8444-444444444444";
  const tests=[
    {
      case_id:"SD-DUPE-1",device_class:"mobile",
      directions_understandable:true,directions_distinct:true,stock_handoff_worked:true,
      handoff_audit_id:sharedAudit,blocking_issue:false,created_at:"2026-10-01T10:00:00Z",
    },
    {
      case_id:"SD-DUPE-2",device_class:"desktop",
      directions_understandable:true,directions_distinct:true,stock_handoff_worked:true,
      handoff_audit_id:sharedAudit,blocking_issue:false,created_at:"2026-10-01T10:01:00Z",
    },
  ];
  const summary=summarizeStyleDirectorValidation(tests,[{
    status:"approved",required_positive_cases:2,signed_by:"Owner",created_at:"2026-10-01T12:00:00Z",
  }]);
  assert.equal(summary.verifiedHandoffCases,2);
  assert.equal(summary.uniqueVerifiedHandoffs,1);
  assert.equal(summary.positiveCases,1);
  assert.equal(summary.thresholdMet,false);
  assert.equal(summary.validationComplete,false);
});

test("a blocking Style Director case prevents approval even when clean target is met",()=>{
  const clean={
    case_id:"SD-CLEAN",device_class:"mobile",
    directions_understandable:true,directions_distinct:true,
    stock_handoff_worked:true,handoff_audit_id:"55555555-5555-4555-8555-555555555555",
    blocking_issue:false,created_at:"2026-11-12T09:00:00Z",
  };
  const blocked={
    ...clean,case_id:"SD-BLOCKED",device_class:"desktop",
    handoff_audit_id:"66666666-6666-4666-8666-666666666666",
    blocking_issue:true,created_at:"2026-11-12T09:05:00Z",
  };
  const signoff={
    status:"approved",required_positive_cases:1,signed_by:"Owner",
    created_at:"2026-11-12T10:00:00Z",
  };
  const blockedSummary=summarizeStyleDirectorValidation([clean,blocked],[signoff]);
  assert.equal(blockedSummary.thresholdMet,true);
  assert.equal(blockedSummary.blockingCases,1);
  assert.equal(blockedSummary.validationComplete,false);

  // The latest observation for the same case supersedes the earlier defect.
  const resolved={
    ...blocked,blocking_issue:false,created_at:"2026-11-12T09:30:00Z",
  };
  const resolvedSummary=summarizeStyleDirectorValidation([clean,blocked,resolved],[signoff]);
  assert.equal(resolvedSummary.blockingCases,0);
  assert.equal(resolvedSummary.positiveCases,2);
  assert.equal(resolvedSummary.validationComplete,true);
});

test("Style Director approval must be renewed after new user-test evidence",()=>{
  const clean={
    case_id:"SD-RETEST",device_class:"mobile",
    directions_understandable:true,directions_distinct:true,
    stock_handoff_worked:true,handoff_audit_id:"77777777-7777-4777-8777-777777777777",
    blocking_issue:false,created_at:"2026-11-12T09:00:00Z",
  };
  const oldApproval={
    status:"approved",required_positive_cases:1,signed_by:"Owner",
    created_at:"2026-11-12T09:30:00Z",
  };
  const afterApproval={
    ...clean,case_id:"SD-NEW-TEST",
    handoff_audit_id:"88888888-8888-4888-8888-888888888888",
    created_at:"2026-11-12T10:00:00Z",
  };
  const stale=summarizeStyleDirectorValidation([clean,afterApproval],[oldApproval]);
  assert.equal(stale.thresholdMet,true);
  assert.equal(stale.blockingCases,0);
  assert.equal(stale.validationComplete,false);

  const fresh=summarizeStyleDirectorValidation([clean,afterApproval],[
    oldApproval,{...oldApproval,created_at:"2026-11-12T11:00:00Z"},
  ]);
  assert.equal(fresh.validationComplete,true);
});

test("unreviewed or malformed stored sign-off never reports validation complete",()=>{
  const clean={
    case_id:"SD-STORE",device_class:"tablet",
    directions_understandable:true,directions_distinct:true,
    stock_handoff_worked:true,handoff_audit_id:"99999999-9999-4999-8999-999999999999",
    blocking_issue:false,created_at:"2026-11-12T09:00:00Z",
  };
  const signoff={
    status:"approved",required_positive_cases:1,signed_by:"Owner",
    created_at:"2026-11-12T10:00:00Z",
  };
  assert.equal(summarizeStyleDirectorValidation([clean],[{...signoff,signed_by:" "}]).validationComplete,false);
  assert.equal(summarizeStyleDirectorValidation([clean],[{...signoff,required_positive_cases:0}]).validationComplete,false);
  assert.equal(summarizeStyleDirectorValidation([clean],[{...signoff,required_positive_cases:51}]).validationComplete,false);
  assert.equal(summarizeStyleDirectorValidation([clean],[{...signoff,created_at:"bad-date"}]).validationComplete,false);
  assert.equal(summarizeStyleDirectorValidation([{...clean,created_at:"bad-date"}],[signoff]).validationComplete,false);
});
