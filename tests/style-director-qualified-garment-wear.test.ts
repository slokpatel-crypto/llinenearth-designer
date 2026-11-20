import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

test("qualified garment tuck prohibitions preserve the opposite locked wear state", () => {
  const cases = [
    ["do not tuck the linen shirt", "untucked"],
    ["must not tuck my dress shirt", "untucked"],
    ["do not wear the formal shirt tucked", "untucked"],
    ["must not untuck the cotton garment", "tucked"],
    ["should not wear this casual shirt untucked", "tucked"],
  ] as const;
  for (const [instruction, allowed] of cases) {
    const selected = { wear: allowed };
    const original = JSON.stringify(selected);
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, selected), [], instruction);
    const disallowed = { wear: allowed === "tucked" ? "untucked" : "tucked" };
    const first = styleDirectorCandidateWearIssues(instruction, disallowed);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], instruction);
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, disallowed), first);
    assert.equal(JSON.stringify(selected), original);
  }
});

test("opposing qualified garment commands require review without rewriting a lock", () => {
  const instruction = "do not tuck the linen shirt, but do not untuck the dress shirt";
  for (const wear of ["tucked", "untucked"] as const) {
    const locked = { wear };
    const original = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, locked).map(issue => issue.code),
      ["candidate_shirt_wear_mismatch"]);
    assert.equal(JSON.stringify(locked), original);
  }
});
