import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorIntelligenceTrustWeight } from "../src/lib/designer/style-director-compatibility.ts";

// A persisted record can be corrupted before Style Director receives it.
// Invalid review provenance must not become a fabric-quality recommendation.
test("Style Director trust fails closed for malformed primitive provenance", () => {
  for (const value of [null, undefined, false, true, 0, 1, "", "approved", [], ["reviewed"]]) {
    assert.equal(styleDirectorIntelligenceTrustWeight(value as never), 0);
  }
});

test("Style Director trust rejects executable review metadata without reading it", () => {
  let reads = 0;
  const record = { trust: "reviewed" } as Record<string, unknown>;
  Object.defineProperty(record, "reviewStatus", {
    enumerable: true,
    get() { reads++; throw new Error("untrusted review getter"); },
  });
  assert.equal(styleDirectorIntelligenceTrustWeight(record as never), 0);
  assert.equal(reads, 0);
});

test("Style Director trust ignores inherited approval even on frozen records", () => {
  const record = Object.freeze(Object.assign(
    Object.create({ reviewStatus: "approved" }), { trust: "reviewed" },
  ));
  assert.equal(styleDirectorIntelligenceTrustWeight(record), 0);
});
