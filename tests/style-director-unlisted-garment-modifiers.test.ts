import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorCandidateWearIssues, styleDirectorWearForCandidate } from "../src/lib/designer/style-director-compatibility.ts";

test("unlisted garment colours and textures cannot bypass finished-wear prohibitions", () => {
  const cases = [
    ["must not wear the olive herringbone bamboo shirt tucked", "untucked"],
    ["should not wear those burgundy jacquard shirts untucked", "tucked"],
    ["cannot wear my mauve slub dobby garment tucked", "untucked"],
    ["must not wear the ochre geometric handloom shirt untucked", "tucked"],
  ] as const;
  for (const [instruction, allowed] of cases) {
    const accepted = Object.freeze({ wear: allowed });
    const denied = Object.freeze({ wear: allowed === "tucked" ? "untucked" : "tucked" });
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, accepted), [], instruction);
    const issues = styleDirectorCandidateWearIssues(instruction, denied);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], instruction);
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, denied), issues);
    assert.equal(denied.wear, allowed === "tucked" ? "untucked" : "tucked");
  }
});

test("unlisted modifiers preserve negative tuck commands and mixed intent requires review", () => {
  const instruction = "do not tuck the ochre geometric handloom shirt";
  assert.deepEqual(styleDirectorCandidateWearIssues(instruction, { wear: "untucked" }), []);
  assert.deepEqual(styleDirectorCandidateWearIssues(instruction, { wear: "tucked" }).map(x => x.code), ["candidate_shirt_wear_mismatch"]);
  const conflicting = "must not wear the olive herringbone bamboo shirt tucked; must not wear the mauve slub dobby garment untucked";
  for (const wear of ["tucked", "untucked"] as const) {
    assert.deepEqual(styleDirectorCandidateWearIssues(conflicting, { wear }).map(x => x.code), ["candidate_shirt_wear_mismatch"]);
  }
  assert.equal(styleDirectorWearForCandidate("Casual", "must not wear the olive herringbone bamboo shirt tucked", "Tucked"), "Untucked");
});
