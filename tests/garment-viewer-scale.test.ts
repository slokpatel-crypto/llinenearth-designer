import test from "node:test";
import assert from "node:assert/strict";
import { canPaintGarmentPanelMaterial, canApplyViewerTextureUvTransform, applyViewerTextureUvTransform, garmentPanelTextureScale, garmentPanelTexturePreparationKey, prepareGarmentPanelUvTransforms, garmentPanelTextureScaleEvidence, garmentUvRepeatsForUnits, hasInvalidVerifiedViewerTileHeight, hasInvalidVerifiedViewerTileWidth, resolveViewerTileHeightMm, resolveViewerTileWidthMm } from "../src/lib/garment-viewer-scale.ts";


test("the complete six-panel texture adapter must be paintable before any visible update",()=>{
  const full=()=>({
    pbrMetallicRoughness:{
      baseColorTexture:{setTexture:(_texture:unknown)=>{}},
      setBaseColorFactor:(_value:unknown)=>{},
      setMetallicFactor:(_value:number)=>{},
      setRoughnessFactor:(_value:number)=>{},
    },
  });
  const six=Array.from({length:6},full);
  assert.equal(six.every(canPaintGarmentPanelMaterial),true);
  for(const broken of [
    null,undefined,{},{pbrMetallicRoughness:{}},
    {...full(),pbrMetallicRoughness:{...full().pbrMetallicRoughness,baseColorTexture:null}},
    {...full(),pbrMetallicRoughness:{...full().pbrMetallicRoughness,baseColorTexture:{}}},
    {...full(),pbrMetallicRoughness:{...full().pbrMetallicRoughness,setRoughnessFactor:"unavailable"}},
  ]){
    assert.equal(canPaintGarmentPanelMaterial(broken),false);
    assert.equal([...six.slice(0,5),broken].every(canPaintGarmentPanelMaterial),false,
      "One non-paintable panel invalidates the full outfit");
  }
});

test("physical-scale resolution never coerces unreviewed JSON strings",()=>{
  const declared={physicalScaleStatus:"declared_repeat" as const,repeatMm:20};
  assert.equal(resolveViewerTileWidthMm(
    {tileRealWidthMm:"40" as unknown as number,scaleApproximate:false}, declared
  ),null);
  assert.equal(resolveViewerTileWidthMm(
    {repeatPeriodPx:"32" as unknown as number,scaleApproximate:true}, declared
  ),null);
  assert.equal(resolveViewerTileWidthMm(
    {repeatPeriodPx:32,scaleApproximate:true},
    {physicalScaleStatus:"declared_repeat",repeatMm:"20" as unknown as number}
  ),null);
});

test("computed textile repeat must stay finite and positive",()=>{
  assert.equal(resolveViewerTileWidthMm(
    {repeatPeriodPx:1,scaleApproximate:true},
    {physicalScaleStatus:"declared_repeat",repeatMm:1e308}
  ),null);
  assert.equal(resolveViewerTileWidthMm(
    {repeatPeriodPx:1e308,scaleApproximate:true},
    {physicalScaleStatus:"declared_repeat",repeatMm:1e-300}
  ),null);
});

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

test("normalized and metre UV coordinate units preserve equal real repeat distance",()=>{
  const tileMm=40;
  const panel={widthMm:580,heightMm:780};
  const normalized=garmentUvRepeatsForUnits("panel_normalized",panel.widthMm,panel.heightMm,tileMm);
  const metric=garmentUvRepeatsForUnits("mesh_metres",panel.widthMm,panel.heightMm,tileMm);
  assert.deepEqual(normalized,{u:14.5,v:19.5});
  assert.deepEqual(metric,{u:25,v:25});
  assert.equal(panel.widthMm/normalized!.u,tileMm);
  assert.equal(panel.heightMm/normalized!.v,tileMm);
  assert.equal(1000/metric!.u,tileMm);
  assert.equal(1000/metric!.v,tileMm);
});

test("unknown UV convention and renderer-clamped repeats refuse physical approval",()=>{
  assert.equal(garmentUvRepeatsForUnits("unknown",580,780,40),null);
  assert.equal(garmentUvRepeatsForUnits("panel_normalized",9000,780,40),null);
  assert.equal(garmentUvRepeatsForUnits("mesh_metres",580,780,1),null);
  assert.equal(garmentUvRepeatsForUnits("mesh_metres",580,780,0),null);
  assert.equal(garmentUvRepeatsForUnits("mesh_metres",0,780,40),null);
  assert.equal(garmentUvRepeatsForUnits("mesh_metres",580,NaN,40),null);
  assert.equal(garmentUvRepeatsForUnits("unexpected" as "mesh_metres",580,780,40),null);
});

test("verified rectangular swatch tiles preserve independent horizontal and vertical millimetres",()=>{
  const tile={tileRealWidthMm:40,tileRealHeightMm:20,scaleApproximate:false};
  assert.equal(resolveViewerTileHeightMm(tile),20);
  const normalized=garmentUvRepeatsForUnits("panel_normalized",580,780,40,20);
  const metric=garmentUvRepeatsForUnits("mesh_metres",580,780,40,20);
  assert.deepEqual(normalized,{u:14.5,v:39});
  assert.deepEqual(metric,{u:25,v:50});
  assert.equal(580/normalized!.u,40);
  assert.equal(780/normalized!.v,20);
  assert.equal(1000/metric!.u,40);
  assert.equal(1000/metric!.v,20);
});

test("unverified vertical repeat never upgrades fabric evidence",()=>{
  assert.equal(resolveViewerTileHeightMm({tileRealHeightMm:20,scaleApproximate:true}),null);
  assert.equal(resolveViewerTileHeightMm({tileRealHeightMm:20}),null);
  assert.equal(resolveViewerTileHeightMm({tileRealHeightMm:null,scaleApproximate:false}),null);
  assert.equal(resolveViewerTileHeightMm({tileRealHeightMm:NaN,scaleApproximate:false}),null);
  assert.deepEqual(garmentUvRepeatsForUnits("mesh_metres",580,780,40),{u:25,v:25});
});

test("invalid and clamped rectangular textile dimensions fail closed independently by axis",()=>{
  assert.equal(garmentUvRepeatsForUnits("mesh_metres",580,780,40,1),null);
  assert.equal(garmentUvRepeatsForUnits("mesh_metres",580,780,40,0),null);
  assert.equal(garmentUvRepeatsForUnits("panel_normalized",580,780,40,-20),null);
  assert.equal(garmentUvRepeatsForUnits("panel_normalized",580,780,40,NaN),null);
  assert.equal(garmentPanelTextureScaleEvidence(580,780,40,5).reason,"renderer_clamped_repeat");
  assert.deepEqual(garmentPanelTextureScaleEvidence(580,780,40,20).rawRepeats,{u:14.5,v:39});
});


test("malformed measured U dimension cannot be re-labelled from fallback runtime calibration",()=>{
  const runtime={physicalScaleStatus:"declared_repeat" as const,repeatMm:20};
  for(const width of [0,-1,NaN,Infinity,"40",false]) {
    assert.equal(resolveViewerTileWidthMm({scaleApproximate:false,tileRealWidthMm:width as number,
      repeatPeriodPx:32},runtime),null);
  }
  assert.equal(resolveViewerTileWidthMm({scaleApproximate:false,tileRealWidthMm:null,repeatPeriodPx:32},runtime),160);
});

test("legacy square tile remains allowed, malformed explicit verified vertical dimension fails closed",()=>{
  assert.equal(hasInvalidVerifiedViewerTileHeight({scaleApproximate:false,tileRealHeightMm:null}),false);
  assert.equal(hasInvalidVerifiedViewerTileHeight({scaleApproximate:false}),false);
  assert.equal(hasInvalidVerifiedViewerTileHeight({scaleApproximate:true,tileRealHeightMm:0}),false);
  assert.equal(hasInvalidVerifiedViewerTileHeight({scaleApproximate:false,tileRealHeightMm:24}),false);
  for(const height of [0,-2,NaN,Infinity,"24",true]){
    assert.equal(hasInvalidVerifiedViewerTileHeight({scaleApproximate:false,tileRealHeightMm:height as number}),true);
  }
});


test("explicit malformed horizontal measurements are rejected before visual texture allocation",()=>{
  assert.equal(hasInvalidVerifiedViewerTileWidth({scaleApproximate:false,tileRealWidthMm:40}),false);
  assert.equal(hasInvalidVerifiedViewerTileWidth({scaleApproximate:false,tileRealWidthMm:null}),false);
  assert.equal(hasInvalidVerifiedViewerTileWidth({scaleApproximate:true,tileRealWidthMm:0}),false);
  for(const width of [0,-20,Infinity,NaN,"40",true]) {
    assert.equal(hasInvalidVerifiedViewerTileWidth({scaleApproximate:false,tileRealWidthMm:width as number}),true);
  }
});


test("texture re-use signature preserves unchanged opposite garment and isolates UV/model changes",()=>{
  const original={modelKey:"model-a",panelMaterial:"TrouserLegLFabric",
    fabricUrl:"/cloth/taupe.png",normalUrl:"data:normal",u:25,v:50,offsetU:0,offsetV:0,rotation:0};
  const key=garmentPanelTexturePreparationKey(original);
  assert.equal(key,garmentPanelTexturePreparationKey({...original}));
  for(const change of [
    {fabricUrl:"/cloth/cream.png"},{modelKey:"model-b"},{panelMaterial:"TrouserLegRFabric"},
    {u:20},{v:49},{offsetU:0.1},{offsetV:0.1},{rotation:1},{normalUrl:"data:other-normal"},
  ]) assert.notEqual(key,garmentPanelTexturePreparationKey({...original,...change}));
});

test("six garment panels are planned together using independent verified U/V repeats",()=>{
  const panels=["ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
    "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric"].map((material,index)=>({
    material,widthMm:580,heightMm:780,tileWidthMm:40,tileHeightMm:20,
    offsetU:index===1?.25:0,offsetV:index===2?-.125:0,rotationDeg:index===3?45:0,
  }));
  const metric=prepareGarmentPanelUvTransforms("mesh_metres",panels)!;
  assert.equal(metric.length,6);
  assert.deepEqual(metric[0].scale,{u:25,v:50});
  assert.deepEqual(metric[1].offset,{u:.25,v:0});
  assert.deepEqual(metric[2].offset,{u:0,v:-.125});
  assert.equal(metric[3].rotation,Math.PI/4);
  assert.deepEqual(prepareGarmentPanelUvTransforms("panel_normalized",panels)![0].scale,{u:14.5,v:39});
});

test("invalid final panel rejects the entire preparation instead of allowing partial GPU allocation",()=>{
  const valid={material:"ShirtTorsoFabric",widthMm:580,heightMm:780,tileWidthMm:40,tileHeightMm:20};
  for(const invalid of [
    {...valid,material:"TrouserLegRFabric",tileHeightMm:0},
    {...valid,material:"TrouserLegRFabric",widthMm:Infinity},
    {...valid,material:"TrouserLegRFabric",rotationDeg:"90" as unknown as number},
    {...valid,material:"TrouserLegRFabric",offsetV:NaN},
    {...valid,material:"TrouserLegRFabric",offsetU:11},
    {...valid,material:"TrouserLegRFabric",tileWidthMm:"40" as unknown as number},
  ]) assert.equal(prepareGarmentPanelUvTransforms("mesh_metres",[valid,invalid]),null);
});

test("metric scale limits, unknown units, duplicate panels and invalid phase controls fail closed",()=>{
  const valid={material:"ShirtTorsoFabric",widthMm:580,heightMm:780,tileWidthMm:40,tileHeightMm:20};
  assert.equal(prepareGarmentPanelUvTransforms("mesh_metres",[]),null);
  assert.equal(prepareGarmentPanelUvTransforms("unknown",[valid]),null);
  assert.equal(prepareGarmentPanelUvTransforms("mesh_metres",[valid,valid]),null);
  assert.equal(prepareGarmentPanelUvTransforms("mesh_metres",[{...valid,tileHeightMm:1}]),null);
  assert.equal(prepareGarmentPanelUvTransforms("panel_normalized",[{...valid,heightMm:9000}]),null);
  assert.equal(prepareGarmentPanelUvTransforms("mesh_metres",[{...valid,offsetU:true as unknown as number}]),null);
  assert.equal(prepareGarmentPanelUvTransforms("mesh_metres",[{...valid,rotationDeg:361}]),null);
});

test("legacy prototype retains its explicitly approximate bounded scale only",()=>{
  const valid={material:"ShirtTorsoFabric",widthMm:9000,heightMm:780,tileWidthMm:40,tileHeightMm:20};
  const legacy=prepareGarmentPanelUvTransforms(null,[valid]);
  assert.deepEqual(legacy?.[0].scale,{u:80,v:39});
  // Production with declared units must refuse the same clamped repeat.
  assert.equal(prepareGarmentPanelUvTransforms("panel_normalized",[valid]),null);
});

test("physical colour sampler must apply scale, phase offset, and rotation atomically",()=>{
  const calls:string[]=[];
  const transform={scale:{u:14.5,v:39},offset:{u:.25,v:-.1},rotation:Math.PI/4};
  const sampler={
    setScale:(v:{u:number;v:number})=>{assert.deepEqual(v,transform.scale);calls.push("scale");},
    setOffset:(v:{u:number;v:number})=>{assert.deepEqual(v,transform.offset);calls.push("offset");},
    setRotation:(v:number)=>{assert.equal(v,transform.rotation);calls.push("rotation");},
  };
  assert.equal(applyViewerTextureUvTransform({sampler},transform),true);
  assert.deepEqual(calls,["scale","offset","rotation"]);
});

test("missing sampler capabilities cannot silently paint the wrong textile period",()=>{
  const transform={scale:{u:25,v:50},offset:{u:0,v:0},rotation:0};
  for(const texture of [
    undefined,null,{}, {sampler:null},
    {sampler:{setScale:()=>{}}},
    {sampler:{setOffset:()=>{},setRotation:()=>{}}},
    {sampler:{setScale:()=>{},setOffset:()=>{}}},
  ]) assert.equal(applyViewerTextureUvTransform(texture,transform),false);
  let mutated=false;
  assert.equal(applyViewerTextureUvTransform({sampler:{
    setScale:()=>{mutated=true;},
    setOffset:()=>{},
  }},transform),false);
  assert.equal(mutated,false,"No partial sampler writes before capability validation");
});

test("base and procedural normal textures must BOTH preflight before any UV mutation",()=>{
  let changed=0;
  const sampler=()=>({
    setScale:(_s:{u:number;v:number})=>{changed++;},
    setOffset:(_o:{u:number;v:number})=>{changed++;},
    setRotation:(_r:number)=>{changed++;},
  });
  const base={sampler:sampler()};
  const normal={sampler:sampler()};
  const cloth={scale:{u:14.5,v:39},offset:{u:.1,v:-.2},rotation:Math.PI/4};
  const weave={...cloth,scale:{u:19.575,v:52.65}};
  const broken={sampler:{setScale:(_s:{u:number;v:number})=>{changed++;}}};
  assert.equal(canApplyViewerTextureUvTransform(base,cloth),true);
  assert.equal(canApplyViewerTextureUvTransform(broken,weave),false);
  // This mirrors the render preflight: neither texture may have mutated.
  if(canApplyViewerTextureUvTransform(base,cloth)&&canApplyViewerTextureUvTransform(broken,weave)){
    applyViewerTextureUvTransform(base,cloth);
    applyViewerTextureUvTransform(broken,weave);
  }
  assert.equal(changed,0);
  assert.equal(canApplyViewerTextureUvTransform(normal,weave),true);
  assert.equal(applyViewerTextureUvTransform(base,cloth),true);
  assert.equal(applyViewerTextureUvTransform(normal,weave),true);
  assert.equal(changed,6);
});

test("a malformed UV transform never partially updates a model-viewer sampler",()=>{
  let writes=0;
  const texture={sampler:{
    setScale:(_scale:{u:number;v:number})=>{writes++;},
    setOffset:(_offset:{u:number;v:number})=>{writes++;},
    setRotation:(_rotation:number)=>{writes++;},
  }};
  const valid={scale:{u:12,v:15},offset:{u:0,v:0},rotation:0};
  const invalid=[
    {...valid,scale:{u:Infinity,v:15}},
    {...valid,scale:{u:-3,v:15}},
    {...valid,scale:{u:101,v:15}},
    {...valid,offset:{u:NaN,v:0}},
    {...valid,offset:{u:12,v:0}},
    {...valid,rotation:Infinity},
    {...valid,rotation:7},
    {scale:null,offset:valid.offset,rotation:0},
    {scale:valid.scale,offset:null,rotation:0},
  ];
  for(const sample of invalid){
    assert.equal(applyViewerTextureUvTransform(texture,sample as typeof valid),false);
    assert.equal(writes,0);
  }
  assert.equal(applyViewerTextureUvTransform(texture,valid),true);
  assert.equal(writes,3);
});
