import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("GarmentViewer and customer Designer share the same active stock loader",()=>{
  const catalog=readFileSync("src/app/api/designer/catalog/route.ts","utf8");
  const viewer=readFileSync("src/app/lab/garment-viewer/page.tsx","utf8");
  const shared=readFileSync("src/lib/designer/catalog-stock-server.ts","utf8");

  assert.match(catalog,/loadActiveDesignerFabricStock/);
  assert.match(viewer,/loadActiveDesignerFabricStock/);
  for(const token of ["loadDesignerFabricMetadata","applyDesignerFabricMetadataToStock","applyLiveVerifiedStockAvailability"]) {
    assert.match(shared,new RegExp(token));
  }
  assert.match(shared,/filter\(\(fabric\)=>fabric\.inStock\)/);
});
