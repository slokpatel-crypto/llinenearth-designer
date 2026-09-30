import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRuntimeFabricScale,
  fabricTileSizePx,
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
