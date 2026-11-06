import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorIntelligenceTrustWeight } from "../src/lib/designer/style-director-compatibility.ts";

// Persisted intelligence can contain old, missing or invalid trust vocabulary.
// Such records must not become evidence for styling or physical suitability.
test("style intelligence trust matrix is deterministic and fails closed", () => {
  const cases = [
    ["reviewed", "approved", 1],
    ["reviewed", "corrected", 1],
    ["reviewed", "unreviewed", 0.28],
    ["high-confidence", "approved", 0.72],
    ["high-confidence", "unreviewed", 0.72],
    ["provisional", "corrected", 0.28],
    ["provisional", "unreviewed", 0.28],
    ["reviewed", "rejected", 0],
    ["high-confidence", "rejected", 0],
    ["provisional", "rejected", 0],
    ["unknown", "approved", 0],
    ["reviewed", "unknown", 0],
    [null, "approved", 0],
    ["reviewed", null, 0],
  ] as const;
  for (const [trust, reviewStatus, expected] of cases) {
    const input = { trust, reviewStatus } as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0];
    const before = JSON.stringify(input);
    assert.equal(styleDirectorIntelligenceTrustWeight(input), expected, String(trust) + "/" + String(reviewStatus));
    assert.equal(styleDirectorIntelligenceTrustWeight(input), expected, "repeat decision");
    assert.equal(JSON.stringify(input), before, "never mutate stored intelligence");
  }
  assert.equal(styleDirectorIntelligenceTrustWeight(null), 0);
  assert.equal(styleDirectorIntelligenceTrustWeight(undefined), 0);
});
