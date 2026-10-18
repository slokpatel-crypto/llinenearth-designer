import test from "node:test";
import assert from "node:assert/strict";
import { garmentPanelTextureScale, garmentPanelTextureScaleEvidence, resolveViewerTileWidthMm } from "../src/lib/garment-viewer-scale.ts";

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

test("unrecognized scale provenance never upgrades an approximate UV tile",()=>{
  // Runtime data can come from persisted JSON; an arbitrary status must fail closed.
  assert.equal(resolveViewerTileWidthMm(
    {tileRealWidthMm:null,repeatPeriodPx:32,scaleApproximate:true},
    {physicalScaleStatus:"estimated" as "declared_repeat",repeatMm:20},
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

test("physical repeat audit distinguishes exact scale from safety clamping",()=>{
  const exact=garmentPanelTextureScaleEvidence(580,780,40);
  assert.equal(exact.exactScaleWithinRendererLimits,true);
  assert.equal(exact.reason,"exact_within_limits");
  assert.deepEqual(exact.rawRepeats,{u:14.5,v:19.5});

  const clamped=garmentPanelTextureScaleEvidence(9000,780,40);
  assert.equal(clamped.reason,"renderer_clamped_repeat");
  assert.equal(clamped.exactScaleWithinRendererLimits,false);
  assert.equal(clamped.rawRepeats?.u,225);
  assert.equal(clamped.applied.u,80);

  const missing=garmentPanelTextureScaleEvidence(0,780,40);
  assert.equal(missing.reason,"missing_physical_dimensions");
  assert.equal(missing.exactScaleWithinRendererLimits,false);
  assert.equal(missing.rawRepeats,null);
});

test("repeat exactness uses the unchanged inclusive renderer limits",()=>{
  assert.equal(garmentPanelTextureScaleEvidence(35,8000,100).exactScaleWithinRendererLimits,true);
  assert.equal(garmentPanelTextureScaleEvidence(34,8000,100).exactScaleWithinRendererLimits,false);
  assert.equal(garmentPanelTextureScaleEvidence(35,8001,100).exactScaleWithinRendererLimits,false);
});

test("metric-UV garments use a single millimetre tile basis irrespective of garment width",()=>{
  const torso=garmentPanelTextureScale(580,780,40,"mesh_metres");
  const sleeve=garmentPanelTextureScale(180,540,40,"mesh_metres");
  const leg=garmentPanelTextureScale(220,930,40,"mesh_metres");
  assert.deepEqual(torso,{u:25,v:25});
  assert.deepEqual(sleeve,torso);
  assert.deepEqual(leg,torso);
  // One UV metre * 25 repeats = 25 tiles; .58m * 25 = 14.5 physical tiles.
  assert(Math.abs(.58*torso.u-580/40)<1e-10);
  assert(Math.abs(.18*sleeve.u-180/40)<1e-10);
  assert(Math.abs(.93*leg.v-930/40)<1e-10);
});

test("UV contract evidence cannot certify unmeasured or clamped metric repeat",()=>{
  const exact=garmentPanelTextureScaleEvidence(180,540,40,"mesh_metres");
  assert.equal(exact.exactScaleWithinRendererLimits,true);
  assert.deepEqual(exact.rawRepeats,{u:25,v:25});
  const clamped=garmentPanelTextureScaleEvidence(180,540,5,"mesh_metres");
  assert.equal(clamped.exactScaleWithinRendererLimits,false);
  assert.equal(clamped.reason,"renderer_clamped_repeat");
  assert.equal(clamped.applied.u,80);
  const unknown=garmentPanelTextureScaleEvidence(180,540,0,"mesh_metres");
  assert.equal(unknown.exactScaleWithinRendererLimits,false);
  assert.equal(unknown.reason,"missing_physical_dimensions");
});

test("legacy panel normalized UV interpretation is unaffected by optional metric contract",()=>{
  assert.deepEqual(garmentPanelTextureScale(580,780,40),
                   garmentPanelTextureScale(580,780,40,"normalized_panel"));
  assert.deepEqual(garmentPanelTextureScale(580,780,40,"normalized_panel"),{u:14.5,v:19.5});
});
