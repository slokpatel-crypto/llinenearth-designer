import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fields = [
  "structureVerified",
  "breathabilityVerified",
  "wrinkleResistanceVerified",
  "stretchVerified",
] as const;

test("Designer Data API reports extended physical evidence coverage", () => {
  const source=readFileSync("src/app/api/operator/designer-data/route.ts","utf8");
  for(const field of fields) assert.match(source,new RegExp("\\b"+field+"\\b"),`${field} missing from Designer Data API`);
  for(const coverage of ["structure","breathability","wrinkleResistance","stretch"]) {
    assert.match(source,new RegExp("\\b"+coverage+"\\s*:"),`${coverage} coverage missing from Designer Data API`);
  }
});

test("Designer Data desk exposes and filters all extended physical evidence gaps", () => {
  const source=readFileSync("src/app/operator/designer-data/DesignerDataClient.tsx","utf8");
  for(const field of fields) assert.match(source,new RegExp("\\b"+field+"\\b"),`${field} missing from Designer Data desk`);
  for(const label of ["Structure","Breathability","Wrinkle resistance","Stretch"]) {
    assert.match(source,new RegExp(label,"i"));
  }
  assert.match(source,/evidenceFilter==="physical"/);
});


test("Designer Data desk exposes the provisional six-garment compatibility matrix",()=>{
  const api=readFileSync("src/app/api/operator/designer-data/route.ts","utf8");
  const ui=readFileSync("src/app/operator/designer-data/DesignerDataClient.tsx","utf8");
  assert.match(api,/attachCatalogFabricPhysics/);
  assert.match(api,/garmentCompatibility/);
  assert.match(api,/evidenceConfidence/);
  assert.match(ui,/PHYSICS COMPATIBILITY/);
  assert.match(ui,/compatibilityMatrix/);
  assert.match(ui,/Customer-facing claims remain disabled/);
});


test("Designer Data summarizes garment expansion readiness without exposing it as a customer claim",()=>{
  const api=readFileSync("src/app/api/operator/designer-data/route.ts","utf8");
  const ui=readFileSync("src/app/operator/designer-data/DesignerDataClient.tsx","utf8");
  for(const garment of ["shirt","trouser","suit","blazer","kurta","bandhgala"]) assert.match(api,new RegExp('"'+garment+'"'));
  assert.match(api,/garmentExpansion/);
  assert.match(api,/strongOrWorkable/);
  assert.match(ui,/GARMENT EXPANSION READINESS/);
  assert.match(ui,/internal readiness view, not a customer claim/i);
});
