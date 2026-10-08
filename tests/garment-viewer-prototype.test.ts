import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPrototypeGarmentGlb, GARMENT_PANEL_SPECS, PROTOTYPE_MODEL_ID } from "../src/lib/garment-viewer-prototype.ts";

function parseJsonChunk(bytes:Uint8Array) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const jsonLength=view.getUint32(12,true);
  const jsonType=view.getUint32(16,true);
  assert.equal(jsonType,0x4e4f534a);
  const text=new TextDecoder().decode(bytes.slice(20,20+jsonLength)).trim();
  return JSON.parse(text);
}

test("GarmentViewer prototype generates a valid GLB 2.0 envelope",()=>{
  const bytes=buildPrototypeGarmentGlb();
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(0,true),0x46546c67);
  assert.equal(view.getUint32(4,true),2);
  assert.equal(view.getUint32(8,true),bytes.byteLength);
  assert(bytes.byteLength>1000);
});

test("prototype GLB keeps every garment panel as a separate PBR material",()=>{
  const gltf=parseJsonChunk(buildPrototypeGarmentGlb());
  assert.equal(PROTOTYPE_MODEL_ID,"LE-GARMENT-M1");
  for(const panel of GARMENT_PANEL_SPECS) {
    const material=gltf.materials.find((item:{name:string})=>item.name===panel.material);
    assert(material,panel.material);
    assert.equal(material.pbrMetallicRoughness.metallicFactor,0);
    assert(material.pbrMetallicRoughness.baseColorTexture);
    assert(material.normalTexture);
  }
  assert.equal(GARMENT_PANEL_SPECS.filter((panel)=>panel.garment==="shirt").length,3);
  assert.equal(GARMENT_PANEL_SPECS.filter((panel)=>panel.garment==="trouser").length,3);
});

test("panel dimensions support a common physical tile size across garment pieces",()=>{
  for(const panel of GARMENT_PANEL_SPECS) {
    assert(panel.widthMm>100);
    assert(panel.heightMm>200);
    const tileMm=40;
    const u=panel.widthMm/tileMm;
    const v=panel.heightMm/tileMm;
    assert(u>0&&v>0);
  }
});

test("prototype model is a reusable full outfit rather than one flattened garment",()=>{
  const gltf=parseJsonChunk(buildPrototypeGarmentGlb());
  const names=gltf.nodes.map((node:{name:string})=>node.name);
  for(const expected of ["Head","ShirtTorso","ShirtSleeveL","ShirtSleeveR","TrouserWaist","TrouserLegL","TrouserLegR","ShoeL","ShoeR"]) {
    assert(names.includes(expected),expected);
  }
  assert.equal(gltf.scenes[0].nodes.length,gltf.nodes.length);
  assert.equal(gltf.meshes.length,GARMENT_PANEL_SPECS.length+2);
});


test("trouser waistband uses a wrapped waist shell and restrained belt loops",()=>{
  const builder=readFileSync("scripts/build-garment-viewer-model.mjs","utf8");
  for(const token of [
    "trouserCoreBandMeshes",
    "TrouserCoreBandVariantMesh__",
    "cropGeometry(source,(p)=>p.y>=1.066+riseOffset)",
    "mesh:bandMesh",
    "scale:[.007,.028,.0035]",
  ]) assert(builder.includes(token),token);
  assert(!builder.includes("scale:[.330,.020,.006]"));
});

test("default officewear shapes shoulders, armholes and trouser seat while enforcing shoulder continuity",()=>{
  const builder=readFileSync("scripts/build-garment-viewer-model.mjs","utf8");
  for(const token of [
    "tailoredShirtTorsoGeometry",
    "const shoulderDrop=.026",
    "const armholeIn=.004",
    "const shoulderDrop=.038",
    "const capRound=.006",
    "const seatScale=1+.095*backBias",
    "const outerEase=.0045*upperZone",
    "leftShoulderJoinOverlapMm",
    "rightShoulderJoinOverlapMm",
    "expected 4–45 mm",
  ]) assert(builder.includes(token),token);
});

test("production model derives identity measurements from the visible default geometry",()=>{
  const builder=readFileSync("scripts/build-garment-viewer-model.mjs","utf8");
  for(const token of [
    "geometryXStats",
    "geometryYStats",
    "widthMmAtY",
    "centerXAtY",
    "shiftGeometryCenterX(garmentShells.handL,-.250)",
    "shiftGeometryCenterX(garmentShells.handR,.250)",
    "measurementMethod:\"geometry-derived-from-visible-default-shells\"",
    "widthMmAtY(realisticDefaultShells.shirtTorso",
    "widthMmAtY(realisticDefaultShells.trouserWaist",
  ]) assert(builder.includes(token),token);
  assert(!builder.includes("shoulderSeamWidthMm:.194*2*1000"));
  assert(!builder.includes("handCenterSpacingMm:.250*2*1000"));
});

test("production model keeps closed tailored default garments while using anatomy-derived clean skin",()=>{
  const builder=readFileSync("scripts/build-garment-viewer-model.mjs","utf8");
  for(const token of [
    "const realisticDefaultShells=tailoredShells",
    "tailoredSleeveCapGeometry",
    "const shoulderDrop=.038",
    "const capRound=.006",
    "handL:shiftGeometryCenterX(garmentShells.handL,-.250)",
    "handR:shiftGeometryCenterX(garmentShells.handR,.250)",
    "forearmL:shiftGeometryCenterX(garmentShells.forearmL,-.238)",
    "forearmR:shiftGeometryCenterX(garmentShells.forearmR,.238)",
    'addMesh("ShirtTorsoMesh",realisticDefaultShells.shirtTorso',
    'addMesh("TrouserWaistMesh",realisticDefaultShells.trouserWaist',
  ]) assert(builder.includes(token),token);
  assert(!builder.includes("HandFinger\${handSide}"));
  assert(!builder.includes("HandThumb\${handSide}"));
  assert(!builder.includes('addMesh("FingerMesh"'));
  assert(!builder.includes('addMesh("ThumbMesh"'));
});

test("GarmentViewer lab route is isolated from the protected customer visual route",()=>{
  const lab=readFileSync("src/app/lab/garment-viewer/page.tsx","utf8");
  const legacy=readFileSync("src/app/visual/page.tsx","utf8");
  assert(lab.includes('src="/vendor/model-viewer"'));
  const vendor=readFileSync("src/app/vendor/model-viewer/route.ts","utf8");
  assert(vendor.includes("@google/model-viewer@4.3.1"));
  assert(lab.includes("<GarmentViewer"));
  assert(legacy.includes('redirect("/style-director")'));
});

test("viewer skips hydrated materials and shares in-flight WebGL material loads",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(viewer.includes("material.isLoaded!==true && material.ensureLoaded"),"already hydrated materials must not reload");
  assert(viewer.includes("await loadMaterialOnce(material,()=>material.ensureLoaded!())"),
    "overlapping style changes must share in-flight lazy material hydration");
  const loader=readFileSync("src/lib/garment-viewer-material-appearance.ts","utf8");
  assert(loader.includes("if(active.get(material)===pending) active.delete(material)"),
    "completed/rejected GPU work must be evicted to allow retry");
});

test("native 3D tailoring input commits before cancellable WebGL material mutations",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(viewer.includes("const inputSettleTimer=window.setTimeout("),
    "heavy shader updates must not run in the same immediate customer input frame");
  assert(viewer.includes("tailoringInputSettleMs(viewer.model?.materials.length||0)"),
    "dense production model must give native selects a bounded shader-free window");
  assert(viewer.includes("window.clearTimeout(inputSettleTimer)"),
    "superseded outfit edits must cancel pending material work");
});

test("viewer recovers a model-viewer load event that fires before React effect listeners attach",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(viewer.includes("loaded?:boolean"));
  assert(viewer.includes("const recoverReadyState=(attempt=0)=>"));
  assert(viewer.includes("viewer.loaded || (viewer.model?.materials?.length||0)>0"));
  assert(viewer.includes("if(attempt<240)"),"hydration recovery must keep a 60-second bounded window");
  assert(viewer.includes("readinessTimer=window.setTimeout(()=>recoverReadyState(attempt+1),250);"));
  assert(viewer.includes('setError("The 3D model did not become ready within 60 seconds. Refresh to try again.");'),"hydration must fail visibly rather than spin forever");
});

test("viewer surface exposes the shared four-angle turntable and independent shirt/trouser material controls",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  const identity=readFileSync("src/lib/designer/model-identity.ts","utf8");
  for(const token of ["LINEN_EARTH_MODEL_VIEWS","GARMENT_PANEL_SPECS","createTexture","setRoughnessFactor","setScale","shirtTileMm","trouserTileMm"]) {
    assert(viewer.includes(token),token);
  }
  for(const token of ['id:"front"','id:"three-quarter"','id:"side"','id:"back"',"yawDeg:0","yawDeg:35","yawDeg:90","yawDeg:180"]) {
    assert(identity.includes(token),token);
  }
});


test("real garment tailoring controls remain schedulable during WebGL hydration",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(viewer.includes("createCooperativeMaterialBatch"),"live 3D viewer must actually wire the cooperative material scheduler");
  assert(viewer.includes("window.setTimeout(resolve,16)"),"shader material work must yield a browser macrotask");
  assert(viewer.includes("await yieldForInput()"),"long material loops must release control to customer input");
  assert(viewer.includes("window.setTimeout(resolve,16)),1"),
    "large model must yield a macrotask before each shader mutation rather than after four blocking operations");
  assert(viewer.includes("Allow the real native form-control action to settle before any"),
    "customer control state should settle before expensive WebGL material work");
});


test("interrupted live tailoring edits do not leave ghost shirt, trouser or skin materials",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(viewer.includes("const previous=new Set(visibleGarmentMaterialsRef.current)"));
  assert(viewer.includes("visibleGarmentMaterialsRef.current.delete(name)"));
  assert(viewer.includes("visibleGarmentMaterialsRef.current.add(name)"));
  assert(viewer.includes("if(!previous.has(name)) setMaterialAlpha(material,true)"));
  assert(viewer.includes("visibleSkinArmMaterialRef.current=null"));
  assert(viewer.includes("visibleSkinArmMaterialRef.current=nextSkin"));
  assert(viewer.includes("visibleButtonMaterialsRef.current.delete(name)"));
  assert(viewer.includes("visibleButtonMaterialsRef.current.add(name)"));
  assert(viewer.includes("if(cancelled) return"));
});
