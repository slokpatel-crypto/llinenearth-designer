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
    ["may not tuck", "untucked", "tucked"],
    ["might not tuck", "untucked", "tucked"],
    ["may not untuck", "tucked", "untucked"],
    ["might not untuck", "tucked", "untucked"],
    ["with or without tucked, but may not tuck", "untucked", "tucked"],
    ["with or without untucked, but might not untuck", "tucked", "untucked"],
    ["should not tuck", "untucked", "tucked"],
    ["shall not tuck", "untucked", "tucked"],
    ["mustn't tuck", "untucked", "tucked"],
    ["shouldn't tuck", "untucked", "tucked"],
    ["shan't tuck", "untucked", "tucked"],
    ["can't tuck", "untucked", "tucked"],
    ["cannot tuck", "untucked", "tucked"],
    ["can not tuck", "untucked", "tucked"],
    ["could not tuck", "untucked", "tucked"],
    ["would not tuck", "untucked", "tucked"],
    ["with or without tucked, but can not tuck", "untucked", "tucked"],
    ["with or without tucked, but cannot tuck", "untucked", "tucked"],
    ["couldn't tuck", "untucked", "tucked"],
    ["wouldn't tuck", "untucked", "tucked"],
    ["must not tuck, but wear untucked", "untucked", "tucked"],
    ["with or without tucked, but must not tuck", "untucked", "tucked"],
    ["must not be tucked", "untucked", "tucked"],
    ["may not be tucked", "untucked", "tucked"],
    ["might not be being tucked", "untucked", "tucked"],
    ["may not be untucked", "tucked", "untucked"],
    ["might not be being untucked", "tucked", "untucked"],
    ["shouldn't be tucked", "untucked", "tucked"],
    ["cannot be being tucked", "untucked", "tucked"],
    ["must not be untucked", "tucked", "untucked"],
    ["can't be untucked", "tucked", "untucked"],
    ["should not be being untucked", "tucked", "untucked"],
    ["do not untuck", "tucked", "untucked"],
    ["must not untuck", "tucked", "untucked"],
    ["shouldn't untuck", "tucked", "untucked"],
    ["cannot untuck", "tucked", "untucked"],
    ["with or without untucked, but do not untuck", "tucked", "untucked"],
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

test("case and sentence punctuation do not weaken mandatory wear prohibitions", () => {
  for (const [wording, permitted, prohibited] of [
    ["MUST NOT TUCK.", "untucked", "tucked"],
    ["Do not untuck!", "tucked", "untucked"],
    ["Shouldn't be tucked.", "untucked", "tucked"],
    ["CAN NOT TUCK; wear untucked.", "untucked", "tucked"],
  ] as const) {
    const locked = Object.freeze({ wear: prohibited });
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, { wear: permitted }), [], wording);
    const result = styleDirectorCandidateWearIssues(wording, locked);
    assert.deepEqual(result.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, locked), result, wording);
    assert.equal(JSON.stringify(locked), before, "review must preserve the locked ID");
  }
});
