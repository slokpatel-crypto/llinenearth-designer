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
    "scaleReady",
    "latencyReady",
    "realismReady",
    "boundaryReady",
    "The current customer Designer stays on the photographic preview",
  ]) assert.ok(source.includes(token),token+" missing from Phase 10 GarmentViewer readiness");
  assert.ok(source.includes("garmentViewerTechnicalPass"),"technical pass must remain distinct from release approval");
  assert.ok(source.includes("Math.min(95,ratio(garmentViewerSignals"),"3D workflow cannot report 100% without owner sign-off");
  assert.ok(source.includes("status:data.garmentViewer?.configured?\"progress\":\"blocked\""),"automated checks must not mark the 3D workstream done");
  assert.ok(source.includes("Independent owner/tailor physical fit"),"require explicit owner/tailor acceptance");
  assert.ok(!source.includes('status:garmentViewerReady?"done"'),"no automatic customer-release completion");
});
