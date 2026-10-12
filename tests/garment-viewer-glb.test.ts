import test from "node:test";
import assert from "node:assert/strict";
import { buildPrototypeGarmentGlb, PROTOTYPE_MODEL_ID } from "../src/lib/garment-viewer-prototype.ts";
import { externalGlbUri, inspectGarmentViewerGlb, parseGarmentViewerGlbJson } from "../src/lib/garment-viewer-glb.ts";

test("prototype GLB is structurally valid but remains explicitly non-production",()=>{
  const bytes=buildPrototypeGarmentGlb();
  const inspection=inspectGarmentViewerGlb(bytes,PROTOTYPE_MODEL_ID);
  assert.equal(inspection.gltfVersion,"2.0");
  assert.equal(inspection.uvReady,true);
  assert.equal(inspection.selfContained,true);
  assert.equal(inspection.contract.readiness,"prototype");
  assert.equal(inspection.structuralReady,false);
  assert(inspection.panels.every((panel)=>panel.primitiveCount>0&&panel.position&&panel.normal&&panel.uv0));
});

test("a renamed cube prototype cannot masquerade as the approved realistic studio GLB",()=>{
  const inspection=inspectGarmentViewerGlb(buildPrototypeGarmentGlb(),"LE-OFFICEWEAR-V1");
  assert.equal(inspection.contract.readiness,"contract_ready");
  assert.equal(inspection.placeholderGeometry,true);
  assert.equal(inspection.structuralReady,false);
  assert(inspection.reasons.some((reason)=>reason.includes("cube prototype")));
  assert.equal(inspection.remoteUris.length,0);
});

test("procedural M7 styling geometry cannot be promoted as photorealistic studio source",()=>{
  const original=buildPrototypeGarmentGlb();
  const json=parseGarmentViewerGlbJson(original);
  if(!json.asset) throw new Error("Missing GLB asset metadata.");
  json.asset.generator="Linen Earth Live Designer identity model M7.46 researched tailoring construction";
  const payload=new TextEncoder().encode(JSON.stringify(json));
  const jsonSize=(payload.byteLength+3)&~3;
  const originalJsonSize=new DataView(original.buffer,original.byteOffset,original.byteLength).getUint32(12,true);
  const binaryTail=original.subarray(20+originalJsonSize);
  const updated=new Uint8Array(20+jsonSize+binaryTail.length);
  const view=new DataView(updated.buffer);
  view.setUint32(0,0x46546c67,true);
  view.setUint32(4,2,true);
  view.setUint32(8,updated.byteLength,true);
  view.setUint32(12,jsonSize,true);
  view.setUint32(16,0x4e4f534a,true);
  updated.fill(32,20,20+jsonSize);
  updated.set(payload,20);
  updated.set(binaryTail,20+jsonSize);
  const inspection=inspectGarmentViewerGlb(updated,"LE-OFFICEWEAR-V1");
  assert.equal(inspection.contract.readiness,"contract_ready");
  assert.equal(inspection.placeholderGeometry,true);
  assert.equal(inspection.structuralReady,false);
  assert(inspection.reasons.some(reason=>reason.includes("Procedural M7")));
});

test("GLB parser rejects corrupt headers and declared lengths",()=>{
  const bytes=buildPrototypeGarmentGlb();
  const badMagic=bytes.slice();
  badMagic[0]=0;
  assert.throws(()=>parseGarmentViewerGlbJson(badMagic),/not a GLB/i);

  const badLength=bytes.slice();
  new DataView(badLength.buffer,badLength.byteOffset,badLength.byteLength).setUint32(8,badLength.byteLength-4,true);
  assert.throws(()=>parseGarmentViewerGlbJson(badLength),/declared length/i);
});


test("production GLB only permits embedded data URIs or bufferView-backed assets",()=>{
  assert.equal(externalGlbUri(undefined),null);
  assert.equal(externalGlbUri("data:image/png;base64,AAAA"),null);
  assert.equal(externalGlbUri("texture.png"),"texture.png");
  assert.equal(externalGlbUri("/models/texture.png"),"/models/texture.png");
  assert.equal(externalGlbUri("https://cdn.example/texture.png"),"https://cdn.example/texture.png");
});


test("prototype complexity preflight counts rendered mesh instances",()=>{
  const inspection=inspectGarmentViewerGlb(buildPrototypeGarmentGlb(),"LE-OFFICEWEAR-V1");
  assert.equal(inspection.triangleCount,168);
  assert.equal(inspection.vertexCount,336);
  assert.equal(inspection.performanceBudgetReady,true);
  assert.deepEqual(inspection.performanceWarnings,[]);
});
