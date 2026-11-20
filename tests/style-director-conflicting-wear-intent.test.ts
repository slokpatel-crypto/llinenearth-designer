import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

test("contradictory explicit tucked and untucked instructions require review regardless of locked wear", () => {
  for (const wording of [
    "tucked and untucked",
    "never tucked but never untucked",
    "with or without being tucked, but tucked and untucked",
    "do not be being tucked; do not be being untucked",
  ]) {
    for (const wear of ["tucked", "untucked"] as const) {
      const locked = Object.freeze({ wear });
      const first = styleDirectorCandidateWearIssues(wording, locked);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidateWearIssues(wording, locked), first);
      assert.equal(locked.wear, wear);
    }
  }
});

test("optional wear alone remains unconstrained and never reads unsafe locked values", () => {
  let reads = 0;
  const saved = Object.defineProperty({}, "wear", {
    get() { reads++; throw new Error("unsafe saved accessor"); },
  });
  for (const wording of ["with or without being tucked", "optional tucked", "untucked is optional"]) {
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, saved), [], wording);
  }
  assert.equal(reads, 0);
});
