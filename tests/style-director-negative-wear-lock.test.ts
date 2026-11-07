import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

// Negative construction language must not become a positive request merely
// because the word "tucked" or "untucked" appears in the candidate description.
test("negative wear instructions enforce the opposite locked option", () => {
  for (const [wording, allowed, rejected] of [
    ["never tucked", "untucked", "tucked"],
    ["without being tucked", "untucked", "tucked"],
    ["do not be being tucked", "untucked", "tucked"],
    ["do not be being untucked", "tucked", "untucked"],
    ["do not tuck", "untucked", "tucked"],
    ["must not tuck", "untucked", "tucked"],
    ["should not tuck", "untucked", "tucked"],
    ["shall not tuck", "untucked", "tucked"],
    ["must not tuck, but wear untucked", "untucked", "tucked"],
    ["with or without tucked, but must not tuck", "untucked", "tucked"],
    ["never untucked", "tucked", "untucked"],
    ["without being untucked", "tucked", "untucked"],
    ["with or without being tucked, but do not be being untucked", "tucked", "untucked"],
    ["with or without being untucked, but do not be being tucked", "untucked", "tucked"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, Object.freeze({ wear: allowed })), [], wording);
    const issues = styleDirectorCandidateWearIssues(wording, Object.freeze({ wear: rejected }));
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, Object.freeze({ wear: rejected })), issues);
  }
});

test("negative wear instructions cannot be satisfied by inherited or accessor-backed data", () => {
  let reads = 0;
  const accessor = Object.defineProperty({}, "wear", {
    enumerable: true,
    get() { reads += 1; throw new Error("untrusted accessor"); },
  });
  for (const wording of ["never tucked", "never untucked", "do not tuck"]) {
    for (const saved of [accessor, Object.create({ wear: "untucked" }), Object.freeze({ wear: "unknown" })]) {
      assert.deepEqual(
        styleDirectorCandidateWearIssues(wording, saved).map(issue => issue.code),
        ["candidate_shirt_wear_mismatch"],
        wording,
      );
    }
  }
  assert.equal(reads, 0);
});
