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


test("GarmentViewer lab route is isolated from the protected customer visual route",()=>{
  const lab=readFileSync("src/app/lab/garment-viewer/page.tsx","utf8");
  const legacy=readFileSync("src/app/visual/page.tsx","utf8");
  assert(lab.includes('src="/vendor/model-viewer"'));
  const vendor=readFileSync("src/app/vendor/model-viewer/route.ts","utf8");
  assert(vendor.includes("@google/model-viewer@4.3.1"));
  assert(lab.includes("<GarmentViewer"));
  assert(legacy.includes('redirect("/style-director")'));
});

test("viewer surface exposes four cameras and independent shirt/trouser material controls",()=>{
  const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
  for(const token of ['id:"front"','id:"three-quarter"','id:"side"','id:"back"',"GARMENT_PANEL_SPECS","createTexture","setRoughnessFactor","setScale","shirtTileMm","trouserTileMm"]) {
    assert(viewer.includes(token),token);
  }
});
