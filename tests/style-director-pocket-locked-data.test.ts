import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePocket,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// Pocket recommendations are construction-only: they never imply that the
// photographic preview depicts a pocket or that fabric is approved for cutting.
test("pocket absence is a canonical positive choice, not a prohibited ID", () => {
  for (const phrase of ["no pocket", "without pockets", "pocketless"]) {
    const intent = styleDirectorCandidatePocketIntent(phrase);
    assert.equal(intent.requested, "no_pocket", phrase);
    assert.deepEqual(intent.prohibited, [], phrase);
    assert.equal(intent.ambiguous, false, phrase);
    assert.equal(styleDirectorCandidatePocket(phrase), "no_pocket", phrase);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "no_pocket" }), [], phrase);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "flap_pocket" })
      .map(issue => issue.code), ["candidate_pocket_mismatch"], phrase);
  }
});

test("explicit patch or flap pocket constraints cannot approve unknown saved construction", () => {
  for (const [phrase, expected] of [
    ["patch pocket", "single_patch_pocket"],
    ["flap pocket", "flap_pocket"],
  ] as const) {
    const locked = Object.freeze({ pocket: expected });
    const descriptors = Object.getOwnPropertyDescriptors(locked);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, locked), [], phrase);
    for (const invalid of ["", "retired_pocket", "formal_flat_front", undefined, null]) {
      const selection = Object.freeze({ pocket: invalid });
      const first = styleDirectorCandidatePocketIssues(phrase, selection as never);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_pocket_mismatch"], phrase);
      assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, selection as never), first);
    }
    assert.deepEqual(Object.getOwnPropertyDescriptors(locked), descriptors);
  }
});

test("pocket exclusions reject inherited and executable locked selections without invoking getters", () => {
  let calls = 0;
  const inherited = Object.create({ pocket: "no_pocket" });
  const accessor = Object.create(null);
  Object.defineProperty(accessor, "pocket", {
    enumerable: true,
    get() { calls++; throw new Error("untrusted saved pocket"); },
  });
  for (const selection of [inherited, accessor]) {
    const first = styleDirectorCandidatePocketIssues("no flap pocket", selection);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_pocket_mismatch"]);
    assert.deepEqual(styleDirectorCandidatePocketIssues("no flap pocket", selection), first);
  }
  assert.equal(calls, 0);
  assert.deepEqual(styleDirectorCandidatePocketIssues("no flap pocket",
    { pocket: "no_pocket" }), []);
  assert.deepEqual(styleDirectorCandidatePocketIssues("no flap pocket",
    { pocket: "flap_pocket" }).map(issue => issue.code), ["candidate_pocket_mismatch"]);
});
