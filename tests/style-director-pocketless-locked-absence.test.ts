import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePocket,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// An explicit absence of a pocket is a construction choice, not a ban on
// the versioned no_pocket ID. Do not silently replace saved selections.
test("pocketless and no-pocket instructions require the canonical absence option", () => {
  for (const phrase of ["pocketless", "no pocket", "without pockets"]) {
    const intent = styleDirectorCandidatePocketIntent(phrase);
    assert.equal(intent.requested, "no_pocket", phrase);
    assert.deepEqual(intent.prohibited, [], phrase);
    assert.equal(intent.ambiguous, false, phrase);
    assert.equal(styleDirectorCandidatePocket(phrase), "no_pocket", phrase);
    const locked = Object.freeze({ pocket: "no_pocket" });
    const before = Object.getOwnPropertyDescriptors(locked);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, locked), [], phrase);
    assert.deepEqual(Object.getOwnPropertyDescriptors(locked), before, phrase);
    for (const pocket of ["single_patch_pocket", "flap_pocket"]) {
      const saved = Object.freeze({ pocket });
      const first = styleDirectorCandidatePocketIssues(phrase, saved);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_pocket_mismatch"], phrase);
      assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, saved), first, phrase);
    }
  }
});

test("explicit pocketless construction fails closed on untrusted saved IDs", () => {
  let calls = 0;
  const inherited = Object.create({ pocket: "no_pocket" });
  const accessor = Object.create(null);
  Object.defineProperty(accessor, "pocket", {
    enumerable: true,
    get() { calls++; throw new Error("untrusted pocket accessor"); },
  });
  for (const locked of [inherited, accessor, { pocket: "retired_pocket" }, {}]) {
    const first = styleDirectorCandidatePocketIssues("pocketless", locked as never);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_pocket_mismatch"]);
    assert.deepEqual(styleDirectorCandidatePocketIssues("pocketless", locked as never), first);
  }
  assert.equal(calls, 0);
});
