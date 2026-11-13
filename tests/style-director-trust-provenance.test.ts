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

test("Style Director trust scoring fails closed for revoked and throwing proxies", () => {
  const revoked = Proxy.revocable({ reviewStatus: "approved", trust: "reviewed" }, {});
  revoked.revoke();
  assert.equal(styleDirectorIntelligenceTrustWeight(revoked.proxy), 0);

  const hostile = new Proxy({ reviewStatus: "approved", trust: "reviewed" }, {
    getOwnPropertyDescriptor() { throw new Error("unreadable provenance"); },
  });
  assert.equal(styleDirectorIntelligenceTrustWeight(hostile), 0);
});

test("Style Director trust scoring never evaluates a trust getter", () => {
  let calls = 0;
  const record = { reviewStatus: "approved" } as Record<string, unknown>;
  Object.defineProperty(record, "trust", {
    enumerable: true,
    get() { calls++; throw new Error("untrusted trust getter"); },
  });
  assert.equal(styleDirectorIntelligenceTrustWeight(record as never), 0);
  assert.equal(calls, 0);
});

test("Style Director trust scoring preserves frozen explicit review decisions", () => {
  const approved = Object.freeze({ reviewStatus: "approved", trust: "reviewed" } as const);
  const corrected = Object.freeze({ reviewStatus: "corrected", trust: "reviewed" } as const);
  const rejected = Object.freeze({ reviewStatus: "rejected", trust: "reviewed" } as const);
  assert.equal(styleDirectorIntelligenceTrustWeight(approved), 1);
  assert.equal(styleDirectorIntelligenceTrustWeight(corrected), 1);
  assert.equal(styleDirectorIntelligenceTrustWeight(rejected), 0);
});

test("Style Director trust scoring rejects unreadable proxy metadata without executing values", () => {
  let getterCalls = 0;
  const record = { reviewStatus: "approved", trust: "reviewed" };
  const guarded = new Proxy(record, {
    get() { getterCalls++; throw new Error("must not read executable values"); },
    getOwnPropertyDescriptor(_target, key) {
      if (key === "trust") throw new Error("trust descriptor unavailable");
      return Reflect.getOwnPropertyDescriptor(record, key);
    },
  });
  assert.equal(styleDirectorIntelligenceTrustWeight(guarded), 0);
  assert.equal(getterCalls, 0);
});

test("Style Director trust scoring rejects incomplete frozen review provenance", () => {
  const missingTrust = Object.freeze({ reviewStatus: "approved" });
  const missingReview = Object.freeze({ trust: "reviewed" });
  assert.equal(styleDirectorIntelligenceTrustWeight(missingTrust as never), 0);
  assert.equal(styleDirectorIntelligenceTrustWeight(missingReview as never), 0);
  assert.equal(styleDirectorIntelligenceTrustWeight(Object.freeze(Object.create(null))), 0);
});
