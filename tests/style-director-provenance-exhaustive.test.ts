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
  for (const invalid of ["", "Reviewed", "APPROVED", "rejected ", "unknown", 0, false]) {
    const unknownTrust = { trust: invalid, reviewStatus: "approved" } as unknown as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
    const unknownReview = { trust: "reviewed", reviewStatus: invalid } as unknown as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
    assert.equal(styleDirectorIntelligenceTrustWeight(unknownTrust), 0);
    assert.equal(styleDirectorIntelligenceTrustWeight(unknownReview), 0);
  }
});
