import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPrototypeGarmentGlb, PROTOTYPE_MODEL_ID } from "../src/lib/garment-viewer-prototype.ts";

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

test("prototype GLB keeps shirt and trouser as separate PBR materials",()=>{
  const gltf=parseJsonChunk(buildPrototypeGarmentGlb());
  assert.equal(PROTOTYPE_MODEL_ID,"LE-GARMENT-M1");
  assert(gltf.materials.some((material:{name:string})=>material.name==="ShirtFabric"));
  assert(gltf.materials.some((material:{name:string})=>material.name==="TrouserFabric"));
  const shirt=gltf.materials.find((material:{name:string})=>material.name==="ShirtFabric");
  const trouser=gltf.materials.find((material:{name:string})=>material.name==="TrouserFabric");
  assert.equal(shirt.pbrMetallicRoughness.metallicFactor,0);
  assert.equal(trouser.pbrMetallicRoughness.metallicFactor,0);
  assert(shirt.pbrMetallicRoughness.baseColorTexture);
  assert(shirt.normalTexture);
  assert(trouser.normalTexture);
});

test("prototype model is a reusable full outfit rather than one flattened garment",()=>{
  const gltf=parseJsonChunk(buildPrototypeGarmentGlb());
  const names=gltf.nodes.map((node:{name:string})=>node.name);
  for(const expected of ["Head","ShirtTorso","ShirtSleeveL","ShirtSleeveR","TrouserWaist","TrouserLegL","TrouserLegR","ShoeL","ShoeR"]) {
    assert(names.includes(expected),expected);
  }
  assert.equal(gltf.scenes[0].nodes.length,gltf.nodes.length);
  assert.equal(gltf.meshes.length,4);
});


test("GarmentViewer lab route is isolated from the protected customer visual route",()=>{
  const lab=readFileSync("src/app/lab/garment-viewer/page.tsx","utf8");
  const legacy=readFileSync("src/app/visual/page.tsx","utf8");
  assert(lab.includes("model-viewer/4.3.1/model-viewer.min.js"));
  assert(lab.includes("<GarmentViewer"));
  assert(legacy.includes('redirect("/style-director")'));
});

test("viewer surface exposes four cameras and independent shirt/trouser material controls",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  for(const token of ['id:"front"','id:"three-quarter"','id:"side"','id:"back"',"ShirtFabric","TrouserFabric","createTexture","setRoughnessFactor","setScale","textureScale"]) {
    assert(viewer.includes(token),token);
  }
});
