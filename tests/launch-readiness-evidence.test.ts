import test from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_CHECKLIST_ITEMS,
  normalizeBetaAttempt,
  normalizeLaunchChecklistDecision,
  summarizeLaunchReadiness,
} from "../src/lib/designer/launch-readiness-evidence.ts";

test("blocking beta attempt requires a note",()=>{
  assert.throws(()=>normalizeBetaAttempt({
    caseId:"BETA-001",deviceClass:"mobile",coreFlowCompleted:false,blockingBug:true,note:"",
  }),/require a short note/i);
});

test("launch checklist approval requires named human sign-off",()=>{
  assert.throws(()=>normalizeLaunchChecklistDecision({
    itemId:"privacy_notice",status:"approved",signedBy:"",
  }),/human sign-off/i);
});

test("latest attempt per anonymous beta case controls the five-customer gate",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"BETA-"+index,device_class:index%2?"mobile":"desktop",
    core_flow_completed:true,blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  attempts.push({
    case_id:"BETA-0",device_class:"desktop",core_flow_completed:false,blocking_bug:true,
    created_at:"2026-10-10T10:00:00Z",
  });
  const summary=summarizeLaunchReadiness(attempts,[]);
  assert.equal(summary.successfulBetaCases,4);
  assert.equal(summary.betaGateComplete,false);
});

test("launch evidence completes only when beta and checklist gates both pass",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"BETA-"+index,device_class:"mobile",core_flow_completed:true,blocking_bug:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  const checklist=LAUNCH_CHECKLIST_ITEMS.map((item,index)=>({
    item_id:item.id,status:"approved",created_at:"2026-10-"+String(index+10).padStart(2,"0")+"T10:00:00Z",
  }));
  assert.equal(summarizeLaunchReadiness(attempts,checklist).launchEvidenceComplete,true);
});
