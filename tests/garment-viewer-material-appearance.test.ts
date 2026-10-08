import test from "node:test";
import assert from "node:assert/strict";
import {createCooperativeMaterialBatch,createInFlightMaterialLoader,needsVariantMaterialRefresh,needsButtonMaterialRefresh,trimAppearanceKey,tailoringInputSettleMs} from "../src/lib/garment-viewer-material-appearance.ts";

const base={textureRevision:3,roughness:.72,shirtId:"linen-sky",trouserId:"linen-beige"};

test("style-only changes do not re-upload unchanged visible WebGL materials",()=>{
  assert.equal(needsVariantMaterialRefresh(true,base,{...base}),false);
});
test("newly selected or initial materials must hydrate",()=>{
  assert.equal(needsVariantMaterialRefresh(false,base,{...base}),true);
  assert.equal(needsVariantMaterialRefresh(true,null,{...base}),true);
});
test("fabric, normal texture revision or finish changes still refresh",()=>{
  assert.equal(needsVariantMaterialRefresh(true,base,{...base,shirtId:"linen-white"}),true);
  assert.equal(needsVariantMaterialRefresh(true,base,{...base,trouserId:"linen-navy"}),true);
  assert.equal(needsVariantMaterialRefresh(true,base,{...base,textureRevision:4}),true);
  assert.equal(needsVariantMaterialRefresh(true,base,{...base,roughness:.78}),true);
});

test("button materials only refresh when newly visible or material selection changes",()=>{
  assert.equal(needsButtonMaterialRefresh(true,"metal","metal"),false);
  assert.equal(needsButtonMaterialRefresh(false,"metal","metal"),true);
  assert.equal(needsButtonMaterialRefresh(true,"metal","mother_of_pearl"),true);
  assert.equal(needsButtonMaterialRefresh(true,null,"metal"),true);
});
test("collar/cuff cache invalidates for construction, contrast cloth, fabric and finish",()=>{
  const trim={
    collar:"point",collarConstruction:"stiff_fused",collarFinish:"self",
    cuff:"barrel",cuffConstruction:"fused",sleeve:"full",
    shirtId:"linen-sky",textureRevision:3,roughness:.72,shirtDrape:"medium",
  };
  const key=trimAppearanceKey(trim);
  assert.equal(trimAppearanceKey({...trim}),key);
  for(const changed of [
    {collar:"english_spread"},{collarConstruction:"soft_unfused"},
    {collarFinish:"white_collar_cuffs"},{cuff:"cocktail"},
    {cuffConstruction:"soft"},{sleeve:"half"},{shirtId:"linen-white"},
    {textureRevision:4},{roughness:.8},{shirtDrape:"fluid"},
  ]) assert.notEqual(trimAppearanceKey({...trim,...changed}),key);
});


test("overlapping style edits hydrate each lazy WebGL material only once",async()=>{
  const loadOnce=createInFlightMaterialLoader<object>();
  const material={id:"ShirtCuffVariant__cocktail"};
  let count=0;
  let resolveLoad:()=>void=()=>{};
  const task=new Promise<void>((resolve)=>{resolveLoad=resolve;});
  const first=loadOnce(material,()=>{count++;return task;});
  const second=loadOnce(material,()=>{count++;return task;});
  await Promise.resolve();
  assert.equal(count,1,"concurrent effects must reuse the same shader load");
  resolveLoad();
  await Promise.all([first,second]);
  await loadOnce(material,async()=>{count++;});
  assert.equal(count,2,"completed material loads must not leave a stale in-flight entry");
});

test("failed WebGL load is evicted to permit recovery",async()=>{
  const loadOnce=createInFlightMaterialLoader<object>();
  const material={id:"ShirtCollarVariant__spread"};
  let attempts=0;
  await assert.rejects(()=>loadOnce(material,async()=>{
    attempts++;
    throw new Error("GPU context temporarily unavailable");
  }),/GPU context/);
  await loadOnce(material,async()=>{attempts++;});
  assert.equal(attempts,2);
});


test("cooperative material scheduler yields after each bounded batch",async()=>{
  let yields=0;
  const pace=createCooperativeMaterialBatch(async()=>{yields++;},3);
  await pace();await pace();
  assert.equal(yields,0);
  await pace();
  assert.equal(yields,1);
  for(let i=0;i<3;i++) await pace();
  assert.equal(yields,2);
});

test("cooperative batching rejects invalid GPU workload limits",()=>{
  for(const bad of [0,-1,65,NaN,2.5]){
    assert.throws(()=>createCooperativeMaterialBatch(async()=>{},bad));
  }
});


test("dense 3D shaders must not run during real native input batching",()=>{
  assert.equal(tailoringInputSettleMs(6),180);
  assert.equal(tailoringInputSettleMs(299),180);
  assert.equal(tailoringInputSettleMs(300),650);
  assert.equal(tailoringInputSettleMs(586),650);
  assert.ok(tailoringInputSettleMs(586)<1000);
  for(const invalid of [-1,3.7,NaN,5001]) assert.throws(()=>tailoringInputSettleMs(invalid));
});
