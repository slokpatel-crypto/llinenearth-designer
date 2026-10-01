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
    core_flow_completed:true,design_locked:true,share_or_enquiry_completed:true,share_audit_confirmed:true,blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  attempts.push({
    case_id:"BETA-0",device_class:"desktop",
    core_flow_completed:false,design_locked:true,share_or_enquiry_completed:false,share_audit_confirmed:false,blocking_bug:true,
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
    caseId:"BETA-VERIFY",deviceClass:"mobile",revisionId:"REV-123",blockingBug:false,
  });
  assert.equal(result.revisionId,"REV-123");
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
