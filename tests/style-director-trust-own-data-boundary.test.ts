import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorIntelligenceTrustWeight } from "../src/lib/designer/style-director-compatibility.ts";

// Provenance may arrive from JSON, a null-prototype parser, or a persisted
// object with an unexpected prototype. Only own plain-data approvals count.
test("trust scoring accepts frozen null-prototype own data without requiring Object.prototype", () => {
  const approved = Object.freeze(Object.assign(Object.create(null), {
    trust: "reviewed", reviewStatus: "approved",
  }));
  const corrected = Object.freeze(Object.assign(Object.create(null), {
    trust: "reviewed", reviewStatus: "corrected",
  }));
  assert.equal(styleDirectorIntelligenceTrustWeight(approved), 1);
  assert.equal(styleDirectorIntelligenceTrustWeight(corrected), 1);
  assert.equal(styleDirectorIntelligenceTrustWeight(approved), 1);
});

test("prototype approvals cannot rescue an own rejected or missing review", () => {
  const inherited = { trust: "reviewed", reviewStatus: "approved" };
  const missing = Object.create(inherited);
  const rejected = Object.create(inherited);
  Object.defineProperty(rejected, "reviewStatus", {
    value: "rejected", enumerable: true, configurable: false,
  });
  assert.equal(styleDirectorIntelligenceTrustWeight(missing), 0);
  assert.equal(styleDirectorIntelligenceTrustWeight(rejected), 0);
  assert.equal(styleDirectorIntelligenceTrustWeight(rejected), 0);
});

test("an own executable approval accessor is never invoked", () => {
  let calls = 0;
  const suspicious = Object.create(null);
  Object.defineProperty(suspicious, "trust", { value: "reviewed", enumerable: true });
  Object.defineProperty(suspicious, "reviewStatus", {
    enumerable: true,
    get() { calls++; throw new Error("untrusted executable approval"); },
  });
  assert.equal(styleDirectorIntelligenceTrustWeight(suspicious), 0);
  assert.equal(calls, 0);
});
