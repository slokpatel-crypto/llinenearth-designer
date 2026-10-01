import test from "node:test";
import assert from "node:assert/strict";
import { expectedPeriodPx, passesScaleGate, phase1ProofAcceptance, pxPerMmFromMarker, scaleErrorPct, summarizeIndependentRealism } from "../src/lib/designer/proof-scale.ts";
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
    realModelP95Ms:220,
    realismRatings:[5,4,4,5,4,5,3,2],
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
  });
  assert.equal(review.accepted,false);
  assert.equal(review.scaleReady,false);
  assert.equal(review.latencyReady,false);
  assert.equal(review.realismReady,false);
  assert.equal(review.reasons.length,3);
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
