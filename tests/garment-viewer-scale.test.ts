import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { garmentPanelTextureScale, resolveViewerTileWidthMm } from "../src/lib/garment-viewer-scale.ts";

test("verified render tile width stays authoritative",()=>{
  assert.equal(resolveViewerTileWidthMm(
    {tileRealWidthMm:120,repeatPeriodPx:32,scaleApproximate:false},
    {physicalScaleStatus:"declared_repeat",repeatMm:20},
  ),120);
});

test("reviewed runtime repeat upgrades an approximate tile using the live-preview basis",()=>{
  assert.equal(resolveViewerTileWidthMm(
    {tileRealWidthMm:null,repeatPeriodPx:32,repeatDetected:true,scaleApproximate:true},
    {physicalScaleStatus:"declared_repeat",repeatMm:20},
  ),160);
});

test("unknown or invalid scale remains unknown",()=>{
  assert.equal(resolveViewerTileWidthMm(
    {tileRealWidthMm:null,repeatPeriodPx:32,scaleApproximate:true},
    {physicalScaleStatus:"unknown",repeatMm:20},
  ),null);
  assert.equal(resolveViewerTileWidthMm(
    {tileRealWidthMm:null,repeatPeriodPx:null,scaleApproximate:true},
    {physicalScaleStatus:"declared_repeat",repeatMm:20},
  ),null);
});

test("panel UV scale preserves one physical tile size across unequal garment panels",()=>{
  const tileMm=40;
  const torso=garmentPanelTextureScale(580,780,tileMm);
  const sleeve=garmentPanelTextureScale(180,540,tileMm);
  assert.equal(torso.u,14.5);
  assert.equal(torso.v,19.5);
  assert.equal(sleeve.u,4.5);
  assert.equal(sleeve.v,13.5);
  assert.equal(580/torso.u,tileMm);
  assert.equal(780/torso.v,tileMm);
  assert.equal(180/sleeve.u,tileMm);
  assert.equal(540/sleeve.v,tileMm);
});

test("invalid panel geometry falls back safely",()=>{
  assert.deepEqual(garmentPanelTextureScale(0,540,40),{u:1,v:1});
  assert.deepEqual(garmentPanelTextureScale(180,540,0),{u:1,v:1});
});

test("3D cannot promote swatch width or undetected repeats to true scale",()=>{
  const asset={tileRealWidthMm:null,repeatPeriodPx:32,repeatDetected:true,scaleApproximate:true};
  assert.equal(resolveViewerTileWidthMm(asset,{physicalScaleStatus:"declared_swatch_width",repeatMm:20}),null);
  assert.equal(resolveViewerTileWidthMm({...asset,repeatDetected:false},{physicalScaleStatus:"declared_repeat",repeatMm:20}),null);
  assert.equal(resolveViewerTileWidthMm({...asset,repeatDetected:undefined},{physicalScaleStatus:"declared_repeat",repeatMm:20}),null);
});

test("coerced and overflowing runtime values cannot produce 3D tile widths",()=>{
  const asset={tileRealWidthMm:null,repeatPeriodPx:32,repeatDetected:true,scaleApproximate:true};
  for(const bad of ["20",null,0,-1,Number.NaN,Number.POSITIVE_INFINITY]){
    assert.equal(resolveViewerTileWidthMm(asset,{physicalScaleStatus:"declared_repeat",repeatMm:bad as number}),null);
  }
  assert.equal(resolveViewerTileWidthMm({...asset,repeatPeriodPx:1e-300},
    {physicalScaleStatus:"declared_repeat",repeatMm:1e300}),null);
  assert.equal(resolveViewerTileWidthMm({...asset,repeatPeriodPx:1e300},
    {physicalScaleStatus:"declared_repeat",repeatMm:1e-300}),null);
  assert.equal(resolveViewerTileWidthMm({...asset,repeatPeriodPx:"32" as unknown as number},
    {physicalScaleStatus:"declared_repeat",repeatMm:20}),null);
  assert.equal(resolveViewerTileWidthMm({tileRealWidthMm:"120" as unknown as number,scaleApproximate:false},
    {physicalScaleStatus:"unknown",repeatMm:null}),null);
});

test("3D manifest and tile builder retain observed-repeat evidence",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  const builder=readFileSync("scripts/build-fabric-render-assets.mjs","utf8");
  assert.match(viewer,/repeatDetected\?:boolean/);
  assert.match(builder,/repeatDetected:repeatDetected\?measured\.repeatPeriodPx:null|repeatPeriodPx:repeatDetected\?measured\.repeatPeriodPx:null/);
});
