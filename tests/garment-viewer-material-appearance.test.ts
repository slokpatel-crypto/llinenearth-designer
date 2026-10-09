import test from "node:test";
import assert from "node:assert/strict";
import {applyCurrentMaterialBatch,createCooperativeMaterialBatch,createInFlightMaterialLoader,createBoundedMaterialPrefetch,needsVariantMaterialRefresh,needsButtonMaterialRefresh,garmentSurfaceVisibilityPriority,trimAppearanceKey,tailoringInputSettleMs} from "../src/lib/garment-viewer-material-appearance.ts";

test("a superseded fabric cannot overwrite the new fabric after lazy hydration",async()=>{
  let current=1;
  let finishOld:()=>void=()=>{};
  let startedOld:()=>void=()=>{};
  const loading=new Promise<void>((resolve)=>{startedOld=resolve;});
  const pending=new Promise<void>((resolve)=>{finishOld=resolve;});
  const model={fabric:"initial"};
  const old=applyCurrentMaterialBatch({
    entries:["old"],isCurrent:()=>current===1,yieldToBrowser:async()=>{},
    load:async()=>{startedOld();await pending;return model;},
    apply:(material,fabric)=>{material.fabric=fabric;},
  });
  await loading;
  current=2;
  assert.equal(await applyCurrentMaterialBatch({
    entries:["new"],isCurrent:()=>current===2,yieldToBrowser:async()=>{},
    load:async()=>model,apply:(material,fabric)=>{material.fabric=fabric;},
  }),true);
  finishOld();
  assert.equal(await old,false);
  assert.equal(model.fabric,"new");
});

test("unmount or model replacement stops remaining panel writes",async()=>{
  const writes:string[]=[];
  let current=true;
  const complete=await applyCurrentMaterialBatch({
    entries:["torso","sleeve","trouser"],isCurrent:()=>current,
    yieldToBrowser:async()=>{},load:async(panel)=>panel,
    apply:(panel)=>{writes.push(panel);current=false;},
  });
  assert.equal(complete,false);
  assert.deepEqual(writes,["torso"]);
});

test("cancellation during an input yield never starts shader hydration",async()=>{
  let current=true;
  let loads=0;
  const complete=await applyCurrentMaterialBatch({
    entries:[1],isCurrent:()=>current,
    yieldToBrowser:async()=>{current=false;},load:async()=>{loads++;return {};},
    apply:()=>assert.fail("cancelled material must not be written"),
  });
  assert.equal(complete,false);
  assert.equal(loads,0);
});

test("successful panel application yields and commits every entry in order",async()=>{
  const events:string[]=[];
  assert.equal(await applyCurrentMaterialBatch({
    entries:["shirt","trouser"],isCurrent:()=>true,
    yieldToBrowser:async()=>{events.push("yield");},
    load:async(entry)=>{events.push(`load:${entry}`);return entry;},
    apply:(entry)=>{events.push(`apply:${entry}`);},
  }),true);
  assert.deepEqual(events,["yield","load:shirt","apply:shirt","yield","load:trouser","apply:trouser"]);
});

test("a failed panel upload cannot report a completed fabric transaction",async()=>{
  await assert.rejects(applyCurrentMaterialBatch({
    entries:[1,2],isCurrent:()=>true,yieldToBrowser:async()=>{},
    load:async()=>{throw new Error("GPU unavailable");},
    apply:()=>assert.fail("failed hydration must not write"),
  }),/GPU unavailable/);
});

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


test("dense production GLB defers shaders until native tailoring inputs settle",()=>{
  assert.equal(tailoringInputSettleMs(6),180);
  assert.equal(tailoringInputSettleMs(299),180);
  assert.equal(tailoringInputSettleMs(300),520);
  assert.equal(tailoringInputSettleMs(586),520);
  assert.ok(tailoringInputSettleMs(586)<1000,"style changes remain sub-second scheduled");
  for(const invalid of [-1,3.7,NaN,5001])
    assert.throws(()=>tailoringInputSettleMs(invalid));
});

test("real 3D garment silhouette materials hydrate before cosmetic details",()=>{
  const names=[
    "ShirtPlacketVariant__standard",
    "TrouserLegRBreakVariant__wide__negative",
    "ShirtTorsoTuckedBackVariant__boxy__high__center_box_pleat",
    "ShirtSleeveLLength__boxy__half",
    "TrouserWaistPleatVariant__high__double_forward",
    "ShirtCollarVariant__mandarin__soft_unfused",
    "ShirtSleeveRVariant__regular",
    "TrouserLegLVariant__wide",
  ];
  names.sort((a,b)=>garmentSurfaceVisibilityPriority(a)-garmentSurfaceVisibilityPriority(b));
  assert.deepEqual(names.slice(0,6),[
    "ShirtTorsoTuckedBackVariant__boxy__high__center_box_pleat",
    "ShirtSleeveLLength__boxy__half",
    "ShirtSleeveRVariant__regular",
    "TrouserWaistPleatVariant__high__double_forward",
    "TrouserLegLVariant__wide",
    "TrouserLegRBreakVariant__wide__negative",
  ]);
  assert.ok(names.indexOf("ShirtCollarVariant__mandarin__soft_unfused")>=6);
  assert.ok(names.indexOf("ShirtPlacketVariant__standard")>=6);
});


test("default straight trousers, waist and regular sleeves are core visible cloth, not trim",()=>{
  const panels=[
    "ShirtTorsoFabric",
    "ShirtSleeveLFabric",
    "ShirtSleeveRFabric",
    "TrouserWaistFabric",
    "TrouserLegLFabric",
    "TrouserLegRFabric",
  ];
  panels.forEach((name,index)=>assert.equal(garmentSurfaceVisibilityPriority(name),index,name));
  const shuffled=[
    "ShirtCollarVariant__point__stiff_fused",
    "ShirtPlacketVariant__standard",
    ...panels.slice().reverse(),
    "TrouserPocketVariant__mid__slanted",
    "ShirtTorsoTuckedVariant__regular__mid",
  ];
  shuffled.sort((a,b)=>garmentSurfaceVisibilityPriority(a)-garmentSurfaceVisibilityPriority(b));
  assert.ok(shuffled.slice(0,7).every(name=>garmentSurfaceVisibilityPriority(name)<6));
  assert.ok(shuffled.slice(7).every(name=>garmentSurfaceVisibilityPriority(name)>=6));
  assert.equal(shuffled[0],"ShirtTorsoFabric");
});

test("real garment shader prefetch starts only two panels and retains selected silhouette order",async()=>{
  const started:string[]=[];
  const release=new Map<string,()=>void>();
  const queue=createBoundedMaterialPrefetch(
    ["ShirtTorso","ShirtSleeveL","ShirtSleeveR","TrouserWaist","TrouserLegL","TrouserLegR"],
    (panel)=>new Promise<string>((resolve)=>{
      started.push(panel);
      release.set(panel,()=>resolve(panel));
    }),2,
  );
  await Promise.resolve();
  assert.deepEqual(started,["ShirtTorso","ShirtSleeveL"]);
  release.get("ShirtSleeveL")!();
  await Promise.resolve();
  assert.equal(started.length,2,"third GPU compile waits until the first panel is actually consumed");
  release.get("ShirtTorso")!();
  assert.equal(await queue.take("ShirtTorso"),"ShirtTorso");
  await Promise.resolve();
  assert.deepEqual(started.slice(0,3),["ShirtTorso","ShirtSleeveL","ShirtSleeveR"]);
  assert.equal(await queue.take("ShirtSleeveL"),"ShirtSleeveL");
  await Promise.resolve();
  assert.deepEqual(started.slice(0,4),["ShirtTorso","ShirtSleeveL","ShirtSleeveR","TrouserWaist"]);
  release.get("ShirtSleeveR")!();
  assert.equal(await queue.take("ShirtSleeveR"),"ShirtSleeveR");
  await Promise.resolve();
  release.get("TrouserWaist")!();
  assert.equal(await queue.take("TrouserWaist"),"TrouserWaist");
  await Promise.resolve();
  release.get("TrouserLegL")!();
  assert.equal(await queue.take("TrouserLegL"),"TrouserLegL");
  await Promise.resolve();
  release.get("TrouserLegR")!();
  assert.equal(await queue.take("TrouserLegR"),"TrouserLegR");
  assert.equal(started.length,6,"no selected garment may be skipped");
});

test("cold studio look can concurrently prewarm cosmetics ONLY behind six structural garment panels",async()=>{
  const garment=[
    "ShirtTorsoFabric","ShirtSleeveLFabric","ShirtSleeveRFabric",
    "TrouserWaistFabric","TrouserLegLFabric","TrouserLegRFabric",
    "ShirtCollarVariant__point__stiff_fused","ShirtPlacketVariant__standard",
  ];
  const starts:string[]=[];
  const release=new Map<string,()=>void>();
  const q=createBoundedMaterialPrefetch(garment,name=>new Promise<string>(resolve=>{
    starts.push(name);release.set(name,()=>resolve(name));
  }),3);
  await Promise.resolve();
  assert.deepEqual(starts,garment.slice(0,3),"initial GPU warmup uses only 3 real cloth materials");
  release.get(garment[0])!();
  assert.equal(await q.take(garment[0]),garment[0]);
  await Promise.resolve();
  assert.deepEqual(starts,garment.slice(0,4),"next structural garment prefetches before trim");
  for(let i=1;i<garment.length;i++){
    if(!release.has(garment[i])) await Promise.resolve();
    release.get(garment[i])!();
    assert.equal(await q.take(garment[i]),garment[i]);
  }
  assert.deepEqual(starts,garment,"no collar or style option omitted from first-look hydration");
});

test("prefetch failure is observed and propagated when core material is applied",async()=>{
  const queue=createBoundedMaterialPrefetch(
    ["shirt","trouser"],async(panel)=>{
      if(panel==="shirt") throw new Error("real WebGL material failed");
      return panel;
    },2,
  );
  await assert.rejects(queue.take("shirt"),/real WebGL material failed/);
  assert.equal(await queue.take("trouser"),"trouser");
});

test("bounded core GPU hydration rejects duplicate panels and unsafe capacity",()=>{
  for(const capacity of [0,5,NaN,1.2])
    assert.throws(()=>createBoundedMaterialPrefetch([],async(v)=>v,capacity));
  assert.throws(()=>createBoundedMaterialPrefetch(["shirt","shirt"],async(v)=>v));
});
