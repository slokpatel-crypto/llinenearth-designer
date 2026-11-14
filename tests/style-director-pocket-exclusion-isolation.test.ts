import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePocket,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// A negative pocket constraint is not an affirmative pocket selection.
// Keep the saved canonical option unchanged and require review on conflict.
test("explicit flap-pocket exclusion preserves a valid non-flap construction", () => {
  for (const phrase of ["no flap pocket", "without flap pocket", "flap pocket forbidden"]) {
    const intent = styleDirectorCandidatePocketIntent(phrase);
    assert.equal(intent.requested, null, phrase);
    assert.deepEqual(intent.prohibited, ["flap_pocket"], phrase);
    assert.equal(intent.ambiguous, false, phrase);
    assert.equal(styleDirectorCandidatePocket(phrase), null, phrase);
    const permitted = Object.freeze({ pocket: "single_patch_pocket" });
    const before = Object.getOwnPropertyDescriptors(permitted);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, permitted), [], phrase);
    assert.deepEqual(Object.getOwnPropertyDescriptors(permitted), before, phrase);
    const forbidden = Object.freeze({ pocket: "flap_pocket" });
    const first = styleDirectorCandidatePocketIssues(phrase, forbidden);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_pocket_mismatch"], phrase);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, forbidden), first, phrase);
  }
});

test("unresolved flap-pocket alternative cannot override a separate patch-pocket ban", () => {
  const phrase = "with or without flap pocket, no patch pocket";
  const intent = styleDirectorCandidatePocketIntent(phrase);
  assert.equal(intent.requested, null);
  assert.deepEqual(intent.prohibited, ["single_patch_pocket"]);
  assert.equal(intent.ambiguous, true);
  assert.equal(styleDirectorCandidatePocket(phrase), null);
  // Ambiguous alternatives must not be presented as cutting authorization.
  assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "flap_pocket" }), []);
});
