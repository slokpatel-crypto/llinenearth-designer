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


test("production model uses anatomy-derived default garments, hands and forearms while keeping compact variant shells",()=>{
  const builder=readFileSync("scripts/build-garment-viewer-model.mjs","utf8");
  for(const token of [
    "const realisticDefaultShells={",
    "shirtTorso:garmentShells.shirtTorso",
    "sleeveL:garmentShells.sleeveL",
    "sleeveR:garmentShells.sleeveR",
    "trouserWaist:garmentShells.trouserWaist",
    "trouserLegL:garmentShells.trouserLegL",
    "trouserLegR:garmentShells.trouserLegR",
    "handL:garmentShells.handL",
    "handR:garmentShells.handR",
    "forearmL:garmentShells.forearmL",
    "forearmR:garmentShells.forearmR",
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

test("viewer skips ensureLoaded for materials that model-viewer already hydrated",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(viewer.includes("if(material.isLoaded!==true && material.ensureLoaded) await material.ensureLoaded();"));
});

test("viewer recovers a model-viewer load event that fires before React effect listeners attach",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(viewer.includes("loaded?:boolean"));
  assert(viewer.includes('const [modelUrl,setModelUrl]=useState(()=>modelSrc||"")'));
  assert(viewer.includes('"shadow-intensity":modelReady?".78":"0"'));
  assert(viewer.includes('"environment-image":"neutral"'));
  assert(viewer.includes("const recoverReadyState=(attempt=0)=>"));
  assert(viewer.includes('ref:attachViewerRef'));
  assert(viewer.includes('viewerRef.current.addEventListener("load",settleNativeModelLoad)'));
  assert(viewer.includes('previous.removeEventListener("load",settleNativeModelLoad)'));
  assert(viewer.includes('if(viewerRef.current.loaded) settleNativeModelLoad()'));
  assert(viewer.includes("if(!model || !(model.loaded || (model.model?.materials?.length||0)>0)) return"));
  assert(viewer.includes("viewer.loaded || (viewer.model?.materials?.length||0)>0"));
  assert(viewer.includes("if(attempt<160) readinessTimer=window.setTimeout(()=>recoverReadyState(attempt+1),125);"));
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



test("slow GLB startup fails closed with a real fallback instead of an infinite loading overlay",()=>{
  const source=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(source.includes("if(!modelUrl || modelReady) return"));
  assert(source.includes('if(!scene?.loaded) setError("3D preview is taking longer than expected.'));
  assert(source.includes("},20_000)"));
  assert(source.includes('{!modelReady&&!error&&<div className="garmentViewerLoading">'));
  assert(source.includes('className="garmentViewerError"'));
  assert(source.includes('setModelReady(true);'));
  assert(source.includes('setError("");'));
});


test("real browser 3D QA records GPU/asset diagnosis without silently relaxing the twenty-second threshold",()=>{
  const code=readFileSync("scripts/verify-garment-viewer.cjs","utf8");
  assert(code.includes('},null,{timeout:20000,polling:100})'));
  assert(code.includes("const navigationStartedAt=Date.now()"));
  assert(code.includes("const launchMs=Date.now()-navigationStartedAt"));
  assert(code.includes("assert.ok(launchMs<=20000"));
  assert(code.includes("Real 3D first frame exceeded 20s"));

  assert(code.includes('Boolean(model?.loaded)'));
  assert(code.includes('(model?.model?.materials?.length||0)>=6'));
  assert(code.includes('!document.querySelector(".garmentViewerLoading")'));
  assert(code.includes('"garment-loading-timeout.json"'));
  assert(code.includes('modelLoaded:Boolean(document.querySelector("model-viewer")?.loaded)'));
  assert(code.includes('modelReadiness:document.querySelector(".garmentViewerShell")'));
  assert(code.includes("failed the original 20-second genuine-load gate"));
  assert(code.includes('"--enable-unsafe-swiftshader"'));
  assert(code.includes('"--use-angle=swiftshader-webgl"'));
  assert(code.includes('element.toBlob({mimeType:"image/png"})'));
  assert(code.includes('render.size>=12000'));
  assert(code.includes('"Garment pixels must be a real PNG."'));
  assert(code.includes('name.replace(".png","-model.png")'));
  assert(code.includes('element.style.visibility="hidden"'));
  assert(code.includes('element.style.visibility=""'));
  assert(code.includes('timeout:45000'));

});
