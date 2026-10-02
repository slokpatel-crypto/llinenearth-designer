import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVICE_QA_EVIDENCE_VERSION,
  evaluateDeviceQaEvidence,
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
