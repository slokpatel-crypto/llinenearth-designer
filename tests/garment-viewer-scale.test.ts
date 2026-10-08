import test from "node:test";
import assert from "node:assert/strict";
import { garmentPanelTextureScale, resolveViewerTileWidthMm } from "../src/lib/garment-viewer-scale.ts";

test("verified render tile width stays authoritative",()=>{
  assert.equal(resolveViewerTileWidthMm(
    {tileRealWidthMm:120,repeatPeriodPx:32,scaleApproximate:false},
    {physicalScaleStatus:"declared_repeat",repeatMm:20},
  ),120);
});

test("reviewed runtime repeat upgrades an approximate tile using the live-preview basis",()=>{
  assert.equal(resolveViewerTileWidthMm(
    {tileRealWidthMm:null,repeatPeriodPx:32,scaleApproximate:true},
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

test("fine physical pinstripes keep exact 2 mm repeat size on every garment",()=>{
  const torso=garmentPanelTextureScale(480,750,2);
  const cuff=garmentPanelTextureScale(84,80,2);
  assert.deepEqual(torso,{u:240,v:375});
  assert.deepEqual(cuff,{u:42,v:40});
  assert.equal(480/torso.u,2);
  assert.equal(84/cuff.u,2);
});

test("large checks are not artificially reduced on narrow cuffs",()=>{
  const cuff=garmentPanelTextureScale(80,160,600);
  assert.ok(cuff.u<.35);
  assert.ok(cuff.v<.35);
  assert.ok(Math.abs(80/cuff.u-600)<1e-9);
  assert.ok(Math.abs(160/cuff.v-600)<1e-9);
});
