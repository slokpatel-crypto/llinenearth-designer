import test from "node:test";
import assert from "node:assert/strict";
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
