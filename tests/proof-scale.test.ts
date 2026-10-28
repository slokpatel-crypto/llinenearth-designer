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

test("invalid realism ratings cannot inflate unique viewer counts or acceptance",()=>{
  const result=summarizeIndependentRealism([
    ...Array.from({length:6},(_,index)=>({viewerId:"valid-"+index,rating:5})),
    {viewerId:"missing",rating:Number.NaN},
    {viewerId:"infinite",rating:Number.POSITIVE_INFINITY},
    {viewerId:"coerced",rating:"5" as unknown as number},
    {viewerId:"null-rating",rating:null as unknown as number},
  ]);
  assert.equal(result.uniqueViewers,6);
  assert.equal(result.strongRatings,6);
  assert.equal(result.ready,false);

  const gate=phase1ProofAcceptance({
    repeatMm:10,
    scaleGatePass:true,
    realModelSamples:12,
    realModelP95Ms:220,
    realismRatings:[5,5,5,5,5,5,Number.NaN,Number.POSITIVE_INFINITY],
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(gate.strongRatings,6);
  assert.equal(gate.realismReady,false);
  assert.equal(gate.accepted,false);
});

test("recorded proof cannot convert malformed reviewer JSON into independent ratings",()=>{
  const evidence=evaluateRecordedPhase1ProofEvidence({
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured repeat and photo reference with a ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSampleDurationsMs:Array(12).fill(200),
    realismAssessments:[
      ...Array.from({length:6},(_,index)=>({viewerId:"valid-"+index,rating:5})),
      {viewerId:"coerced",rating:"5"},
      {viewerId:"missing",rating:null},
    ],
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(evidence.realism.uniqueViewers,6);
  assert.equal(evidence.realism.strongRatings,6);
  assert.equal(evidence.acceptance.realismReady,false);
  assert.equal(evidence.coreAccepted,false);
});

test("coerced latency evidence cannot satisfy the minimum sample count",()=>{
  const result=summarizeLatencySamples([
    ...Array(11).fill(210),
    null,undefined,false,true,"", "220",{},Number.NaN,Number.POSITIVE_INFINITY,-1,10001,
  ]);
  assert.equal(result.count,11);
  assert.equal(result.p95Ms,210);
  assert.deepEqual(result.samples,Array(11).fill(210));

  const evidence=evaluateRecordedPhase1ProofEvidence({
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured repeat and the photo reference against a ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSampleDurationsMs:[...Array(11).fill(210),null,false,"220"],
    realismAssessments:Array.from({length:8},(_,index)=>({viewerId:`viewer-${index}`,rating:index<6?5:3})),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(evidence.realModelSamples,11);
  assert.equal(evidence.acceptance.latencyReady,false);
  assert.equal(evidence.coreAccepted,false);
});

test("direct proof acceptance rejects impossible latency and nonfinite physical scale",()=>{
  const valid={
    repeatMm:10,
    scaleGatePass:true,
    realModelSamples:12,
    realModelP95Ms:200,
    realismRatings:[5,5,5,5,5,5,3,3],
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  };
  assert.equal(phase1ProofAcceptance(valid).accepted,true);
  for(const malformed of [
    {realModelSamples:11.5},
    {realModelSamples:Number.POSITIVE_INFINITY},
    {realModelP95Ms:-1},
    {realModelP95Ms:Number.NaN},
    {realModelP95Ms:Number.NEGATIVE_INFINITY},
    {repeatMm:Number.POSITIVE_INFINITY},
    {repeatMm:Number.NaN},
  ]){
    const result=phase1ProofAcceptance({...valid,...malformed});
    assert.equal(result.accepted,false,JSON.stringify(malformed));
  }
});

test("extreme finite photo measurements fail closed rather than crash or certify scale",()=>{
  assert.throws(()=>pxPerMmFromMarker(1e308,1e-308),/finite/);
  assert.throws(()=>pxPerMmFromMarker(1e-308,1e308),/finite/);
  assert.throws(()=>expectedPeriodPx(1e308,1e308),/finite/);
  assert.throws(()=>expectedPeriodPx(1e-308,1e-308),/finite/);

  const base={
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured repeat and photo reference with a ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSampleDurationsMs:Array(12).fill(210),
    realismAssessments:Array.from({length:8},(_,index)=>({viewerId:`viewer-${index}`,rating:index<6?5:3})),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  };
  assert.equal(evaluateRecordedPhase1ProofEvidence(base).scaleGatePass,true);
  for(const reference of [
    {photoReferencePx:1e308,photoReferenceMm:1e-308},
    {photoReferencePx:1e-308,photoReferenceMm:1e308},
    {photoReferencePx:1e308,photoReferenceMm:1},
  ]){
    const evidence=evaluateRecordedPhase1ProofEvidence({...base,...reference});
    assert.equal(evidence.scaleGatePass,false);
    assert.equal(evidence.coreAccepted,false);
  }
});


test("realism proof refuses fractional ratings and non-string reviewer identities",()=>{
  const legitimate=Array.from({length:6},(_,index)=>({viewerId:`valid-${index}`,rating:5}));
  const result=summarizeIndependentRealism([
    ...legitimate,
    {viewerId:"fraction-strong",rating:4.5},
    {viewerId:"fraction-low",rating:3.5},
    {viewerId:123 as unknown as string,rating:5},
    {viewerId:{id:"fake"} as unknown as string,rating:5},
    null as unknown as {viewerId:string,rating:number},
  ]);
  assert.equal(result.uniqueViewers,6);
  assert.equal(result.strongRatings,6);
  assert.equal(result.ready,false);
  const direct=phase1ProofAcceptance({
    repeatMm:10,
    scaleGatePass:true,
    realModelSamples:12,
    realModelP95Ms:200,
    realismRatings:[5,5,5,5,5,5,4.5,3.5],
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(direct.realismReady,false);
  assert.equal(direct.accepted,false);
});

test("recorded physical proof never converts JSON strings, null or booleans into measurements",()=>{
  const base={
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured repeat and photo reference with a steel ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSampleDurationsMs:Array(12).fill(210),
    realismAssessments:Array.from({length:8},(_,index)=>({viewerId:`viewer-${index}`,rating:index<6?5:3})),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  };
  assert.equal(evaluateRecordedPhase1ProofEvidence(base).coreAccepted,true);
  for(const bad of [
    {repeatMm:"10"},
    {repeatMm:true},
    {repeatMm:null},
    {measuredPreviewRepeatPx:"8.2"},
    {measuredPreviewRepeatPx:true},
    {photoReferenceMm:"100"},
    {photoReferenceMm:null},
    {photoReferencePx:"82"},
    {photoReferencePx:true},
    {physicalEvidenceNote:{note:base.physicalEvidenceNote}},
  ]){
    const proof=evaluateRecordedPhase1ProofEvidence({...base,...bad});
    assert.equal(proof.coreAccepted,false,JSON.stringify(bad));
    assert.equal(proof.scaleGatePass,false,JSON.stringify(bad));
  }
});

test("recorded proof cannot count fractional or object-identity reviews",()=>{
  const evidence=evaluateRecordedPhase1ProofEvidence({
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured repeat and photo reference with a steel ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSampleDurationsMs:Array(12).fill(210),
    realismAssessments:[
      ...Array.from({length:6},(_,index)=>({viewerId:`valid-${index}`,rating:5})),
      {viewerId:"fraction",rating:4.5},
      {viewerId:{id:"forged"},rating:5},
      {viewerId:"fraction-low",rating:3.5},
    ],
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  });
  assert.equal(evidence.realism.uniqueViewers,6);
  assert.equal(evidence.acceptance.realismReady,false);
  assert.equal(evidence.coreAccepted,false);
});


test("array-coerced version and coordinate labels cannot satisfy Phase 1 evidence contract",()=>{
  const base={
    version:"linen-earth-phase1-proof-v4",
    scaleCoordinateSystem:"photo-1024x1536-fixture",
    repeatMm:10,
    physicalEvidenceNote:"Owner measured repeat and photo reference with a steel ruler.",
    photoReferenceMm:100,
    photoReferencePx:82,
    measuredPreviewRepeatPx:8.2,
    realModelSampleDurationsMs:Array(12).fill(210),
    realismAssessments:Array.from({length:8},(_,index)=>({viewerId:`viewer-${index}`,rating:index<6?5:3})),
    boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
  };
  assert.equal(evaluateRecordedPhase1ProofEvidence(base).coreAccepted,true);
  for(const spoofed of [
    {version:[base.version]},
    {scaleCoordinateSystem:[base.scaleCoordinateSystem]},
    {version:{toString:()=>base.version}},
    {scaleCoordinateSystem:{toString:()=>base.scaleCoordinateSystem}},
  ]){
    const proof=evaluateRecordedPhase1ProofEvidence({...base,...spoofed});
    assert.equal(proof.scaleGatePass,false);
    assert.equal(proof.coreAccepted,false);
  }
});


test("malformed recorded proof envelopes return blocked evidence without throwing",()=>{
  for(const malformed of [null,undefined,[],[{}],"",false,42]){
    const result=evaluateRecordedPhase1ProofEvidence(malformed as unknown as Record<string,unknown>);
    assert.equal(result.coreAccepted,false);
    assert.equal(result.scaleGatePass,false);
    assert.equal(result.realModelSamples,0);
    assert.equal(result.realism.uniqueViewers,0);
  }
});


test("direct realism aggregator treats malformed envelope types as no evidence",()=>{
  for(const malformed of [null,undefined,{},42,"reviewer",false]){
    const result=summarizeIndependentRealism(malformed);
    assert.equal(result.uniqueViewers,0);
    assert.equal(result.ready,false);
  }
  assert.equal(summarizeIndependentRealism([{viewerId:"valid",rating:5}]).uniqueViewers,1);
});
