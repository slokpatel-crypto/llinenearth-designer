import test from "node:test";
import assert from "node:assert/strict";
import {
  MEASUREMENT_CALIBRATION_TARGET_CASES,
  normalizeMeasurementCalibrationDraft,
  summarizeMeasurementCalibration,
} from "../src/lib/designer/measurement-calibration.ts";

test("measurement calibration draft requires anonymous case, physical source and checker",()=>{
  assert.throws(()=>normalizeMeasurementCalibrationDraft({
    caseId:"CASE-01",selfChestCm:100,tailorChestCm:100,selfSleeveCm:64,tailorSleeveCm:64,
    evidenceSource:"",checkedBy:"Tailor",
  }),/evidence source/i);
  assert.throws(()=>normalizeMeasurementCalibrationDraft({
    caseId:"CASE-01",selfChestCm:100,tailorChestCm:100,selfSleeveCm:64,tailorSleeveCm:64,
    evidenceSource:"physical tape comparison",checkedBy:"",
  }),/checker\/tailor/i);
});

test("measurement calibration uses latest unique case and recomputes absolute error",()=>{
  const rows=[
    {case_id:"CASE-01",self_chest_cm:102,tailor_chest_cm:100,self_sleeve_cm:66,tailor_sleeve_cm:64,evidence_source:"old check",checked_by:"Tailor A",note:"",created_at:"2026-10-01T09:00:00Z"},
    {case_id:"CASE-01",self_chest_cm:100.4,tailor_chest_cm:100,self_sleeve_cm:64.3,tailor_sleeve_cm:64,evidence_source:"repeat check",checked_by:"Tailor B",note:"",created_at:"2026-10-01T10:00:00Z"},
  ];
  const result=summarizeMeasurementCalibration(rows);
  assert.equal(result.total,1);
  assert.equal(result.cases[0]?.chestErrorCm,0.4);
  assert.equal(result.cases[0]?.sleeveErrorCm,0.3);
  assert.equal(result.cases[0]?.checkedBy,"Tailor B");
});

test("roadmap measurement gate passes only after ten unique real comparisons meet both medians",()=>{
  const rows=Array.from({length:MEASUREMENT_CALIBRATION_TARGET_CASES},(_,index)=>({
    case_id:"CASE-"+String(index+1).padStart(2,"0"),
    self_chest_cm:100+(index%2?0.8:-0.8),tailor_chest_cm:100,
    self_sleeve_cm:64+(index%2?0.5:-0.5),tailor_sleeve_cm:64,
    evidence_source:"physical tape session "+index,checked_by:"Tailor",note:"",
    created_at:`2026-10-${String(index+1).padStart(2,"0")}T10:00:00Z`,
  }));
  const result=summarizeMeasurementCalibration(rows);
  assert.equal(result.total,10);
  assert.equal(result.chestPass,true);
  assert.equal(result.sleevePass,true);
  assert.equal(result.complete,true);
});

test("case count alone cannot pass measurement calibration when either median is outside target",()=>{
  const rows=Array.from({length:10},(_,index)=>({
    case_id:"FAIL-"+index,self_chest_cm:103,tailor_chest_cm:100,self_sleeve_cm:64.2,tailor_sleeve_cm:64,
    evidence_source:"physical comparison",checked_by:"Tailor",note:"",
    created_at:`2026-10-${String(index+1).padStart(2,"0")}T10:00:00Z`,
  }));
  const result=summarizeMeasurementCalibration(rows);
  assert.equal(result.chestPass,false);
  assert.equal(result.sleevePass,true);
  assert.equal(result.complete,false);
});

test("calibration drafts reject coerced numbers and fabricated source or checker fields",()=>{
  const good={caseId:"CASE-101",selfChestCm:100,tailorChestCm:100,
    selfSleeveCm:64,tailorSleeveCm:64,evidenceSource:"physical tape comparison",
    checkedBy:"Tailor"};
  for(const raw of [null,false,true,"", "100",[],{},Infinity,NaN]){
    assert.throws(()=>normalizeMeasurementCalibrationDraft({...good,selfChestCm:raw}),/Self chest/);
    assert.throws(()=>normalizeMeasurementCalibrationDraft({...good,tailorSleeveCm:raw}),/Tailor sleeve/);
  }
  for(const raw of [[],{},false,123]){
    assert.throws(()=>normalizeMeasurementCalibrationDraft({...good,evidenceSource:raw}),/evidence source/);
    assert.throws(()=>normalizeMeasurementCalibrationDraft({...good,checkedBy:raw}),/checker\/tailor/);
  }
  assert.throws(()=>normalizeMeasurementCalibrationDraft({...good,caseId:["CASE-101"]}),/case ID/);
  assert.throws(()=>normalizeMeasurementCalibrationDraft({...good,note:{spoof:"human"}}),/note must be text/);
  assert.equal(normalizeMeasurementCalibrationDraft(good).selfChestCm,100);
});

test("ten malformed database rows never count as real tape calibration",()=>{
  const valid=Array.from({length:10},(_,index)=>({
    case_id:"CASE-"+String(index+1).padStart(2,"0"),
    self_chest_cm:100,tailor_chest_cm:100,self_sleeve_cm:64,tailor_sleeve_cm:64,
    evidence_source:"physical tape comparison",checked_by:"Tailor",note:"",
    created_at:`2026-10-${String(index+1).padStart(2,"0")}T10:00:00+00:00`,
  }));
  assert.equal(summarizeMeasurementCalibration(valid).complete,true);
  for(const malformed of [
    {...valid[0],self_chest_cm:null},
    {...valid[0],tailor_chest_cm:"100"},
    {...valid[0],self_sleeve_cm:false},
    {...valid[0],tailor_sleeve_cm:""},
    {...valid[0],evidence_source:{}},
    {...valid[0],checked_by:[]},
    {...valid[0],created_at:"2026-02-30T10:00:00Z"},
    {...valid[0],created_at:"2026-10-01T24:00:00Z"},
    {...valid[0],created_at:"2026-10-01T10:00:00+15:00"},
  ]){
    const result=summarizeMeasurementCalibration([malformed,...valid.slice(1)] as never);
    assert.equal(result.total,9);
    assert.equal(result.complete,false);
  }
  const stale={...valid[0],self_chest_cm:105,created_at:"2026-09-01T10:00:00Z"};
  const corruptLatest={...valid[0],self_chest_cm:null,created_at:"2026-10-12T10:00:00Z"};
  assert.equal(summarizeMeasurementCalibration([stale,corruptLatest,...valid.slice(1)] as never).total,9);
  assert.equal(summarizeMeasurementCalibration([valid[0],{...valid[0],created_at:"2026-02-29T10:00:00Z"},...valid.slice(1)]).total,9);
});
