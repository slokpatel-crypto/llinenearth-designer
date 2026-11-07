import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePlacketIssues,
  styleDirectorCandidatePocketIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// A proposed garment label cannot certify a saved construction without an
// own-data, current-catalogue ID. Never execute saved accessors or rewrite IDs.
test("explicit shirt placket constraints require trustworthy locked option IDs", () => {
  const ordinary = Object.freeze({ placket: "standard_visible_placket" });
  const hidden = Object.freeze({ placket: "hidden_fly_front" });
  assert.deepEqual(styleDirectorCandidatePlacketIssues("no hidden placket", ordinary), []);
  assert.deepEqual(styleDirectorCandidatePlacketIssues("hidden placket", hidden), []);
  assert.equal(styleDirectorCandidatePlacketIssues("hidden placket", ordinary)[0]?.code,
    "candidate_placket_mismatch");
  assert.equal(styleDirectorCandidatePlacketIssues("no hidden placket", hidden)[0]?.code,
    "candidate_placket_mismatch");
  const inherited = Object.create({ placket: "standard_visible_placket" });
  const accessor = Object.defineProperty({}, "placket", {
    get() { throw new Error("untrusted placket getter must not execute"); },
  });
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("untrusted placket descriptor"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const value of [{}, inherited, accessor, hostile, revoked.proxy,
    { placket: "flap_pocket" }, null]) {
    for (const wording of ["hidden placket", "no hidden placket"]) {
      const first = styleDirectorCandidatePlacketIssues(wording, value as never);
      assert.equal(first.length, 1, wording);
      assert.equal(first[0].code, "candidate_placket_mismatch", wording);
      assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, value as never), first);
    }
  }
  assert.deepEqual(styleDirectorCandidatePlacketIssues("maybe hidden placket", {} as never), [],
    "an optional choice does not require matching a saved option");
  assert.equal(ordinary.placket, "standard_visible_placket");
  assert.equal(hidden.placket, "hidden_fly_front");
});

test("explicit pocket requests and exclusions fail closed on untrusted locked IDs", () => {
  const bare = Object.freeze({ pocket: "no_pocket" });
  const patch = Object.freeze({ pocket: "single_patch_pocket" });
  const flap = Object.freeze({ pocket: "flap_pocket" });
  assert.deepEqual(styleDirectorCandidatePocketIssues("no pocket", bare), []);
  assert.deepEqual(styleDirectorCandidatePocketIssues("patch pocket", patch), []);
  assert.deepEqual(styleDirectorCandidatePocketIssues("no flap pocket", bare), []);
  assert.equal(styleDirectorCandidatePocketIssues("no flap pocket", flap)[0]?.code,
    "candidate_pocket_mismatch");
  assert.equal(styleDirectorCandidatePocketIssues("no pocket", patch)[0]?.code,
    "candidate_pocket_mismatch");
  const inherited = Object.create({ pocket: "no_pocket" });
  const accessor = Object.defineProperty({}, "pocket", {
    get() { throw new Error("untrusted pocket getter must not execute"); },
  });
  const hostile = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("untrusted pocket descriptor"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const value of [{}, inherited, accessor, hostile, revoked.proxy,
    { pocket: "french_placket" }, null]) {
    for (const wording of ["no pocket", "patch pocket", "no flap pocket"]) {
      const first = styleDirectorCandidatePocketIssues(wording, value as never);
      assert.equal(first.length, 1, wording);
      assert.equal(first[0].code, "candidate_pocket_mismatch", wording);
      assert.deepEqual(styleDirectorCandidatePocketIssues(wording, value as never), first);
    }
  }
  assert.deepEqual(styleDirectorCandidatePocketIssues("patch pocket optional", {} as never), []);
  assert.equal(bare.pocket, "no_pocket");
  assert.equal(patch.pocket, "single_patch_pocket");
  assert.equal(flap.pocket, "flap_pocket");
});
