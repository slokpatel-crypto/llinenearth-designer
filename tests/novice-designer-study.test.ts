import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeNoviceDesignerAttempt,
  normalizeNoviceStudyDecision,
  summarizeNoviceDesignerStudy,
} from "../src/lib/designer/novice-designer-study.ts";

test("novice Designer attempt records observed time and outcomes",()=>{
  const result=normalizeNoviceDesignerAttempt({
    caseId:"NOVICE-001",deviceClass:"mobile",durationSeconds:275,
    noviceConfirmed:true,likedDesignCompleted:true,blockingIssue:false,
  });
  assert.equal(result.durationSeconds,275);
  assert.equal(result.likedDesignCompleted,true);
});

test("blocking novice attempt requires a note",()=>{
  assert.throws(()=>normalizeNoviceDesignerAttempt({
    caseId:"NOVICE-002",deviceClass:"desktop",durationSeconds:320,
    noviceConfirmed:true,likedDesignCompleted:false,blockingIssue:true,note:"",
  }),/require a short note/i);
});

test("study decision requires a human-entered target and signer",()=>{
  assert.throws(()=>normalizeNoviceStudyDecision({
    status:"approved",targetSeconds:0,signedBy:"Owner",
  }),/documented roadmap target/i);
  assert.throws(()=>normalizeNoviceStudyDecision({
    status:"approved",targetSeconds:300,signedBy:"",
  }),/Named owner\/reviewer/);
});

test("five latest novice liked-design cases within target plus approval complete the gate",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"NOVICE-"+index,
    device_class:"mobile",
    duration_seconds:240+index*5,
    novice_confirmed:true,
    liked_design_completed:true,
    blocking_issue:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  const decisions=[{
    status:"approved",target_seconds:300,signed_by:"Owner",
    created_at:"2026-10-10T10:00:00Z",
  }];
  const result=summarizeNoviceDesignerStudy(attempts,decisions);
  assert.equal(result.withinTargetCases,5);
  assert.equal(result.evidenceReady,true);
  assert.equal(result.gateComplete,true);
});

test("one latest case over target keeps the five-novice gate open",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"NOVICE-"+index,
    device_class:"desktop",
    duration_seconds:index===4?360:250,
    novice_confirmed:true,
    liked_design_completed:true,
    blocking_issue:false,
    created_at:"2026-10-0"+(index+1)+"T10:00:00Z",
  }));
  const decisions=[{
    status:"approved",target_seconds:300,signed_by:"Owner",
    created_at:"2026-10-10T10:00:00Z",
  }];
  const result=summarizeNoviceDesignerStudy(attempts,decisions);
  assert.equal(result.likedDesignCases,5);
  assert.equal(result.withinTargetCases,4);
  assert.equal(result.gateComplete,false);
});

test("latest attempt per case replaces earlier success",()=>{
  const attempts=[
    {
      case_id:"NOVICE-A",device_class:"mobile",duration_seconds:250,
      novice_confirmed:true,liked_design_completed:true,blocking_issue:false,
      created_at:"2026-10-01T10:00:00Z",
    },
    {
      case_id:"NOVICE-A",device_class:"mobile",duration_seconds:280,
      novice_confirmed:true,liked_design_completed:false,blocking_issue:true,
      created_at:"2026-10-02T10:00:00Z",
    },
  ];
  const result=summarizeNoviceDesignerStudy(attempts,[]);
  assert.equal(result.uniqueCases,1);
  assert.equal(result.likedDesignCases,0);
  assert.equal(result.blockingCases,1);
  assert.equal(result.gateComplete,false);
});
