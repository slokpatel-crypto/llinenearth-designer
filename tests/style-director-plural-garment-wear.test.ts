import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues, styleDirectorWearForCandidate } from "../src/lib/designer/style-director-compatibility.ts";

test("plural garment-object prohibitions preserve the permitted locked wear", () => {
  const cases = [
    ["must not wear these shirts tucked", "untucked"],
    ["cannot wear those garments untucked", "tucked"],
    ["do not tuck these shirts", "untucked"],
    ["must not untuck those garments", "tucked"],
    ["don't tuck the shirts", "untucked"],
    ["should not untuck my garments", "tucked"],
  ] as const;
  for (const [candidate, permitted] of cases) {
    const forbidden = permitted === "tucked" ? "untucked" : "tucked";
    const accepted = Object.freeze({ wear: permitted });
    const rejected = Object.freeze({ wear: forbidden });
    assert.deepEqual(styleDirectorCandidateWearIssues(candidate, accepted), [], candidate);
    const issues = styleDirectorCandidateWearIssues(candidate, rejected);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], candidate);
    assert.deepEqual(styleDirectorCandidateWearIssues(candidate, rejected), issues, candidate);
    assert.equal(styleDirectorWearForCandidate("Casual", candidate, "Tucked"),
      permitted === "tucked" ? "Tucked" : "Untucked", candidate);
    assert.equal(rejected.wear, forbidden);
  }
});

test("plural prohibition and contrary affirmative instruction require review", () => {
  for (const candidate of [
    "must not wear these shirts tucked; wear tucked",
    "do not untuck those garments; wear untucked",
  ]) {
    for (const wear of ["tucked", "untucked"] as const) {
      const locked = Object.freeze({ wear });
      assert.deepEqual(styleDirectorCandidateWearIssues(candidate, locked).map(issue => issue.code),
        ["candidate_shirt_wear_mismatch"], candidate);
    }
  }
});
