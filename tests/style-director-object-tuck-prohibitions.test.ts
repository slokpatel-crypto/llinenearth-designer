import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues, styleDirectorWearForCandidate } from "../src/lib/designer/style-director-compatibility.ts";

test("object-bearing tuck prohibitions enforce the opposite locked wear", () => {
  const cases = [
    ["do not tuck the shirt", "untucked"],
    ["mustn't tuck a garment", "untucked"],
    ["cannot tuck any shirt", "untucked"],
    ["do not untuck the shirt", "tucked"],
    ["should not untuck a garment", "tucked"],
    ["DON'T UNTUCK THE SHIRT!", "tucked"],
  ] as const;
  for (const [candidate, allowed] of cases) {
    const other = allowed === "tucked" ? "untucked" : "tucked";
    const accepted = Object.freeze({ wear: allowed });
    const rejected = Object.freeze({ wear: other });
    assert.deepEqual(styleDirectorCandidateWearIssues(candidate, accepted), [], candidate);
    const first = styleDirectorCandidateWearIssues(candidate, rejected);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], candidate);
    assert.deepEqual(styleDirectorCandidateWearIssues(candidate, rejected), first);
    assert.equal(rejected.wear, other);
    assert.equal(styleDirectorWearForCandidate("Casual", candidate, "Tucked"),
      allowed === "tucked" ? "Tucked" : "Untucked");
  }
});

test("object-bearing prohibition plus opposite affirmative remains review-only", () => {
  for (const candidate of ["do not tuck the shirt; wear tucked", "do not untuck the garment; wear untucked"]) {
    for (const wear of ["tucked", "untucked"] as const) {
      assert.deepEqual(styleDirectorCandidateWearIssues(candidate, Object.freeze({ wear })).map(x => x.code),
        ["candidate_shirt_wear_mismatch"]);
    }
  }
});
