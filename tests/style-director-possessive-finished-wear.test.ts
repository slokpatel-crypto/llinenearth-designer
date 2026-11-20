import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues, styleDirectorWearForCandidate } from "../src/lib/designer/style-director-compatibility.ts";

test("possessive finished-wear prohibitions preserve the locked opposite state", () => {
  for (const determiner of ["my", "your", "his", "her", "our", "their", "this", "that"]) {
    for (const [forbidden, permitted] of [["tucked", "untucked"], ["untucked", "tucked"]] as const) {
      const candidate = `must not wear ${determiner} shirt ${forbidden}`;
      const approved = Object.freeze({ wear: permitted });
      const rejected = Object.freeze({ wear: forbidden });
      assert.deepEqual(styleDirectorCandidateWearIssues(candidate, approved), [], candidate);
      assert.deepEqual(
        styleDirectorCandidateWearIssues(candidate, rejected).map(issue => issue.code),
        ["candidate_shirt_wear_mismatch"], candidate,
      );
      assert.equal(styleDirectorWearForCandidate("Casual", candidate, "Tucked"),
        permitted === "tucked" ? "Tucked" : "Untucked");
      assert.equal(rejected.wear, forbidden);
    }
  }
});

test("possessive prohibitions remain contradictory with explicit forbidden wear", () => {
  for (const state of ["tucked", "untucked"] as const) {
    const candidate = `must not wear my shirt ${state}; wear ${state}`;
    for (const wear of ["tucked", "untucked"] as const) {
      const locked = Object.freeze({ wear });
      assert.deepEqual(styleDirectorCandidateWearIssues(candidate, locked).map(issue => issue.code),
        ["candidate_shirt_wear_mismatch"]);
    }
  }
});
