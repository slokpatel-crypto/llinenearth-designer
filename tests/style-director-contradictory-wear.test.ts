import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues, styleDirectorWearForCandidate } from "../src/lib/designer/style-director-compatibility.ts";

// A prohibition cannot be overridden by a later affirmative instruction.
// Keep both incompatible instructions visible to the review gate.
test("contradictory negative and affirmative shirt-wear instructions fail closed", () => {
  for (const candidate of [
    "do not tuck, but wear tucked",
    "must not wear untucked; wear untucked",
    "with or without tucked, but do not tuck; wear tucked",
    "do not untuck; wear untucked",
  ]) {
    for (const wear of ["tucked", "untucked"] as const) {
      const locked = Object.freeze({ wear });
      const before = JSON.stringify(locked);
      const first = styleDirectorCandidateWearIssues(candidate, locked);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], candidate);
      assert.deepEqual(styleDirectorCandidateWearIssues(candidate, locked), first);
      assert.equal(JSON.stringify(locked), before);
    }
  }
});

test("contradictory candidate instructions do not replace a proposed wear choice", () => {
  for (const proposed of ["Tucked", "Untucked"] as const) {
    assert.equal(styleDirectorWearForCandidate("Casual", "do not tuck, wear tucked", proposed), proposed);
  }
});
