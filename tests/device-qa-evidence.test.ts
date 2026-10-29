import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizePreviewPerformanceDurations } from "../src/lib/designer/preview-performance-client.ts";
import {
  DEVICE_QA_EVIDENCE_VERSION,
  evaluateDeviceQaEvidence,
  normalizeDeviceQaEvidenceReceipt,
  parseDeviceQaViewport,
  summarizeDeviceQaDurations,
} from "../src/lib/designer/device-qa-evidence.ts";

test("device QA accepts only raw evidence that satisfies every gate",()=>{
  const result=evaluateDeviceQaEvidence({
    version:DEVICE_QA_EVIDENCE_VERSION,
    deviceClass:"mobile",
    viewport:"390x844",
    sampleDurationsMs:[42,45,48,50,52,54,56,58,60,62,64,66,68,70,72],
    checks:{
      fourViews:true,
      controlsLegible:true,
      noOverflow:true,
      fabricReadable:true,
      modelStable:true,
    },
  });
  assert.equal(result.accepted,true);
  assert.equal(result.deviceClass,"mobile");
  assert.equal(result.samples,15);
  assert.equal(result.performancePass,true);
  assert.equal(result.visualPass,true);
});

test("desktop viewport cannot be recorded as mobile acceptance",()=>{
  const result=evaluateDeviceQaEvidence({
    version:DEVICE_QA_EVIDENCE_VERSION,
    deviceClass:"mobile",
    viewport:"1440x900",
    sampleDurationsMs:Array.from({length:12},()=>50),
    checks:{
      fourViews:true,
      controlsLegible:true,
      noOverflow:true,
      fabricReadable:true,
      modelStable:true,
    },
  });
  assert.equal(result.deviceClassValid,false);
  assert.equal(result.accepted,false);
});

test("client-supplied status cannot override failing raw latency",()=>{
  const result=evaluateDeviceQaEvidence({
    version:DEVICE_QA_EVIDENCE_VERSION,
    status:"accepted",
    deviceClass:"mobile",
    viewport:"390x844",
    p95Ms:10,
    withinTarget:true,
    sampleDurationsMs:[20,30,40,50,60,70,80,90,100,120,140,160],
    checks:{
      fourViews:true,
      controlsLegible:true,
      noOverflow:true,
      fabricReadable:true,
      modelStable:true,
    },
  });
  assert.equal(result.performancePass,false);
  assert.equal(result.accepted,false);
});

test("missing visual check keeps device evidence in review",()=>{
  const result=evaluateDeviceQaEvidence({
    version:DEVICE_QA_EVIDENCE_VERSION,
    deviceClass:"tablet",
    viewport:"820x1180",
    sampleDurationsMs:Array.from({length:12},()=>45),
    checks:{
      fourViews:true,
      controlsLegible:true,
      noOverflow:true,
      fabricReadable:true,
      modelStable:false,
    },
  });
  assert.equal(result.visualPass,false);
  assert.equal(result.accepted,false);
});

test("legacy device evidence never satisfies the hardened gate",()=>{
  const result=evaluateDeviceQaEvidence({
    version:"designer-device-qa-v1",
    deviceClass:"mobile",
    viewport:"390x844",
    sampleDurationsMs:Array.from({length:12},()=>45),
    checks:{
      fourViews:true,
      controlsLegible:true,
      noOverflow:true,
      fabricReadable:true,
      modelStable:true,
    },
  });
  assert.equal(result.versionValid,false);
  assert.equal(result.accepted,false);
});

test("duration summary uses the same p95 ordering contract",()=>{
  const summary=summarizeDeviceQaDurations([10,20,30,40,50,60,70,80,90,100,110,120]);
  assert.equal(summary.samples,12);
  assert.equal(summary.p95Ms,110);
});

test("viewport parser rejects implausible evidence",()=>{
  assert.equal(parseDeviceQaViewport("390x844").deviceClass,"mobile");
  assert.equal(parseDeviceQaViewport("1440x900").deviceClass,"desktop");
  assert.equal(parseDeviceQaViewport("99x100").deviceClass,null);
  assert.equal(parseDeviceQaViewport("mobile").deviceClass,null);
});

function validDeviceQaPayload():Record<string,unknown>{
  return {
    version:DEVICE_QA_EVIDENCE_VERSION,
    deviceClass:"mobile",
    viewport:"390x844",
    sampleDurationsMs:Array.from({length:12},()=>42),
    checks:{
      fourViews:true,controlsLegible:true,noOverflow:true,
      fabricReadable:true,modelStable:true,
    },
  };
}

function completeDeviceQaReceipt():Record<string,unknown>{
  return {
    subtype:"designer_device_qa",...validDeviceQaPayload(),status:"accepted",
    dpr:3,samples:12,medianMs:42,p95Ms:42,maxMs:42,withinTarget:true,
    hardwareConcurrency:8,userAgent:"Real target browser",note:"Observed on the named device.",
  };
}

test("complete device receipts preserve literal, internally consistent audit metadata",()=>{
  const valid=completeDeviceQaReceipt();
  const receipt=normalizeDeviceQaEvidenceReceipt(valid);
  assert.equal(receipt?.status,"accepted");
  assert.equal(receipt?.samples,12);
  for(const [key,value] of [
    ["dpr","3"],["samples","12"],["hardwareConcurrency","8"],
    ["medianMs","42"],["withinTarget",1],["userAgent",["browser"]],
  ] as const){
    assert.equal(normalizeDeviceQaEvidenceReceipt({...valid,[key]:value}),null,`coerced ${key} must fail`);
  }
  assert.equal(normalizeDeviceQaEvidenceReceipt({...valid,samples:11}),null);
  assert.equal(normalizeDeviceQaEvidenceReceipt({...valid,p95Ms:41}),null);
  assert.equal(normalizeDeviceQaEvidenceReceipt({...valid,viewport:"1440x900"}),null);
  assert.equal(normalizeDeviceQaEvidenceReceipt({...valid,note:"x".repeat(601)}),null);
});

test("coercible device QA identity never counts as acceptance",()=>{
  const valid=validDeviceQaPayload();
  assert.equal(evaluateDeviceQaEvidence(valid).accepted,true);
  for(const [key,value] of [
    ["version",[DEVICE_QA_EVIDENCE_VERSION]],
    ["deviceClass",["mobile"]],
    ["viewport",["390x844"]],
    ["version",{toString:"designer-device-qa-v2"}],
  ] as const){
    const result=evaluateDeviceQaEvidence({...valid,[key]:value});
    assert.equal(result.accepted,false,`coerced ${key} must not pass`);
  }
  assert.equal(parseDeviceQaViewport(["390x844"]).deviceClass,null);
  assert.equal(parseDeviceQaViewport({}).deviceClass,null);
});

test("malformed or oversized raw samples invalidate the whole device receipt",()=>{
  const valid=validDeviceQaPayload();
  for(const bad of ["42",null,true,[],{},-1,10001,Number.NaN]){
    const durations=[...(valid.sampleDurationsMs as number[]),bad];
    assert.deepEqual(summarizeDeviceQaDurations(durations),{samples:0,p95Ms:null});
    assert.equal(evaluateDeviceQaEvidence({...valid,sampleDurationsMs:durations}).accepted,false);
  }
  assert.deepEqual(summarizeDeviceQaDurations(Array.from({length:121},()=>42)),{samples:0,p95Ms:null});
  assert.equal(evaluateDeviceQaEvidence({...valid,sampleDurationsMs:Array.from({length:121},()=>42)}).accepted,false);
  assert.equal(evaluateDeviceQaEvidence({...valid,sampleDurationsMs:Array.from({length:12},()=>42)}).accepted,true);
});

test("operator device evidence write/read paths preserve fail-closed acceptance",()=>{
  const writer=readFileSync(new URL("../src/app/api/memory/event/route.ts",import.meta.url),"utf8");
  const reader=readFileSync(new URL("../src/app/api/operator/device-qa/route.ts",import.meta.url),"utf8");
  assert.match(writer,/normalizeDeviceQaEvidenceReceipt\(payload\)/);
  assert.match(writer,/return=\$\{deviceReceipt\?"representation":"minimal"\}/);
  assert.match(writer,/Device QA evidence receipt could not be confirmed/);
  assert.match(writer,/readSecureJsonObject\(request,MEMORY_EVENT_JSON_MAX_BYTES\)/);
  assert.match(reader,/normalizeDeviceQaEvidenceReceipt\(payload\)/);
  assert.match(reader,/verifiedV2\?\.status==="accepted"&&evaluation\.accepted/);
  assert.match(reader,/evaluation\.versionValid\?\(verifiedV2\?evaluation\.p95Ms:null\):legacyP95/);
  assert.match(reader,/evaluation\.versionValid\?\(verifiedV2\?evaluation\.samples:0\):legacySamples/);
  assert.doesNotMatch(reader,/Number\(payload\.p95Ms\)/);
});


test("browser and server agree on the rounded p95 device acceptance boundary",()=>{
  const durations=Array.from({length:12},()=>99.96);
  const browser=summarizePreviewPerformanceDurations(durations);
  const server=evaluateDeviceQaEvidence({
    version:DEVICE_QA_EVIDENCE_VERSION,deviceClass:"mobile",viewport:"390x844",
    sampleDurationsMs:durations,
    checks:{fourViews:true,controlsLegible:true,noOverflow:true,fabricReadable:true,modelStable:true},
  });
  assert.equal(browser.p95Ms,100);
  assert.equal(browser.withinTarget,false);
  assert.equal(server.performancePass,false);
  assert.equal(server.accepted,false);
  assert.deepEqual(summarizePreviewPerformanceDurations([]),{
    samples:0,medianMs:null,p95Ms:null,maxMs:null,withinTarget:null,
  });
});

test("device QA client preserves unmeasured review as null instead of false",()=>{
  const source=readFileSync(new URL("../src/app/operator/device-qa/DeviceQaClient.tsx",import.meta.url),"utf8");
  assert.match(source,/withinTarget:summary\.withinTarget,/);
  assert.doesNotMatch(source,/withinTarget:summary\.withinTarget===true/);
  const review=normalizeDeviceQaEvidenceReceipt({
    subtype:"designer_device_qa",version:DEVICE_QA_EVIDENCE_VERSION,
    deviceClass:"mobile",status:"review",viewport:"390x844",dpr:2,
    samples:0,sampleDurationsMs:[],medianMs:null,p95Ms:null,maxMs:null,
    withinTarget:null,hardwareConcurrency:4,userAgent:"Observed device",
    checks:{fourViews:false,controlsLegible:false,noOverflow:false,fabricReadable:false,modelStable:false},
    note:"No latency observations yet.",
  });
  assert.equal(review?.status,"review");
});


test("an explicitly reviewed v2 session stays review even if raw latency and visuals pass",()=>{
  const raw=completeDeviceQaReceipt();
  const reviewed=normalizeDeviceQaEvidenceReceipt({...raw,status:"review"});
  assert.equal(reviewed?.status,"review");
  assert.equal(evaluateDeviceQaEvidence(raw).accepted,true);
  const invalid=normalizeDeviceQaEvidenceReceipt({...raw,status:"accepted",p95Ms:0});
  assert.equal(invalid,null);
});
