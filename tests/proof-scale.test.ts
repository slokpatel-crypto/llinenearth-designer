import test from "node:test";
import assert from "node:assert/strict";
import { expectedPeriodPx, passesScaleGate, pxPerMmFromMarker, scaleErrorPct } from "../src/lib/designer/proof-scale.ts";
import { applyRuntimeFabricScale, photoFabricPatternScale, visiblePatternScaleVerified, type FabricRenderAsset } from "../src/lib/designer/live-preview.ts";

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
