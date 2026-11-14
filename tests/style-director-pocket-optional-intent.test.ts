import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePocket,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// Optional and unresolved pocket descriptions are not tailoring instructions.
// Never silently convert them into a locked construction approval.
test("optional pocket descriptions do not choose a versioned construction", () => {
  for (const phrase of ["optional flap pocket", "patch pocket is optional", "maybe flap pocket"]) {
    const intent = styleDirectorCandidatePocketIntent(phrase);
    assert.equal(intent.requested, null, phrase);
    assert.deepEqual(intent.prohibited, [], phrase);
    assert.equal(intent.ambiguous, false, phrase);
    assert.equal(styleDirectorCandidatePocket(phrase), null, phrase);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "no_pocket" }), [], phrase);
  }
});

test("with-or-without pocket alternatives remain undecided and do not mutate locked IDs", () => {
  for (const phrase of ["with or without flap pocket", "with or without patch pocket"]) {
    const locked = Object.freeze({ pocket: "flap_pocket" });
    const before = Object.getOwnPropertyDescriptors(locked);
    const intent = styleDirectorCandidatePocketIntent(phrase);
    assert.equal(intent.ambiguous, true, phrase);
    assert.equal(intent.requested, null, phrase);
    assert.deepEqual(intent.prohibited, [], phrase);
    assert.equal(styleDirectorCandidatePocket(phrase), null, phrase);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, locked), [], phrase);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, locked), [], phrase);
    assert.deepEqual(Object.getOwnPropertyDescriptors(locked), before, phrase);
  }
});

test("contradictory positive pocket instructions require review, not an arbitrary selection", () => {
  const phrase = "patch pocket and flap pocket";
  const intent = styleDirectorCandidatePocketIntent(phrase);
  assert.equal(intent.ambiguous, true);
  assert.equal(intent.requested, null);
  assert.equal(styleDirectorCandidatePocket(phrase), null);
  assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "flap_pocket" }), []);
});

test("optional pocket choice never overrides a separate explicit flap exclusion", () => {
  const phrase = "with or without patch pocket, but flap pocket must not be used";
  const intent = styleDirectorCandidatePocketIntent(phrase);
  assert.equal(intent.requested, null);
  assert.equal(intent.ambiguous, true);
  assert.deepEqual(intent.prohibited, ["flap_pocket"]);
  assert.equal(styleDirectorCandidatePocket(phrase), null);
  for (const pocket of ["flap_pocket", "retired_pocket"]) {
    const locked = Object.freeze({ pocket });
    const before = Object.getOwnPropertyDescriptors(locked);
    const expected = [{ code: "candidate_pocket_mismatch", explanation: "The explicit pocket request or exclusion conflicts with the versioned locked shirt pocket construction; confirm the pocket before cutting." }];
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, locked as Parameters<typeof styleDirectorCandidatePocketIssues>[1]), expected);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, locked as Parameters<typeof styleDirectorCandidatePocketIssues>[1]), expected);
    assert.deepEqual(Object.getOwnPropertyDescriptors(locked), before);
  }
  assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "no_pocket" }), []);
  assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "single_patch_pocket" }), []);
});
