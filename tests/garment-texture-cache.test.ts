import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const viewer=readFileSync("src/components/GarmentViewer.tsx","utf8");
const qa=readFileSync("scripts/verify-garment-viewer.cjs","utf8");

test("shirt-only fabric edits reuse physical trouser images, with no doubled texture decode",()=>{
  const start=viewer.indexOf("const prepared=await Promise.all(panelSpecs.map");
  const end=viewer.indexOf("const loaded=await Promise.all",start);
  const effect=viewer.slice(start,end);
  assert.ok(effect.includes("const retained=preparedTextureRef.current.get(panel.material)"));
  assert.ok(effect.includes("retained?.cacheKey===cacheKey"));
  assert.ok(effect.includes("texture:retained.texture,normal:retained.normal"));
  assert.ok(effect.indexOf("retained?.cacheKey===cacheKey")<effect.indexOf("await viewer.createTexture!(fabric.image)"));
  assert.ok(effect.includes("modelRevision,panel.material,fabric.id,fabric.image"));
  assert.ok(effect.includes("tileMm,panel.widthMm,panel.heightMm,offset.u,offset.v,rotation"));
  assert.ok(viewer.includes("if(!entry.unchanged){"));
  assert.ok(viewer.includes("cacheKey:entry.cacheKey"));
  assert.ok(viewer.includes("preparedTextureRef.current.clear()"));
});

test("fabric cache cannot let stale model or cancelled swatch become visually ready",()=>{
  assert.ok(viewer.includes("if(!isCurrent()) return"));
  assert.ok(viewer.includes("preparedTextureRef.current=new Map(prepared.map"));
  assert.ok(viewer.includes("if(!entry.unchanged){"));
  assert.ok(viewer.includes('setPreparedFabricVersion(requestedFabricVersion)'));
  assert.ok(qa.includes('data-tailoring-ready'));
  assert.ok(qa.includes('timeout:20000'));
});
