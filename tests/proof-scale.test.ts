import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRecordedPhase1ProofEvidence, expectedPeriodPx, passesScaleGate, phase1ProofAcceptance, pxPerMmFromMarker, scaleErrorPct, summarizeIndependentRealism, summarizeLatencySamples } from "../src/lib/designer/proof-scale.ts";
import { applyRuntimeFabricScale, photoExpectedRepeatPx, photoFabricPatternScale, visiblePatternScaleVerified, LIVE_MODEL_PX_PER_MM, PHOTO_MODEL_COORDINATE_SCALE, type FabricRenderAsset } from "../src/lib/designer/live-preview.ts";

test("calibrates px/mm from a known marker",()=>{
  assert.equal(pxPerMmFromMarker(2362,100),23.62);
});

test("maps 5 mm and 10 mm repeats to exact pixel periods",()=>{
  assert.ok(Math.abs(expectedPeriodPx(5,23.62)-118.1)<1e-9);
  assert.ok(Math.abs(expectedPeriodPx(10,23.62)-236.2)<1e-9);
});

test("scale gate accepts <= 8 percent error and rejects larger drift",()=>{
  const pxPerMm=2;
  assert.equal(passesScaleGate(10.79,5,pxPerMm),true);
  assert.equal(passesScaleGate(10.81,5,pxPerMm),false);
});

test("error calculation is symmetric around the expected period",()=>{
  const pxPerMm=4;
  assert.equal(scaleErrorPct(18,5,pxPerMm),10);
  assert.equal(scaleErrorPct(22,5,pxPerMm),10);
});

test("runtime declared repeat calibrates the photographic preview asset",()=>{
  const asset:FabricRenderAsset={
    tileUrl:"/fabric-tiles/test.webp",
    placeholderUrl:"/fabric-tiles/test-placeholder.webp",
    tileWidthPx:256,
    tileHeightPx:256,
    repeatDetected:true,
    repeatPeriodPx:20,
    orientation:"vertical",
    dominantHex:"#ffffff",
    scaleApproximate:true,
    tileRealWidthMm:null,
    renderAssetVersion:"test",
  };
  const calibrated=applyRuntimeFabricScale(asset,{physicalScaleStatus:"declared_repeat",repeatMm:5,stripeWidthMm:null});
  assert.equal(calibrated?.scaleApproximate,false);
  assert.equal(calibrated?.tileRealWidthMm,64);
  assert.ok((photoFabricPatternScale(calibrated,1.02))<1.02);
});

test("unknown runtime scale never fabricates a physical calibration",()=>{
  const asset:FabricRenderAsset={
    tileUrl:"/fabric-tiles/test.webp",
    placeholderUrl:"/fabric-tiles/test-placeholder.webp",
    tileWidthPx:256,
    tileHeightPx:256,
    repeatDetected:true,
    repeatPeriodPx:20,
    orientation:"vertical",
    dominantHex:"#ffffff",
    scaleApproximate:true,
    tileRealWidthMm:null,
    renderAssetVersion:"test",
  };
  const untouched=applyRuntimeFabricScale(asset,{physicalScaleStatus:"unknown",repeatMm:null,stripeWidthMm:null});
  assert.equal(untouched?.scaleApproximate,true);
  assert.equal(untouched?.tileRealWidthMm,null);
});


test("visible scale verification is true for solids without physical repeat data",()=>{
  assert.equal(visiblePatternScaleVerified("Solid",null),true);
});

test("visible scale verification requires real width for patterned cloth",()=>{
  const approximate:FabricRenderAsset={
    tileUrl:"/fabric-tiles/test.webp",
    placeholderUrl:"/fabric-tiles/test-placeholder.webp",
    tileWidthPx:256,
    tileHeightPx:256,
    repeatDetected:true,
    repeatPeriodPx:20,
    orientation:"vertical",
    dominantHex:"#ffffff",
    scaleApproximate:true,
    tileRealWidthMm:null,
    renderAssetVersion:"test",
  };
  assert.equal(visiblePatternScaleVerified("Stripe",approximate),false);
  assert.equal(visiblePatternScaleVerified("Stripe",{...approximate,scaleApproximate:false,tileRealWidthMm:64}),true);
});


test("photographic repeat audit matches the physical model scale",()=>{
  const asset:FabricRenderAsset={
    tileUrl:"/fabric-tiles/test.webp",
    placeholderUrl:"/fabric-tiles/test-placeholder.webp",
    tileWidthPx:256,
    tileHeightPx:256,
    repeatDetected:true,
    repeatPeriodPx:20,
    orientation:"vertical",
    dominantHex:"#ffffff",
    scaleApproximate:true,
    tileRealWidthMm:null,
    renderAssetVersion:"test",
  };
  const calibrated=applyRuntimeFabricScale(asset,{physicalScaleStatus:"declared_repeat",repeatMm:5,stripeWidthMm:null});
  const expected=5*LIVE_MODEL_PX_PER_MM*PHOTO_MODEL_COORDINATE_SCALE;
  const actual=photoExpectedRepeatPx(calibrated);
  assert.ok(actual!==null);
  assert.ok(Math.abs((actual as number)-expected)<1e-9);
});

test("photographic repeat audit stays unavailable without physical scale",()=>{
  const asset:FabricRenderAsset={
    tileUrl:"/fabric-tiles/test.webp",
    placeholderUrl:"/fabric-tiles/test-placeholder.webp",
    tileWidthPx:256,
    tileHeightPx:256,
    repeatDetected:true,
    repeatPeriodPx:20,
    orientation:"vertical",
    dominantHex:"#ffffff",
    scaleApproximate:true,
    tileRealWidthMm:null,
    renderAssetVersion:"test",
  };
  assert.equal(photoExpectedRepeatPx(asset),null);
});


test("phase 1 proof acceptance requires physical scale, latency samples and realism",()=>{
  const accepted=phase1ProofAcceptance({
    repeatMm:10,
    scaleGatePass:true,
    realModelSamples:12,
    realModelP95Ms:222,
    realismRatings:[5,4,4,5,4,5,3,2],
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(accepted.accepted,true);
  assert.equal(accepted.strongRatings,6);
});

test("phase 1 proof remains review when any real-world gate is missing",()=>{
  const review=phase1ProofAcceptance({
    repeatMm:null,
    scaleGatePass:null,
    realModelSamples:4,
    realModelP95Ms:180,
    realismRatings:[5,5,5],
    boundaryChecks:{neck:false,cuffs:false,waist:false,trouserGap:false},
  });
  assert.equal(review.accepted,false);
  assert.equal(review.scaleReady,false);
  assert.equal(review.latencyReady,false);
  assert.equal(review.realismReady,false);
  assert.equal(review.boundaryReady,false);
  assert.equal(review.reasons.length,4);
});


test("realism evidence counts the latest rating from each anonymous viewer only",()=>{
  const result=summarizeIndependentRealism([
    {viewerId:"V01",rating:3},
    {viewerId:"v01",rating:5},
    {viewerId:"V02",rating:4},
    {viewerId:"V03",rating:4},
    {viewerId:"V04",rating:5},
    {viewerId:"V05",rating:4},
    {viewerId:"V06",rating:4},
    {viewerId:"V07",rating:3},
    {viewerId:"V08",rating:2},
  ]);
  assert.equal(result.uniqueViewers,8);
  assert.equal(result.strongRatings,6);
  assert.equal(result.ready,true);
  assert.equal(result.ratings.filter((rating)=>rating===5).length,2);
});

test("duplicate viewer clicks cannot satisfy the independent realism gate",()=>{
  const result=summarizeIndependentRealism(Array.from({length:8},(_,index)=>({
    viewerId:"same-viewer",
    rating:index%2?4:5,
  })));
  assert.equal(result.uniqueViewers,1);
  assert.equal(result.ready,false);
});


test("photographic repeat audit can use a measured photo-coordinate px/mm calibration",()=>{
  const asset:FabricRenderAsset={
    tileUrl:"/fabric-tiles/test.webp",
    placeholderUrl:"/fabric-tiles/test-placeholder.webp",
    tileWidthPx:256,
    tileHeightPx:256,
    repeatDetected:true,
    repeatPeriodPx:20,
    orientation:"vertical",
    dominantHex:"#ffffff",
    scaleApproximate:true,
    tileRealWidthMm:null,
    renderAssetVersion:"test",
  };
  const calibrated=applyRuntimeFabricScale(asset,{physicalScaleStatus:"declared_repeat",repeatMm:10,stripeWidthMm:null});
  const photoPxPerMm=0.82;
  const expected=10*photoPxPerMm;
  const actual=photoExpectedRepeatPx(calibrated,photoPxPerMm);
  assert.ok(actual!==null);
  assert.ok(Math.abs((actual as number)-expected)<1e-9);
});

test("measured photo px/mm changes physical pattern scale without changing approximate fabrics",()=>{
  const asset:FabricRenderAsset={
    tileUrl:"/fabric-tiles/test.webp",
    placeholderUrl:"/fabric-tiles/test-placeholder.webp",
    tileWidthPx:256,
    tileHeightPx:256,
    repeatDetected:true,
    repeatPeriodPx:32,
    orientation:"vertical",
    dominantHex:"#ffffff",
    scaleApproximate:false,
    tileRealWidthMm:80,
    renderAssetVersion:"test",
  };
  const measured=photoFabricPatternScale(asset,1,0.9);
  const alternate=photoFabricPatternScale(asset,1,0.7);
  assert.ok(measured>alternate);
  assert.equal(photoFabricPatternScale({...asset,scaleApproximate:true},1,0.9),1);
});


test("recorded Phase 1 v4 evidence is recomputed from raw scale, latency, viewer and boundary evidence",()=>{
  const evidence=evaluateRecordedPhase1ProofEvidence({
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured the repeat and photo calibration fixture with a steel ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    photoPxPerMm:999,
    measuredPreviewRepeatPx:8.2,
    scaleGatePass:false,
    status:"review",
    realModelSamples:999,
    realModelP95Ms:1,
    realModelSampleDurationsMs:[180,190,200,205,210,215,218,219,220,220,221,222],
    realismAssessments:[
      {viewerId:"V01",rating:5},{viewerId:"V02",rating:4},{viewerId:"V03",rating:4},{viewerId:"V04",rating:5},
      {viewerId:"V05",rating:4},{viewerId:"V06",rating:4},{viewerId:"V07",rating:3},{viewerId:"V08",rating:2},
    ],
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(evidence.photoPxPerMm,0.82);
  assert.equal(evidence.scaleGatePass,true);
  assert.equal(evidence.realModelSamples,12);
  assert.equal(evidence.realModelP95Ms,222);
  assert.equal(evidence.realism.uniqueViewers,8);
  assert.equal(evidence.realism.strongRatings,6);
  assert.equal(evidence.boundaryReady,true);
  assert.equal(evidence.coreAccepted,true);
});

test("legacy or client-spoofed Phase 1 flags cannot satisfy the v4 evidence gate",()=>{
  const evidence=evaluateRecordedPhase1ProofEvidence({
    version:"linen-earth-phase1-proof-v1",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured the repeat and photo calibration fixture with a steel ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    scaleGatePass:true,
    realismPass:true,
    status:"accepted",
    realModelSamples:99,
    realModelP95Ms:10,
    realModelSampleDurationsMs:Array(12).fill(20),
    realismAssessments:Array.from({length:8},(_,index)=>({viewerId:`V${index}`,rating:5})),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(evidence.photoPxPerMm,null);
  assert.equal(evidence.scaleGatePass,false);
  assert.equal(evidence.coreAccepted,false);
});


test("Phase 1 physical evidence cannot pass without an auditable provenance note",()=>{
  const evidence=evaluateRecordedPhase1ProofEvidence({
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSamples:999,
    realModelP95Ms:1,
    realModelSampleDurationsMs:[180,190,200,205,210,215,218,219,220,220,221,222],
    realismAssessments:Array.from({length:8},(_,index)=>({viewerId:`V${index}`,rating:index<6?5:3})),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(evidence.physicalEvidenceReady,false);
  assert.equal(evidence.scaleGatePass,false);
  assert.equal(evidence.coreAccepted,false);
});


test("Phase 1 core proof cannot pass until every garment boundary is visually checked",()=>{
  const evidence=evaluateRecordedPhase1ProofEvidence({
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured the repeat and photo fixture against a steel ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSamples:999,
    realModelP95Ms:1,
    realModelSampleDurationsMs:[180,190,200,205,210,215,218,219,220,220,221,222],
    realismAssessments:Array.from({length:8},(_,index)=>({viewerId:`V${index}`,rating:index<6?5:3})),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:false},
  });
  assert.equal(evidence.scaleGatePass,true);
  assert.equal(evidence.realism.ready,true);
  assert.equal(evidence.boundaryReady,false);
  assert.equal(evidence.coreAccepted,false);
  assert.match(evidence.acceptance.reasons.join(" "),/trouser-gap/i);
});


test("Phase 1 v4 ignores spoofed latency aggregates and requires raw render samples",()=>{
  const evidence=evaluateRecordedPhase1ProofEvidence({
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured repeat and the fixed photo reference with a steel ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSamples:999,
    realModelP95Ms:1,
    realismAssessments:Array.from({length:8},(_,index)=>({viewerId:`V${index}`,rating:index<6?5:3})),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(evidence.realModelSamples,0);
  assert.equal(evidence.realModelP95Ms,null);
  assert.equal(evidence.acceptance.latencyReady,false);
  assert.equal(evidence.coreAccepted,false);
});


test("raw latency summary recomputes p95 and ignores invalid samples",()=>{
  const result=summarizeLatencySamples([10,20,30,40,50,60,70,80,90,100,110,120,-5,Number.NaN,20000]);
  assert.equal(result.count,12);
  assert.equal(result.medianMs,60);
  assert.equal(result.p95Ms,120);
  assert.equal(result.maxMs,120);
});

test("latency evidence refuses coerced zeros and preserves exact positive measurements",()=>{
  const raw=[null,false,"10","",0,NaN,-1,10001,0.02,100.004,299.96];
  const summary=summarizeLatencySamples(raw);
  assert.deepEqual(summary.samples,[0.02,100.004,299.96]);
  assert.equal(summary.count,3);
  assert.equal(summary.medianMs,100.004);
  assert.equal(summary.p95Ms,299.96);
  assert.equal(summarizeLatencySamples(Array(12).fill(null)).count,0);
  assert.equal(summarizeLatencySamples(Array(12).fill(0)).p95Ms,null);
});

test("strict 300ms p95 gate does not round up a valid 299.96ms sample",()=>{
  const passing=summarizeLatencySamples(Array(12).fill(299.96));
  const failing=summarizeLatencySamples(Array(12).fill(300.04));
  assert.ok(passing.p95Ms!==null && passing.p95Ms<300);
  assert.ok(failing.p95Ms!==null && failing.p95Ms>=300);
  assert.equal(phase1ProofAcceptance({
    repeatMm:10,scaleGatePass:true,realModelSamples:passing.count,
    realModelP95Ms:passing.p95Ms,realismRatings:[5,5,5,5,5,5,3,3],
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  }).accepted,true);
  assert.equal(phase1ProofAcceptance({
    repeatMm:10,scaleGatePass:true,realModelSamples:failing.count,
    realModelP95Ms:failing.p95Ms,realismRatings:[5,5,5,5,5,5,3,3],
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  }).accepted,false);
});

test("independent realism ratings cannot count NaN, fractional, coerced or truncated identities",()=>{
  const legitimate=Array.from({length:6},(_,i)=>({viewerId:`review-${i}`,rating:5}));
  const invalid=[
    {viewerId:"bad-missing",rating:undefined},
    {viewerId:"bad-string",rating:"5"},
    {viewerId:"bad-fraction",rating:4.6},
    {viewerId:"bad-null",rating:null},
    {viewerId:"x".repeat(81),rating:5},
    {viewerId:32,rating:5},
  ];
  const result=summarizeIndependentRealism([...legitimate,...invalid] as never);
  assert.equal(result.uniqueViewers,6);
  assert.equal(result.strongRatings,6);
  assert.equal(result.ready,false);
});

test("historical Phase 1 proof cannot convert non-measured viewer scores into approvals",()=>{
  const base={
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured the repeat and photo calibration fixture with a steel ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSampleDurationsMs:Array(12).fill(200),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  };
  const verified=Array.from({length:8},(_,i)=>({viewerId:`review-${i}`,rating:5}));
  assert.equal(evaluateRecordedPhase1ProofEvidence({...base,realismAssessments:verified}).coreAccepted,true);
  for(const bad of [
    {viewerId:"bad-score",rating:"5"},
    {viewerId:"bad-fraction",rating:4.6},
    {viewerId:"bad-missing"},
    {viewerId:"y".repeat(81),rating:5},
    {viewerId:42,rating:5},
  ]){
    const result=evaluateRecordedPhase1ProofEvidence({
      ...base,realismAssessments:[...verified.slice(0,7),bad],
    });
    assert.equal(result.realism.uniqueViewers,7,JSON.stringify(bad));
    assert.equal(result.coreAccepted,false,JSON.stringify(bad));
  }
});
