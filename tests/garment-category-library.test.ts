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
  assert(byId.shirt.detailFamilies.includes("Collar"));
  assert(byId.trouser.detailFamilies.includes("Rise"));
  assert(byId.blazer.detailFamilies.includes("Lapel"));
  assert(byId.suit.detailFamilies.includes("Jacket"));
});

test("GarmentViewer shows garment construction scope, not fabric alone",()=>{
  const source=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(source.includes("GARMENT TYPES · CURRENT + FUTURE"));
  assert(source.includes("Construction families: Collar"));
  assert(source.includes("Construction families: Rise"));
  assert(source.includes("GARMENT_CATEGORY_LIBRARY.map"));
});
