import test from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_CHECKLIST_ITEMS,
  normalizeBetaAttempt,
  normalizeVerifiedBetaAttempt,
  normalizeLaunchChecklistDecision,
  summarizeLaunchReadiness,
} from "../src/lib/designer/launch-readiness-evidence.ts";

test("blocking beta attempt requires a note",()=>{
  assert.throws(()=>normalizeBetaAttempt({
    caseId:"BETA-001",deviceClass:"mobile",
    designLocked:true,shareOrEnquiryCompleted:false,blockingBug:true,note:"",
  }),/require a short note/i);
});

test("share or enquiry cannot be marked complete before design lock",()=>{
  assert.throws(()=>normalizeBetaAttempt({
    caseId:"BETA-002",deviceClass:"mobile",
    designLocked:false,shareOrEnquiryCompleted:true,blockingBug:false,note:"",
  }),/requires a locked design/i);
});

test("launch checklist approval requires named human sign-off",()=>{
  assert.throws(()=>normalizeLaunchChecklistDecision({
    itemId:"privacy_notice",status:"approved",signedBy:"",
  }),/human sign-off/i);
});

test("latest attempt per anonymous beta case controls the five-customer lock-flow gate",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"BETA-"+index,device_class:index%2?"mobile":"desktop",
    core_flow_completed:true,design_locked:true,share_or_enquiry_completed:true,revision_id:"REV-"+index,share_audit_confirmed:true,blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  attempts.push({
    case_id:"BETA-0",device_class:"desktop",
    core_flow_completed:false,design_locked:true,share_or_enquiry_completed:false,revision_id:"REV-0-RETRY",share_audit_confirmed:false,blocking_bug:true,
    created_at:"2026-10-10T10:00:00Z",
  });
  const summary=summarizeLaunchReadiness(attempts,[]);
  assert.equal(summary.successfulBetaCases,4);
  assert.equal(summary.betaGateComplete,false);
});

test("generic legacy completion cannot satisfy the stricter lock to share enquiry gate",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"LEGACY-"+index,device_class:"mobile",
    core_flow_completed:true,blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  assert.equal(summarizeLaunchReadiness(attempts,[]).betaGateComplete,false);
});

test("launch evidence completes only when exact flow and checklist gates both pass",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"BETA-"+index,device_class:"mobile",
    core_flow_completed:true,design_locked:true,share_or_enquiry_completed:true,
    revision_id:"REV-CLEAN-"+index,share_audit_confirmed:true,blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  const checklist=LAUNCH_CHECKLIST_ITEMS.map((item,index)=>({
    item_id:item.id,status:"approved",signed_by:"Owner Reviewer",created_at:"2026-10-"+String(index+10).padStart(2,"0")+"T10:00:00Z",
  }));
  assert.equal(summarizeLaunchReadiness(attempts,checklist).launchEvidenceComplete,true);
});


test("verified beta attempt requires a locked revision id",()=>{
  assert.throws(()=>normalizeVerifiedBetaAttempt({
    caseId:"BETA-VERIFY",deviceClass:"mobile",revisionId:"",blockingBug:false,
  }),/Locked revision ID/i);
  const result=normalizeVerifiedBetaAttempt({
    caseId:"BETA-VERIFY",deviceClass:"mobile",revisionId:"REV-123",evidenceKind:"enquiry",blockingBug:false,
  });
  assert.equal(result.revisionId,"REV-123");
  assert.equal(result.evidenceKind,"enquiry");
});

test("checkbox-only beta attempts cannot satisfy the verified share gate",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"OLD-"+index,device_class:"mobile",
    core_flow_completed:true,design_locked:true,share_or_enquiry_completed:true,blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  const summary=summarizeLaunchReadiness(attempts,[]);
  assert.equal(summary.verifiedShareCases,0);
  assert.equal(summary.successfulBetaCases,0);
  assert.equal(summary.betaGateComplete,false);
});


test("verified enquiry audit can satisfy the same beta flow gate",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"ENQUIRY-"+index,device_class:"mobile",
    core_flow_completed:true,design_locked:true,share_or_enquiry_completed:true,
    revision_id:"REV-ENQUIRY-"+index,share_audit_confirmed:false,enquiry_audit_confirmed:true,evidence_kind:"enquiry",blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  const summary=summarizeLaunchReadiness(attempts,[]);
  assert.equal(summary.verifiedEnquiryCases,5);
  assert.equal(summary.verifiedFlowCases,5);
  assert.equal(summary.successfulBetaCases,5);
  assert.equal(summary.betaGateComplete,true);
});


test("duplicate locked revision cannot inflate the five-customer beta gate",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"BETA-DUPE-"+index,device_class:"mobile",
    core_flow_completed:true,design_locked:true,share_or_enquiry_completed:true,
    revision_id:"REV-SAME",share_audit_confirmed:true,enquiry_audit_confirmed:false,blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  const summary=summarizeLaunchReadiness(attempts,[]);
  assert.equal(summary.verifiedFlowCases,5);
  assert.equal(summary.distinctVerifiedRevisions,1);
  assert.equal(summary.successfulBetaCases,1);
  assert.equal(summary.betaGateComplete,false);
});

function passingLaunchEvidence(){
  const attempts=Array.from({length:5},(_,i)=>({
    case_id:`BETA-C${i}`,device_class:"mobile",
    core_flow_completed:true,design_locked:true,share_or_enquiry_completed:true,
    revision_id:`LOCKED-REVISION-${i}`,share_audit_confirmed:true,blocking_bug:false,
    created_at:`2026-10-${String(i+1).padStart(2,"0")}T08:00:00Z`,
  }));
  const checklist=LAUNCH_CHECKLIST_ITEMS.map((item,i)=>({
    item_id:item.id,status:"approved",signed_by:"Owner Reviewer",
    created_at:`2026-10-${String(i+8).padStart(2,"0")}T09:00:00Z`,
  }));
  return {attempts,checklist};
}

test("malformed or future-dated beta attempts block the case instead of resurrecting an older successful attempt",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  assert.equal(summarizeLaunchReadiness(attempts,checklist).launchEvidenceComplete,true);
  for(const badTimestamp of ["not-a-date","9999-12-31T23:59:00Z"]){
    const copy={...attempts[0],created_at:badTimestamp};
    const summary=summarizeLaunchReadiness([...attempts,copy],checklist);
    assert.equal(summary.invalidBetaEvidenceCases,1);
    assert.equal(summary.successfulBetaCases,4);
    assert.equal(summary.betaGateComplete,false);
  }
});

test("future or malformed checklist evidence cannot silently fall back to an older approval",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  for(const created_at of ["invalid","9999-12-31T23:59:59Z"]){
    const duplicate={...checklist[0],created_at,status:"review"};
    const summary=summarizeLaunchReadiness(attempts,[...checklist,duplicate]);
    assert.equal(summary.invalidChecklistEvidenceItems,1);
    assert.equal(summary.checklistApproved,LAUNCH_CHECKLIST_ITEMS.length-1);
    assert.equal(summary.launchEvidenceComplete,false);
  }
});

test("invented truthy beta flags and missing bug review never satisfy a live flow",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  for(const invalid of [
    {core_flow_completed:"true"},
    {blocking_bug:undefined},
    {blocking_bug:null},
    {blocking_bug:"false"},
  ]){
    const changed=[{...attempts[0],...invalid},...attempts.slice(1)] as never;
    const summary=summarizeLaunchReadiness(changed,checklist);
    assert.equal(summary.successfulBetaCases,4,JSON.stringify(invalid));
    assert.equal(summary.betaGateComplete,false);
  }
});

test("a case-id capitalization change cannot masquerade as an independent beta customer",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  const repeat={...attempts[0],case_id:attempts[0].case_id.toLowerCase()};
  const summary=summarizeLaunchReadiness([...attempts,repeat],checklist);
  assert.equal(summary.uniqueBetaCases,5);
  assert.equal(summary.successfulBetaCases,5);
});

test("normalizers reject overlong case IDs, revision IDs and launch reviewer names instead of truncating",()=>{
  const simple={caseId:"BETA-A1",deviceClass:"mobile",
    designLocked:true,shareOrEnquiryCompleted:true,blockingBug:false};
  assert.throws(()=>normalizeBetaAttempt({...simple,caseId:"x".repeat(81)}),/Anonymous beta case ID/);
  assert.throws(()=>normalizeVerifiedBetaAttempt({...simple,revisionId:"x".repeat(181)}),/Locked revision ID/);
  assert.throws(()=>normalizeLaunchChecklistDecision({
    itemId:"operator_access",status:"approved",signedBy:"a".repeat(121),
  }),/human sign-off/);
});

test("same-instant contradictory beta and checklist records block approval regardless of input ordering",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  const conflictingBeta={...attempts[0],blocking_bug:true};
  for(const records of [
    [conflictingBeta,...attempts],
    [...attempts,conflictingBeta],
  ]){
    const summary=summarizeLaunchReadiness(records,checklist);
    assert.equal(summary.invalidBetaEvidenceCases,1);
    assert.equal(summary.betaGateComplete,false);
  }
  const conflictingChecklist={...checklist[0],status:"review"};
  for(const records of [
    [conflictingChecklist,...checklist],
    [...checklist,conflictingChecklist],
  ]){
    const summary=summarizeLaunchReadiness(attempts,records);
    assert.equal(summary.invalidChecklistEvidenceItems,1);
    assert.equal(summary.checklistGateComplete,false);
  }
});

test("only complete timestamped audit records can satisfy launch gating",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  for(const created_at of ["2026-10-01","2026-10-01T08:00:00","not-a-timestamp"]){
    const summary=summarizeLaunchReadiness([
      {...attempts[0],created_at},...attempts.slice(1),
    ],checklist);
    assert.equal(summary.betaGateComplete,false,created_at);
  }
});

test("an unresolved blocking beta case stops launch even after five successful distinct flows",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  attempts.push({
    ...attempts[0],case_id:"BETA-OPEN-INCIDENT",revision_id:"LOCKED-REVISION-INCIDENT",
    blocking_bug:true,created_at:"2026-10-19T08:00:00Z",
  });
  const summary=summarizeLaunchReadiness(attempts,checklist);
  assert.equal(summary.successfulBetaCases,5);
  assert.equal(summary.blockingBetaCases,1);
  assert.equal(summary.betaGateComplete,false);
  assert.equal(summary.launchEvidenceComplete,false);
});

test("anonymous, absent or overlong historical checklist signers cannot approve launch",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  assert.equal(summarizeLaunchReadiness(attempts,checklist).launchEvidenceComplete,true);
  for(const signed_by of ["",null,undefined,"x".repeat(121)]){
    const rows=[...checklist.slice(0,1),{...checklist[1],signed_by},...checklist.slice(2)] as never;
    const summary=summarizeLaunchReadiness(attempts,rows);
    assert.equal(summary.checklistApproved,LAUNCH_CHECKLIST_ITEMS.length-1);
    assert.equal(summary.invalidChecklistEvidenceItems,1);
    assert.equal(summary.checklistGateComplete,false);
    assert.equal(summary.launchEvidenceComplete,false);
  }
});

test("invalid newer signer cannot resurrect an earlier signed checklist approval",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  const corrupted={...checklist[0],signed_by:" ",created_at:"2026-10-20T10:00:00Z"};
  const summary=summarizeLaunchReadiness(attempts,[...checklist,corrupted]);
  assert.equal(summary.invalidChecklistEvidenceItems,1);
  assert.equal(summary.checklistApproved,LAUNCH_CHECKLIST_ITEMS.length-1);
  assert.equal(summary.launchEvidenceComplete,false);
});

test("contradictory signers at one instant invalidate checklist identity",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  const contradictory={...checklist[0],signed_by:"Different Person"};
  const summary=summarizeLaunchReadiness(attempts,[...checklist,contradictory]);
  assert.equal(summary.invalidChecklistEvidenceItems,1);
  assert.equal(summary.checklistGateComplete,false);
});

test("invalid stored device classes cannot count toward the beta flow gate",()=>{
  const {attempts,checklist}=passingLaunchEvidence();
  const invalid=[{...attempts[0],device_class:"server"},...attempts.slice(1)];
  const summary=summarizeLaunchReadiness(invalid,checklist);
  assert.equal(summary.successfulBetaCases,4);
  assert.equal(summary.betaGateComplete,false);
});
