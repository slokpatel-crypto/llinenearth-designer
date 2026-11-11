import assert from "node:assert/strict";
import test from "node:test";
import type { DesignerFabricIntelligence } from "../src/lib/fabric-intelligence-types.ts";
import {
  styleDirectorScoringProfile,
  usableStyleDirectorIntelligence,
} from "../src/lib/designer/style-director-intelligence-scoring.ts";
import {
  styleDirectorIntelligenceTrustWeight,
} from "../src/lib/designer/style-director-compatibility.ts";

const fixture = () => ({
  reviewStatus: "approved",
  trust: "reviewed",
  formality: 4,
  statementLevel: 2,
  bestGarments: ["shirt", "overshirt"],
  climateVisualFit: ["hot_humid"],
  pairing: {
    goodColorFamilies: ["blue_family"],
    avoidColorFamilies: ["orange_family"],
  },
  depth: "mid",
  colorFamily: "blue_family",
});
const score = (value: unknown) =>
  usableStyleDirectorIntelligence(value as DesignerFabricIntelligence);

test("reviewed fabric intelligence becomes one stable, bounded plain-data snapshot", () => {
  const raw = fixture();
  const result = score(raw);
  assert.ok(result);
  assert.equal(styleDirectorIntelligenceTrustWeight(result), 1);
  assert.deepEqual(result, fixture());
  assert.notEqual(result, raw);
  assert.notEqual(result.bestGarments, raw.bestGarments);
  assert.notEqual(result.pairing, raw.pairing);
  assert.notEqual(result.pairing.goodColorFamilies, raw.pairing.goodColorFamilies);
  raw.bestGarments[0] = "trouser";
  raw.pairing.goodColorFamilies[0] = "brown_family";
  assert.deepEqual(result.bestGarments, ["shirt", "overshirt"]);
  assert.deepEqual(result.pairing.goodColorFamilies, ["blue_family"]);
  assert.deepEqual(score(Object.freeze(fixture())), fixture());
});

test("stale, unapproved and invalid source scores cannot affect ranking", () => {
  for (const value of [
    { ...fixture(), reviewStatus: "rejected" },
    { ...fixture(), reviewStatus: "unknown" },
    { ...fixture(), trust: "unknown" },
    { ...fixture(), formality: 0 },
    { ...fixture(), formality: 6 },
    { ...fixture(), formality: Number.NaN },
    { ...fixture(), statementLevel: 1.5 },
    { ...fixture(), pairing: null },
    { ...fixture(), bestGarments: "shirt" },
    { ...fixture(), climateVisualFit: {} },
    { ...fixture(), pairing: { goodColorFamilies: [], avoidColorFamilies: "brown_family" } },
    { ...fixture(), bestGarments: new Array(129).fill("shirt") },
    { ...fixture(), bestGarments: new Array(2) },
    { ...fixture(), bestGarments: ["shirt", 5] },
  ]) {
    assert.equal(score(value), null, "invalid persisted scoring intelligence is ignored");
  }
  assert.equal(score(null), null);
  assert.equal(score(undefined), null);
});

test("accessor-backed scalar values and nested pairing lists are never invoked", () => {
  for (const field of ["formality", "statementLevel", "bestGarments", "depth", "colorFamily", "pairing"] as const) {
    let calls = 0;
    const raw = Object.defineProperty({ ...fixture() }, field, {
      enumerable: true,
      get() {
        calls++;
        throw new Error("fabric intelligence getter must not execute");
      },
    });
    if (field === "depth" || field === "colorFamily") {
      const snapshot = score(raw);
      assert.ok(snapshot, field + " is a neutral optional ranking modifier");
      assert.equal(snapshot.depth, "mid");
      assert.equal(snapshot.colorFamily, field === "colorFamily" ? null : "blue_family");
    } else {
      assert.equal(score(raw), null, field);
    }
    assert.equal(calls, 0);
  }
  for (const field of ["goodColorFamilies", "avoidColorFamilies"] as const) {
    let calls = 0;
    const pairing = Object.defineProperty({ ...fixture().pairing }, field, {
      enumerable: true,
      get() { calls++; throw new Error("pairing getter"); },
    });
    assert.equal(score({ ...fixture(), pairing }), null, field);
    assert.equal(calls, 0);
  }
});

test("malformed, sparse and getter-backed arrays cannot influence styling", () => {
  let calls = 0;
  const accessorList = ["shirt", "overshirt"];
  Object.defineProperty(accessorList, "0", {
    configurable: true, enumerable: true,
    get() { calls++; return "shirt"; },
  });
  assert.equal(score({ ...fixture(), bestGarments: accessorList }), null);
  assert.equal(calls, 0);
  const hole = ["shirt", "overshirt"];
  delete (hole as (string | undefined)[])[0];
  assert.equal(score({ ...fixture(), climateVisualFit: hole }), null);
  const revoked = Proxy.revocable(["shirt"], {});
  revoked.revoke();
  assert.equal(score({ ...fixture(), bestGarments: revoked.proxy }), null);
  const hostile = new Proxy(["shirt"], {
    getOwnPropertyDescriptor() { throw new Error("hostile list"); },
  });
  assert.equal(score({ ...fixture(), bestGarments: hostile }), null);
});

test("fabric profile maps reject inherited, getter-backed, revoked and hostile entries", () => {
  const approved = fixture() as unknown as DesignerFabricIntelligence;
  const own = { linen_60: approved };
  assert.equal(styleDirectorScoringProfile(own, "linen_60"), approved);
  const inherited = Object.create(own);
  assert.equal(styleDirectorScoringProfile(inherited, "linen_60"), null);
  let calls = 0;
  const getter = Object.defineProperty({}, "linen_60", {
    get() { calls++; return approved; },
  });
  assert.equal(styleDirectorScoringProfile(getter as Record<string, DesignerFabricIntelligence>, "linen_60"), null);
  assert.equal(calls, 0);
  const trap = new Proxy(own, {
    getOwnPropertyDescriptor() { throw new Error("hostile fabric map"); },
  });
  assert.equal(styleDirectorScoringProfile(trap, "linen_60"), null);
  const revoked = Proxy.revocable(own, {});
  revoked.revoke();
  assert.equal(styleDirectorScoringProfile(revoked.proxy, "linen_60"), null);
  assert.equal(styleDirectorScoringProfile(own, "other"), null);
});

test("plain copies ignore untrusted extra physical-evidence getters", () => {
  let calls = 0;
  const raw = Object.defineProperty(fixture(), "verifiedPhysical", {
    enumerable: true,
    get() { calls++; throw new Error("physical facts cannot be inferred by scoring"); },
  });
  const result = score(raw);
  assert.ok(result);
  assert.equal(calls, 0);
  assert.equal("verifiedPhysical" in result, false);
});


test("provenance is captured once, so dynamic proxies cannot change the validated scoring identity", () => {
  for (const field of ["trust", "reviewStatus"] as const) {
    let reads = 0;
    const original = fixture();
    const dynamic = new Proxy(original, {
      getOwnPropertyDescriptor(target, key) {
        if (key === field) {
          reads++;
          if (reads > 1) throw new Error("untrusted provenance read twice");
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const copy = score(dynamic);
    assert.ok(copy, field + " must have a consistent approved snapshot");
    assert.equal(reads, 1, field + " must be read only once per scoring review");
    assert.equal(copy.reviewStatus, "approved", field);
    assert.equal(copy.trust, "reviewed", field);
    assert.equal(styleDirectorIntelligenceTrustWeight(copy), 1);
    assert.deepEqual(copy.bestGarments, ["shirt", "overshirt"]);
  }
});

test("captured rejected or missing provenance fails closed without reading ranking fields", () => {
  for (const reviewed of [
    { trust: "reviewed", reviewStatus: "rejected" },
    { trust: "reviewed", reviewStatus: undefined },
    { trust: undefined, reviewStatus: "approved" },
  ]) {
    let accessedFormality = 0;
    const unsafe = new Proxy({ ...fixture(), ...reviewed }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === "formality") {
          accessedFormality++;
          throw new Error("must not inspect a rejected profile's scoring fields");
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    assert.equal(score(unsafe), null);
    assert.equal(accessedFormality, 0);
  }
});
