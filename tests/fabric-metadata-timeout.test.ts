import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const metadata = readFileSync(new URL("../src/lib/designer-fabric-metadata.ts", import.meta.url), "utf8");
const inventory = readFileSync(new URL("../src/app/api/inventory/route.ts", import.meta.url), "utf8");
const stock = readFileSync(new URL("../src/lib/designer/stock-availability-server.ts", import.meta.url), "utf8");

test("live operator fabric metadata lookup has a bounded deadline and a fail-closed fallback", () => {
  assert.match(metadata, /signal:AbortSignal\.timeout\(8_000\)/);
  assert.match(metadata, /if \(!cloud\) return \{\}/);
  assert.match(metadata, /catch \(error\) \{[\s\S]*?return \{\};/);
  assert.match(metadata, /cache:"no-store"/);
});

test("inventory still waits for verified stock, not bundled optimistic availability", () => {
  assert.match(inventory, /applyLiveVerifiedStockAvailability\(applyDesignerFabricMetadataToStock\(metadata\)\)/);
  assert.match(stock, /signal:AbortSignal\.timeout\(8_000\)/);
  assert.match(inventory, /"cache-control": "private, no-store"/);
});
