import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GARMENT_CATEGORY_LIBRARY } from "../src/lib/designer/garment-category-library.ts";

test("garment category library keeps shirt and trouser live while blazer and suit remain future",()=>{
  const byId=Object.fromEntries(GARMENT_CATEGORY_LIBRARY.map((item)=>[item.id,item]));
  assert.equal(byId.shirt.status,"live");
  assert.equal(byId.trouser.status,"live");
  assert.equal(byId.blazer.status,"planned");
  assert.equal(byId.suit.status,"planned");
  assert(byId.shirt.typeExamples.includes("Dress shirt"));
  assert(byId.trouser.typeExamples.includes("Pleated"));
  assert(byId.blazer.typeExamples.includes("Single-breasted"));
  assert(byId.suit.typeExamples.includes("3-piece"));
  assert(byId.shirt.detailFamilies.includes("Collar"));
  assert(byId.trouser.detailFamilies.includes("Rise"));
  assert(byId.blazer.detailFamilies.includes("Lapel"));
  assert(byId.suit.detailFamilies.includes("Jacket"));
});

test("GarmentViewer shows garment construction scope, not fabric alone",()=>{
  const source=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(source.includes("GARMENT TYPES · CURRENT + FUTURE"));
  assert(source.includes("Types: Dress"));
  assert(source.includes("Details: Collar"));
  assert(source.includes("Types: Formal flat-front"));
  assert(source.includes("Details: Rise"));
  assert(source.includes("GARMENT_CATEGORY_LIBRARY.map"));
});


test("Designer shows current and future garment types before fabric selection",()=>{
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert(source.includes("newDesignerGarmentScope"));
  assert(source.includes("GARMENT_CATEGORY_LIBRARY.map"));
  assert(source.includes('garment.status==="live"?"CURRENT":"FUTURE"'));
  assert(source.indexOf("newDesignerGarmentScope") < source.indexOf("newDesignerFabricGrid"));
});
