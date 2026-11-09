import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

// These are customer construction instructions, not evidence of physical fit.
// Preserve the versioned locked wear field and require review on conflict.
test("long qualified garment bans are deterministic across singular and plural objects", () => {
  const cases = [
    ["do not tuck the blue striped linen cotton textured formal slim fit shirt", "untucked"],
    ["must not untuck the blue striped linen cotton textured formal slim fit shirts", "tucked"],
    ["do not tuck these blue striped linen cotton textured formal slim fit garments", "untucked"],
    ["must not untuck those blue striped linen cotton textured formal slim fit garments", "tucked"],
  ] as const;
  for (const [instruction, permitted] of cases) {
    const accepted = Object.freeze({ wear: permitted });
    const rejected = Object.freeze({ wear: permitted === "tucked" ? "untucked" : "tucked" });
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, accepted), [], instruction);
    const issues = styleDirectorCandidateWearIssues(instruction, rejected);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], instruction);
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, rejected), issues);
    assert.equal(accepted.wear, permitted);
  }
});

test("conflicting long qualified instructions never approve either locked wear", () => {
  const instruction = "do not tuck the blue striped linen cotton textured formal slim fit shirt; do not untuck those blue striped linen cotton textured formal slim fit garments";
  for (const wear of ["tucked", "untucked"] as const) {
    const locked = Object.freeze({ wear });
    const issues = styleDirectorCandidateWearIssues(instruction, locked);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"]);
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, locked), issues);
    assert.equal(locked.wear, wear);
  }
});
