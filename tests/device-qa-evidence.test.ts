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

import {
  previewDeviceClassForViewport,
  summarizePreviewPerformanceForDeviceClass,
  recordPreviewPerformance,
  readPreviewPerformanceSamplesForDeviceClass,
  readPreviewPerformanceSummaryForDeviceClass,
  PREVIEW_PERFORMANCE_STORAGE_KEY,
  type PreviewPerformanceSample,
} from "../src/lib/designer/preview-performance-client.ts";

test("device-specific performance excludes legacy and cross-device interaction samples",()=>{
  assert.equal(previewDeviceClassForViewport(390),"mobile");
  assert.equal(previewDeviceClassForViewport(820),"tablet");
  assert.equal(previewDeviceClassForViewport(1440),"desktop");
  assert.equal(previewDeviceClassForViewport(0),null);
  const samples:PreviewPerformanceSample[]=[
    ...Array.from({length:12},(_,i)=>({kind:"view" as const,durationMs:40+i,at:i,deviceClass:"mobile" as const})),
    ...Array.from({length:12},(_,i)=>({kind:"view" as const,durationMs:120+i,at:i,deviceClass:"desktop" as const})),
    ...Array.from({length:12},(_,i)=>({kind:"view" as const,durationMs:20+i,at:i})),
  ];
  const mobile=summarizePreviewPerformanceForDeviceClass(samples,"mobile");
  const desktop=summarizePreviewPerformanceForDeviceClass(samples,"desktop");
  const tablet=summarizePreviewPerformanceForDeviceClass(samples,"tablet");
  assert.equal(mobile.samples,12);
  assert.equal(mobile.withinTarget,true);
  assert.equal(desktop.samples,12);
  assert.equal(desktop.withinTarget,false);
  assert.equal(tablet.samples,0);
  assert.equal(tablet.withinTarget,null);
});

test("device acceptance rejects corrupt sample series instead of filtering away slow or forged frames",()=>{
  const good=Array.from({length:12},()=>45);
  assert.equal(summarizeDeviceQaDurations(good).samples,12);
  for(const bad of [null, "35", true, -1, Infinity, NaN, 10001, {}]){
    const summary=summarizeDeviceQaDurations([...good,bad]);
    assert.equal(summary.samples,0);
    assert.equal(summary.p95Ms,null);
  }
  const checks={fourViews:true,controlsLegible:true,noOverflow:true,
    fabricReadable:true,modelStable:true};
  const declined=evaluateDeviceQaEvidence({
    version:DEVICE_QA_EVIDENCE_VERSION,deviceClass:"mobile",viewport:"390x844",
    sampleDurationsMs:[...good,10001],checks,
  });
  assert.equal(declined.performancePass,false);
  assert.equal(declined.accepted,false);
});

test("one 2-second frozen frame cannot pass minimum-sample device acceptance via p95 masking",()=>{
  const timings=[...Array.from({length:11},()=>45),2000];
  const summary=summarizeDeviceQaDurations(timings);
  // The historical floor-rank p95 can exclude this one worst frame.
  assert.equal(summary.p95Ms,45);
  assert.equal(summary.maxMs,2000);
  const evaluation=evaluateDeviceQaEvidence({
    version:DEVICE_QA_EVIDENCE_VERSION,deviceClass:"mobile",viewport:"390x844",
    sampleDurationsMs:timings,
    checks:{fourViews:true,controlsLegible:true,noOverflow:true,fabricReadable:true,modelStable:true},
  });
  assert.equal(evaluation.performancePass,false);
  assert.equal(evaluation.accepted,false);
  assert.equal(evaluation.maxMs,2000);
});

test("real telemetry writer stamps viewport class and reader isolates same-tab classes",()=>{
  const oldWindow=Object.getOwnPropertyDescriptor(globalThis,"window");
  const oldStorage=Object.getOwnPropertyDescriptor(globalThis,"sessionStorage");
  const storage=new Map<string,string>();
  try{
    Object.defineProperty(globalThis,"window",{configurable:true,value:{innerWidth:390}});
    Object.defineProperty(globalThis,"sessionStorage",{configurable:true,value:{
      getItem:(key:string)=>storage.get(key)||null,
      setItem:(key:string,value:string)=>{storage.set(key,value);},
    }});
    recordPreviewPerformance("view",45);
    Object.defineProperty(globalThis,"window",{configurable:true,value:{innerWidth:1440}});
    recordPreviewPerformance("view",220);
    assert.equal(readPreviewPerformanceSamplesForDeviceClass("mobile").length,1);
    assert.equal(readPreviewPerformanceSamplesForDeviceClass("desktop").length,1);
    assert.equal(readPreviewPerformanceSummaryForDeviceClass("mobile").maxMs,45);
    assert.equal(readPreviewPerformanceSummaryForDeviceClass("desktop").maxMs,220);
    const raw=JSON.parse(storage.get(PREVIEW_PERFORMANCE_STORAGE_KEY)||"[]") as PreviewPerformanceSample[];
    assert.deepEqual(raw.map((item)=>item.deviceClass),["mobile","desktop"]);
  }finally{
    if(oldWindow) Object.defineProperty(globalThis,"window",oldWindow);
    else Reflect.deleteProperty(globalThis,"window");
    if(oldStorage) Object.defineProperty(globalThis,"sessionStorage",oldStorage);
    else Reflect.deleteProperty(globalThis,"sessionStorage");
  }
});
