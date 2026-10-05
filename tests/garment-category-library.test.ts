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
  assert(byId.shirt.typeExamples.includes("Dress Shirt"));
  assert(byId.trouser.typeExamples.includes("Pleated Trouser"));
  assert(byId.blazer.typeExamples.includes("Single-Breasted 2-Button"));
  assert(byId.suit.typeExamples.includes("3-Piece Suit"));
  assert(byId.shirt.detailFamilies.includes("Collar"));
  assert(byId.trouser.detailFamilies.includes("Rise"));
  assert(byId.blazer.detailFamilies.includes("Lapel"));
  assert(byId.suit.detailFamilies.includes("Jacket"));
});

test("GarmentViewer shows garment construction scope, not fabric alone",()=>{
  const source=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(source.includes("GARMENT TYPES · CURRENT + FUTURE"));
  assert(source.includes("SHIRT_GARMENT_CATEGORY.typeExamples"));
  assert(source.includes("SHIRT_GARMENT_CATEGORY.detailFamilies"));
  assert(source.includes("TROUSER_GARMENT_CATEGORY.typeExamples"));
  assert(source.includes("TROUSER_GARMENT_CATEGORY.detailFamilies"));
  assert(source.includes("GARMENT_CATEGORY_LIBRARY.map"));
});


test("Designer shows current and future garment types before fabric selection",()=>{
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert(source.includes("newDesignerGarmentScope"));
  assert(source.includes("GARMENT_CATEGORY_LIBRARY.map"));
  assert(source.includes('garment.status==="live"?"CURRENT":"FUTURE"'));
  assert(source.indexOf("newDesignerGarmentScope") < source.indexOf("newDesignerFabricGrid"));
});


test("future blazer and suit taxonomy stays planned",()=>{
  const future=readFileSync("src/lib/designer/future-garment-options.ts","utf8");
  for(const token of ["blazer.type","blazer.lapel","blazer.vent","blazer.pocket","blazer.shoulder","suit.type","suit.waistcoat","suit.jacket","suit.trouser"]) {
    assert(future.includes(token),token);
  }
  assert(future.includes('status:"planned"'));
});


test("3D lab carries the saved Designer recipe without claiming geometry support",()=>{
  const source=readFileSync("src/components/GarmentViewer.tsx","utf8");
  assert(source.includes("linen-earth:real-designer-draft:v2"));
  assert(source.includes("YOUR DESIGNER RECIPE"));
  assert(source.includes("temporary 3D block maps fabric now"));
  assert(source.includes("construction-specific mesh changes remain a later production-model step"));
});
