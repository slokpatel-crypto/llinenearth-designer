import test from "node:test";
import assert from "node:assert/strict";
import { buildPrototypeGarmentGlb, PROTOTYPE_MODEL_ID } from "../src/lib/garment-viewer-prototype.ts";
import { externalGlbUri, inspectGarmentViewerGlb, parseGarmentViewerGlbJson } from "../src/lib/garment-viewer-glb.ts";

test("prototype GLB is structurally valid but remains explicitly non-production",()=>{
  const bytes=buildPrototypeGarmentGlb();
  const inspection=inspectGarmentViewerGlb(bytes,PROTOTYPE_MODEL_ID);
  assert.equal(inspection.gltfVersion,"2.0");
  assert.equal(inspection.uvReady,true);
  assert.equal(inspection.textureSlotsReady,true);
  assert.equal(inspection.selfContained,true);
  assert.equal(inspection.contract.readiness,"prototype");
  assert.equal(inspection.structuralReady,false);
  assert(inspection.panels.every((panel)=>panel.primitiveCount>0&&panel.position&&panel.normal&&panel.uv0&&panel.baseColorTexture&&panel.normalTexture));
});

test("same six-panel GLB structure satisfies the production structural contract for an approved model id",()=>{
  const inspection=inspectGarmentViewerGlb(buildPrototypeGarmentGlb(),"LE-OFFICEWEAR-V1");
  assert.equal(inspection.contract.readiness,"contract_ready");
  assert.equal(inspection.structuralReady,true);
  assert.equal(inspection.styleVariantCoverage.ready,true);
  assert.equal(inspection.styleVariantCoverage.present,inspection.styleVariantCoverage.required);
  assert.deepEqual(inspection.styleVariantCoverage.missing,[]);
  assert.equal(inspection.remoteUris.length,0);
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
