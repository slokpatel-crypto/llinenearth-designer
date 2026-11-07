import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

// A tentative wear preference is not permission to rewrite a locked cutting instruction.
test("optional tuck language remains neutral while an independent firm tuck is checked", () => {
  const tucked = Object.freeze({ wear: "tucked" as const });
  const untucked = Object.freeze({ wear: "untucked" as const });
  for (const phrase of [
    "maybe tucked",
    "optional untucked",
    "tucked is optional",
    "untucked not required",
  ]) {
    assert.deepEqual(styleDirectorCandidateWearIssues(phrase, tucked), [], phrase);
    assert.deepEqual(styleDirectorCandidateWearIssues(phrase, untucked), [], phrase);
  }
  assert.deepEqual(styleDirectorCandidateWearIssues("tucked shirt", tucked), []);
  assert.equal(styleDirectorCandidateWearIssues("tucked shirt", untucked)[0]?.code,
    "candidate_shirt_wear_mismatch");
  assert.deepEqual(styleDirectorCandidateWearIssues("untucked shirt", untucked), []);
  assert.equal(styleDirectorCandidateWearIssues("untucked shirt", tucked)[0]?.code,
    "candidate_shirt_wear_mismatch");
  assert.equal(tucked.wear, "tucked");
  assert.equal(untucked.wear, "untucked");
});
