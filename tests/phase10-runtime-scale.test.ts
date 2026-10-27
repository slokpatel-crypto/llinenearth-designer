import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRuntimeFabricScale,
  fabricTileSizePx,
  photoFabricPatternScale,
  photoExpectedRepeatPx,
  visiblePatternScaleVerified,
  LIVE_APPROXIMATE_TILE_PX,
  type FabricRenderAsset,
} from "../src/lib/designer/live-preview.ts";

const asset:FabricRenderAsset={
  tileUrl:"/fabric-tiles/test.webp",
  placeholderUrl:"/fabric-tiles/test-placeholder.webp",
  tileWidthPx:256,
  tileHeightPx:256,
  repeatDetected:true,
  repeatPeriodPx:32,
  orientation:"vertical",
  dominantHex:"#445566",
  scaleApproximate:true,
  tileRealWidthMm:null,
  renderAssetVersion:"fabric-tile-v2",
  tileStrategy:"direction_preserving_repeat",
};

test("runtime declared repeat makes live preview physically scaled",()=>{
  const scaled=applyRuntimeFabricScale(asset,{
    physicalScaleStatus:"declared_repeat",
    repeatMm:20,
    stripeWidthMm:null,
  });
  assert(scaled);
  assert.equal(scaled.scaleApproximate,false);
  assert.equal(scaled.tileRealWidthMm,160);
  assert(fabricTileSizePx(scaled)<fabricTileSizePx(asset));
});

test("runtime scale stays approximate without a detected pixel repeat",()=>{
  const noRepeat:FabricRenderAsset={...asset,repeatDetected:false,repeatPeriodPx:null};
  const scaled=applyRuntimeFabricScale(noRepeat,{
    physicalScaleStatus:"declared_swatch_width",
    repeatMm:null,
    stripeWidthMm:4,
  });
  assert.equal(scaled,noRepeat);
  assert.equal(scaled?.scaleApproximate,true);
});

test("unknown runtime physical scale does not override build asset",()=>{
  const scaled=applyRuntimeFabricScale(asset,{
    physicalScaleStatus:"unknown",
    repeatMm:20,
    stripeWidthMm:null,
  });
  assert.equal(scaled,asset);
});

test("declared swatch dimensions and stale detected periods never masquerade as repeat proof",()=>{
  const raw={physicalScaleStatus:"declared_repeat" as const,repeatMm:20,stripeWidthMm:null};
  assert.equal(applyRuntimeFabricScale(asset,{
    physicalScaleStatus:"declared_swatch_width",repeatMm:20,stripeWidthMm:4,
  }),asset);
  const stale={...asset,repeatDetected:false,repeatPeriodPx:32};
  assert.equal(applyRuntimeFabricScale(stale,raw),stale);
  assert.equal(applyRuntimeFabricScale({...asset,repeatPeriodPx:0},raw)?.scaleApproximate,true);
  assert.equal(applyRuntimeFabricScale({...asset,repeatPeriodPx:Number.NaN},raw)?.scaleApproximate,true);
  assert.equal(applyRuntimeFabricScale(asset,{...raw,repeatMm:Number.POSITIVE_INFINITY}),asset);
  assert.equal(applyRuntimeFabricScale({...asset,repeatPeriodPx:1e-300},{...raw,repeatMm:1e308})?.scaleApproximate,true);
});

test("nonfinite and invalid texture dimensions cannot pass a physical-scale audit",()=>{
  const invalid={...asset,scaleApproximate:false,tileRealWidthMm:Number.POSITIVE_INFINITY};
  assert.equal(fabricTileSizePx(invalid),LIVE_APPROXIMATE_TILE_PX);
  assert.equal(photoFabricPatternScale(invalid,1.12),1.12);
  assert.equal(visiblePatternScaleVerified("stripe",invalid),false);
  assert.equal(photoExpectedRepeatPx(invalid),null);
  const valid=applyRuntimeFabricScale(asset,{
    physicalScaleStatus:"declared_repeat",repeatMm:20,stripeWidthMm:null,
  });
  assert(valid);
  assert.equal(visiblePatternScaleVerified("stripe",valid),true);
  assert(photoExpectedRepeatPx(valid)!==null);
  assert.equal(photoExpectedRepeatPx({...valid,tileWidthPx:0}),null);
  assert.equal(photoExpectedRepeatPx({...valid,tileWidthPx:Number.POSITIVE_INFINITY}),null);
  assert.equal(photoExpectedRepeatPx({...valid,repeatDetected:false}),null);
});
