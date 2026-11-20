import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

test("explicit do-not-be wear instructions are negative, not affirmative", () => {
  for (const [instruction, allowed, rejected] of [
    ["do not be tucked", "untucked", "tucked"],
    ["don't be tucked", "untucked", "tucked"],
    ["do not be untucked", "tucked", "untucked"],
    ["don't be untucked", "tucked", "untucked"],
    ["do not be being tucked", "untucked", "tucked"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, { wear: allowed }), [], instruction);
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, { wear: rejected }).map(x => x.code),
      ["candidate_shirt_wear_mismatch"], instruction);
  }
});

test("optional clause does not cancel later do-not-be construction prohibition", () => {
  for (const [mandatory, allowed, rejected] of [
    ["do not be tucked", "untucked", "tucked"],
    ["do not be untucked", "tucked", "untucked"],
  ] as const) {
    const text = "with or without being tucked; " + mandatory;
    assert.deepEqual(styleDirectorCandidateWearIssues(text, { wear: allowed }), []);
    assert.deepEqual(styleDirectorCandidateWearIssues(text, { wear: rejected }).map(x => x.code),
      ["candidate_shirt_wear_mismatch"]);
  }
});
