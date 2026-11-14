import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorIntelligenceTrustWeight } from "../src/lib/designer/style-director-compatibility.ts";

/**
 * Persisted supplier/intelligence provenance must be explicit own data.
 * A forged prototype or accessor must not confer reviewed status or alter
 * deterministic garment recommendations.
 */
test("style scoring ignores inherited approval and trust vocabulary", () => {
  const inherited = Object.create({ reviewStatus: "approved", trust: "reviewed" });
  assert.equal(styleDirectorIntelligenceTrustWeight(inherited), 0);
  const partial = Object.assign(Object.create({ reviewStatus: "approved" }), {
    trust: "reviewed",
  });
  assert.equal(styleDirectorIntelligenceTrustWeight(partial), 0);
  const valid = Object.freeze({ reviewStatus: "approved", trust: "reviewed" });
  assert.equal(styleDirectorIntelligenceTrustWeight(valid), 1);
  assert.equal(styleDirectorIntelligenceTrustWeight(valid), 1);
});

test("style scoring does not evaluate accessor-backed provenance", () => {
  let reads = 0;
  const forged = {};
  for (const field of ["reviewStatus", "trust"]) {
    Object.defineProperty(forged, field, {
      enumerable: true,
      get() {
        reads++;
        throw new Error("untrusted provenance getter executed");
      },
    });
  }
  assert.equal(styleDirectorIntelligenceTrustWeight(forged as never), 0);
  assert.equal(reads, 0);
});

test("style scoring fails closed for revoked or hostile provenance proxies", () => {
  const revoked = Proxy.revocable({ reviewStatus: "approved", trust: "reviewed" }, {});
  revoked.revoke();
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() {
      throw new Error("untrusted descriptor lookup");
    },
  });
  for (const candidate of [revoked.proxy, hostile]) {
    assert.equal(styleDirectorIntelligenceTrustWeight(candidate as never), 0);
    assert.equal(styleDirectorIntelligenceTrustWeight(candidate as never), 0);
  }
});
