import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeNoviceDesignerAttempt,
  normalizeNoviceStudyDecision,
  normalizeNoviceTimerStart,
  normalizeNoviceTimedAttempt,
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
    timing_session_id:`TIMER-${index}`,
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
    timing_session_id:`TIMER-${index}`,
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
      novice_confirmed:true,liked_design_completed:true,blocking_issue:false,timing_session_id:"TIMER-A1",
      created_at:"2026-10-01T10:00:00Z",
    },
    {
      case_id:"NOVICE-A",device_class:"mobile",duration_seconds:280,
      novice_confirmed:true,liked_design_completed:false,blocking_issue:true,timing_session_id:"TIMER-A2",
      created_at:"2026-10-02T10:00:00Z",
    },
  ];
  const result=summarizeNoviceDesignerStudy(attempts,[]);
  assert.equal(result.uniqueCases,1);
  assert.equal(result.likedDesignCases,0);
  assert.equal(result.blockingCases,1);
  assert.equal(result.gateComplete,false);
});


test("manual duration evidence cannot complete the five-novice gate",()=>{
  const attempts=Array.from({length:5},(_,index)=>({
    case_id:"LEGACY-"+index,
    device_class:"mobile",
    duration_seconds:200,
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
  assert.equal(result.serverTimedLikedCases,0);
  assert.equal(result.withinTargetCases,0);
  assert.equal(result.gateComplete,false);
});

test("novice timer start rejects coerced case/device identities",()=>{
  assert.deepEqual(normalizeNoviceTimerStart({caseId:"NOVICE-42",deviceClass:"tablet"}),{
    caseId:"NOVICE-42",deviceClass:"tablet",
  });
  assert.throws(()=>normalizeNoviceTimerStart({caseId:["NOVICE-42"],deviceClass:"tablet"}),/text/i);
  assert.throws(()=>normalizeNoviceTimerStart({caseId:"NOVICE-42",deviceClass:["mobile"]}),/literal device/i);
  assert.throws(()=>normalizeNoviceTimerStart({caseId:"NOVICE-42",deviceClass:"desktop-extra"}),/literal device/i);
});

test("novice attempts require literal seconds, booleans and complete notes",()=>{
  const good={caseId:"NOVICE-42",deviceClass:"mobile",durationSeconds:241,
    noviceConfirmed:true,likedDesignCompleted:true,blockingIssue:false,note:"ok"};
  assert.equal(normalizeNoviceDesignerAttempt(good).durationSeconds,241);
  assert.throws(()=>normalizeNoviceDesignerAttempt({...good,durationSeconds:"241"}),/must be a number/i);
  assert.throws(()=>normalizeNoviceDesignerAttempt({...good,durationSeconds:null}),/must be a number/i);
  assert.throws(()=>normalizeNoviceDesignerAttempt({...good,noviceConfirmed:"true"}),/must all be recorded/i);
  assert.throws(()=>normalizeNoviceDesignerAttempt({...good,note:"x".repeat(1201)}),/too long/i);
  assert.throws(()=>normalizeNoviceDesignerAttempt({...good,note:["ok"]}),/must be text/i);
});

test("timed attempts require literal server session and reject lost blocking notes",()=>{
  const good={timingSessionId:"123e4567-e89b-42d3-a456-426614174000",
    noviceConfirmed:true,likedDesignCompleted:false,blockingIssue:true,note:"Could not finish"};
  assert.equal(normalizeNoviceTimedAttempt(good).blockingIssue,true);
  assert.throws(()=>normalizeNoviceTimedAttempt({...good,timingSessionId:[good.timingSessionId]}),/timing session/i);
  assert.throws(()=>normalizeNoviceTimedAttempt({...good,note:"x".repeat(1201)}),/too long/i);
  assert.throws(()=>normalizeNoviceTimedAttempt({...good,note:""}),/short note/i);
});

test("human novice-study approval rejects coerced signer, target, status and truncated notes",()=>{
  const good={status:"approved",targetSeconds:300,signedBy:"Tailor lead",note:"Reviewed"};
  assert.equal(normalizeNoviceStudyDecision(good).targetSeconds,300);
  assert.throws(()=>normalizeNoviceStudyDecision({...good,targetSeconds:"300"}),/must be a number/i);
  assert.throws(()=>normalizeNoviceStudyDecision({...good,status:["approved"]}),/approved or review/i);
  assert.throws(()=>normalizeNoviceStudyDecision({...good,signedBy:["Owner"]}),/must be text/i);
  assert.throws(()=>normalizeNoviceStudyDecision({...good,note:"x".repeat(1201)}),/too long/i);
});

test("novice study route requires secure JSON and confirmed UUID receipts before success",()=>{
  const source=readFileSync("src/app/api/operator/novice-designer-study/route.ts","utf8");
  assert.match(source,/secureJsonRequestError\(request,16384\)/);
  assert.match(source,/readSecureJsonObject\(request,16384\)/);
  assert.match(source,/normalizeVaultId\(receipt\)/);
  assert.match(source,/confirmedTimerStart\(receipt,draft\.caseId,draft\.deviceClass\)/);
  assert.match(source,/confirmedTimerFinish\(receipt,timingSessionId\)/);
  assert.doesNotMatch(source,/request\.json\(\)/);
});
