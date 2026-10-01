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
    core_flow_completed:true,design_locked:true,share_or_enquiry_completed:true,share_audit_confirmed:true,blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  const checklist=LAUNCH_CHECKLIST_ITEMS.map((item,index)=>({
    item_id:item.id,status:"approved",created_at:"2026-10-"+String(index+10).padStart(2,"0")+"T10:00:00Z",
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
