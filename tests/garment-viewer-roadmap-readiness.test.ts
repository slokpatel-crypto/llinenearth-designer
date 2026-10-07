import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Phase 10 readiness keeps reusable 3D behind the full promotion gate",()=>{
  const source=readFileSync("src/app/operator/phase10-readiness/Phase10ReadinessClient.tsx","utf8");
  for(const token of [
    "/api/operator/garment-viewer",
    'id:"garment-viewer-m2"',
    "garmentViewerAssetReady",
    "garmentViewerMobilePreflight",
    "identityMatches",
    "productionAssetReady",
    "styleVariantReady",
    "styleVariantCoverage",
    "scaleReady",
    "latencyReady",
    "realismReady",
    "boundaryReady",
    "The current customer Designer stays on the photographic preview",
  ]) assert.ok(source.includes(token),token+" missing from Phase 10 GarmentViewer readiness");
});
