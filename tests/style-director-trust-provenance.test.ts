import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorIntelligenceTrustWeight } from "../src/lib/designer/style-director-compatibility.ts";

// Persisted supplier/intelligence objects must never gain physical review
// authority from prototype pollution or executable property accessors.
test("Style Director trust scoring rejects inherited provenance", () => {
  const inherited = Object.create({ reviewStatus: "approved", trust: "reviewed" });
  assert.equal(styleDirectorIntelligenceTrustWeight(inherited), 0);
  const mixed = Object.create({ trust: "reviewed" });
  mixed.reviewStatus = "approved";
  assert.equal(styleDirectorIntelligenceTrustWeight(mixed), 0);
});

test("Style Director trust scoring does not execute provenance getters", () => {
  let calls = 0;
  const data = Object.create(null);
  Object.defineProperty(data, "reviewStatus", {
    enumerable: true, get() { calls++; throw new Error("untrusted accessor"); },
  });
  Object.defineProperty(data, "trust", {
    enumerable: true, value: "reviewed",
  });
  assert.equal(styleDirectorIntelligenceTrustWeight(data), 0);
  assert.equal(calls, 0);
});

test("Style Director trust scoring accepts only explicit own plain values", () => {
  const approved = Object.assign(Object.create(null), {
    reviewStatus: "approved", trust: "reviewed",
  });
  assert.equal(styleDirectorIntelligenceTrustWeight(approved), 1);
  assert.equal(styleDirectorIntelligenceTrustWeight({
    reviewStatus: "rejected", trust: "reviewed",
  }), 0);
});
