import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

test("layered garment qualifiers do not erase explicit tuck prohibitions", () => {
  const cases = [
    ["do not tuck the blue striped linen shirt", "untucked"],
    ["must not tuck my white formal cotton shirt", "untucked"],
    ["must not untuck the black checked dress shirt", "tucked"],
    ["should not wear this blue striped shirt tucked", "untucked"],
    ["cannot wear those white cotton shirts untucked", "tucked"],
  ] as const;
  for (const [instruction, allowed] of cases) {
    const locked = Object.freeze({ wear: allowed });
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, locked), [], instruction);
    const forbidden = Object.freeze({ wear: allowed === "tucked" ? "untucked" : "tucked" });
    const first = styleDirectorCandidateWearIssues(instruction, forbidden);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], instruction);
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, forbidden), first);
    assert.equal(locked.wear, allowed);
  }
});

test("opposed layered garment prohibitions require review for either lock", () => {
  const instruction = "do not tuck the blue striped shirt but do not untuck the white cotton shirt";
  for (const wear of ["tucked", "untucked"] as const) {
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, { wear }).map(issue => issue.code),
      ["candidate_shirt_wear_mismatch"]);
  }
});
