import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorIntelligenceTrustWeight } from "../src/lib/designer/style-director-compatibility.ts";

// Exhaust the persisted closed vocabulary, including legacy malformed values.
// A rejected record must never increase recommendation confidence.
test("all provenance trust/review combinations have stable fail-closed weights", () => {
  const expected: Record<string, Record<string, number>> = {
    reviewed: { approved: 1, corrected: 1, unreviewed: 0.28, rejected: 0 },
    "high-confidence": { approved: 0.72, corrected: 0.72, unreviewed: 0.72, rejected: 0 },
    provisional: { approved: 0.28, corrected: 0.28, unreviewed: 0.28, rejected: 0 },
  };
  for (const [trust, statuses] of Object.entries(expected)) {
    for (const [reviewStatus, weight] of Object.entries(statuses)) {
      const record = Object.freeze({ trust, reviewStatus });
      const input = record as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
      assert.equal(styleDirectorIntelligenceTrustWeight(input), weight, trust + "/" + reviewStatus);
      assert.equal(styleDirectorIntelligenceTrustWeight(input), weight, "replay must be stable");
    }
  }
  // Missing and partial persisted intelligence must never be treated as reviewed.
  for (const absent of [null, undefined, {}, { trust: "reviewed" }, { reviewStatus: "approved" }]) {
    const input = absent as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
    assert.equal(styleDirectorIntelligenceTrustWeight(input), 0);
    assert.equal(styleDirectorIntelligenceTrustWeight(input), 0, "missing provenance replay");
  }
  for (const invalid of ["", "Reviewed", "APPROVED", "rejected ", "unknown", 0, false]) {
    const unknownTrust = { trust: invalid, reviewStatus: "approved" } as unknown as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
    const unknownReview = { trust: "reviewed", reviewStatus: invalid } as unknown as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
    assert.equal(styleDirectorIntelligenceTrustWeight(unknownTrust), 0);
    assert.equal(styleDirectorIntelligenceTrustWeight(unknownReview), 0);
  }
});

test("inherited provenance cannot impersonate a reviewed fabric record", () => {
  const inheritedBoth = Object.create({ trust: "reviewed", reviewStatus: "approved" });
  const inheritedTrust = Object.assign(Object.create({ trust: "reviewed" }), {
    reviewStatus: "approved",
  });
  const inheritedReview = Object.assign(Object.create({ reviewStatus: "approved" }), {
    trust: "reviewed",
  });
  for (const record of [inheritedBoth, inheritedTrust, inheritedReview]) {
    Object.freeze(record);
    const input = record as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
    assert.equal(styleDirectorIntelligenceTrustWeight(input), 0);
    assert.equal(styleDirectorIntelligenceTrustWeight(input), 0, "deterministic replay");
  }
  const own = Object.freeze({ trust: "reviewed", reviewStatus: "approved" });
  assert.equal(styleDirectorIntelligenceTrustWeight(own), 1,
    "valid own provenance must retain its ranking weight");
});

test("computed provenance cannot fabricate approval or execute scoring getters", () => {
  let accesses = 0;
  const forged = Object.create(null);
  Object.defineProperties(forged, {
    trust: { enumerable: true, get() { accesses++; return "reviewed"; } },
    reviewStatus: { enumerable: true, get() { accesses++; return "approved"; } },
  });
  const mixed = Object.defineProperty({ trust: "reviewed" }, "reviewStatus", {
    enumerable: true, get() { throw new Error("untrusted accessor executed"); },
  });
  for (const record of [forged, mixed]) {
    const input = record as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
    assert.equal(styleDirectorIntelligenceTrustWeight(input), 0);
    assert.equal(styleDirectorIntelligenceTrustWeight(input), 0, "deterministic replay");
  }
  assert.equal(accesses, 0, "untrusted provenance getters must never run");
  const ownData = Object.assign(Object.create(null), { trust: "reviewed", reviewStatus: "approved" });
  assert.equal(styleDirectorIntelligenceTrustWeight(ownData), 1,
    "valid own data on a null-prototype record must remain supported");
});

test("non-string and spoofed provenance values cannot acquire approval weight", () => {
  const forgedValues: unknown[] = [
    new String("reviewed"),
    ["reviewed"],
    { toString() { throw new Error("untrusted conversion executed"); } },
    Symbol("reviewed"),
    1n,
  ];
  for (const value of forgedValues) {
    for (const key of ["trust", "reviewStatus"] as const) {
      const record = {
        trust: "reviewed",
        reviewStatus: "approved",
        [key]: value,
      } as unknown as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
      assert.equal(styleDirectorIntelligenceTrustWeight(record), 0, key + " must fail closed");
      assert.equal(styleDirectorIntelligenceTrustWeight(record), 0, "replay must fail closed");
    }
  }
  assert.equal(styleDirectorIntelligenceTrustWeight(
    Object.freeze({ trust: "reviewed", reviewStatus: "approved" }),
  ), 1, "valid own-string metadata remains supported");
});
