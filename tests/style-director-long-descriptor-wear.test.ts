import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues, styleDirectorWearForCandidate } from "../src/lib/designer/style-director-compatibility.ts";

// Four or more recognized fabric/style adjectives must not turn an explicit
// negative instruction into a neutral or affirmative wear request.
test("layered garment descriptions retain finished-wear and action prohibitions", () => {
  const cases = [
    ["do not wear the blue striped linen formal shirt tucked", "untucked"],
    ["must not wear the blue striped linen formal cotton shirt untucked", "tucked"],
    ["cannot tuck the blue striped linen formal cotton shirt", "untucked"],
    ["should not untuck the blue striped linen formal cotton shirt", "tucked"],
  ] as const;
  for (const [candidate, allowed] of cases) {
    const forbidden = allowed === "tucked" ? "untucked" : "tucked";
    const accepted = Object.freeze({ wear: allowed });
    const rejected = Object.freeze({ wear: forbidden });
    assert.deepEqual(styleDirectorCandidateWearIssues(candidate, accepted), [], candidate);
    const issues = styleDirectorCandidateWearIssues(candidate, rejected);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], candidate);
    assert.deepEqual(styleDirectorCandidateWearIssues(candidate, rejected), issues);
    assert.equal(rejected.wear, forbidden);
    assert.equal(styleDirectorWearForCandidate("Casual", candidate, "Tucked"),
      allowed === "tucked" ? "Tucked" : "Untucked");
  }
});

test("long descriptions with contradictory wear requests still require review", () => {
  const candidate = "do not wear the blue striped linen formal shirt tucked; wear tucked";
  for (const wear of ["tucked", "untucked"] as const) {
    assert.deepEqual(styleDirectorCandidateWearIssues(candidate, Object.freeze({ wear })).map(issue => issue.code),
      ["candidate_shirt_wear_mismatch"]);
  }
});
