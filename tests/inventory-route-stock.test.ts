import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyVerifiedStockAvailability } from "../src/lib/designer/stock-availability.ts";

const route = readFileSync(new URL("../src/app/api/inventory/route.ts", import.meta.url), "utf8");

test("legacy inventory endpoint uses live reviewed stock, not optimistic bundled flags", () => {
  assert.match(route, /applyDesignerFabricMetadataToStock\(metadata\)/);
  assert.match(route, /loadDesignerFabricMetadataWithStatus\(\)/);
  assert.match(route, /sourceVerified\s*\?/);
  assert.match(route, /\? await applyLiveVerifiedStockAvailability\(structured\)/);
  assert.match(route, /: applyVerifiedStockAvailability\(structured,\[\]\)/);
  assert.match(route, /const fabrics = \[\.\.\.liveStock\.stock, \.\.\.legacy\]/);
  assert.match(route, /inStock: fabrics\.filter\(\(fabric\) => fabric\.inStock\)\.length/);
  assert.match(route, /"cache-control": "private, no-store"/);
  assert.match(route, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(route, /FABRIC_STOCK\.filter\(/);
});

test("legacy inventory physical availability remains unknown when the live ledger is empty", () => {
  const swatches = [
    { id: "shirt-1", inStock: true, suitableFor: ["shirt"] },
    { id: "trouser-1", inStock: true, suitableFor: ["trouser"] },
  ];
  const live = applyVerifiedStockAvailability(swatches as never, []);
  assert.deepEqual(live.verifiedFabricIds, []);
  assert.deepEqual(live.stock.map(({ inStock, availabilityVerified }) => ({ inStock, availabilityVerified })), [
    { inStock: false, availabilityVerified: false },
    { inStock: false, availabilityVerified: false },
  ]);
});

test("inventory totals cannot advertise sold-out, unsupported or unverified legacy swatches", () => {
  const swatches = [
    { id: "shirt-1", inStock: true },
    { id: "trouser-1", inStock: false },
  ];
  const live = applyVerifiedStockAvailability(swatches as never, [
    { fabric_id: "shirt-1", available_metres: "2.125", provenance_ready: true },
    { fabric_id: "trouser-1", available_metres: "5.000", provenance_ready: true },
  ]);
  const legacy = [{ id: "legacy-site-1", inStock: false }];
  const fabrics = [...live.stock, ...legacy];
  assert.equal(fabrics.filter((fabric) => fabric.inStock).length, 1);
  assert.equal(live.verifiedFabricIds.length, 2);
  assert.equal(fabrics.find((fabric) => fabric.id === "trouser-1")?.inStock, false);
  assert.equal(fabrics.find((fabric) => fabric.id === "legacy-site-1")?.inStock, false);
});
