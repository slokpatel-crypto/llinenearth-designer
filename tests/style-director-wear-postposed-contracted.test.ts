import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateWearIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorWearForCandidate,
} from "../src/lib/designer/style-director-compatibility.ts";

const codes = (wording: string, wear: string) =>
  styleDirectorCandidateWearIssues(wording, { wear }).map(issue => issue.code);

test("postposed contracted tucked refusals resolve to untucked, never forbidden locked wear", () => {
  for (const wording of [
    "Tucked shouldn't be worn",
    "Tucked shouldn't be selected",
    "Tucked shouldn’t be used",
    "Tucked mustn’t be chosen",
    "Tucked shirt mustn't be worn",
    "Tucked should not be worn",
  ]) {
    assert.equal(styleDirectorWearForCandidate("Smart-Casual", wording, "Tucked"),
      "Untucked", wording);
    const locked = Object.freeze({ wear: "tucked" });
    const before = JSON.stringify(locked);
    const mismatch = styleDirectorCandidateWearIssues(wording, locked);
    assert.deepEqual(mismatch.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, locked), mismatch, wording);
    assert.equal(JSON.stringify(locked), before);
    assert.deepEqual(codes(wording, "untucked"), [], wording);
    assert.deepEqual(codes(wording, "obsolete_wear_id"),
      ["candidate_shirt_wear_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), [], wording);
  }
});

test("postposed contracted untucked refusals resolve to tucked, never forbidden locked wear", () => {
  for (const wording of [
    "Untucked shouldn't be worn",
    "Untucked mustn't be selected",
    "Untucked shouldn’t be used",
    "Untucked mustn’t be chosen",
    "Untucked shirts shouldn't be worn",
    "Untucked should not be worn",
  ]) {
    assert.equal(styleDirectorWearForCandidate("Smart-Casual", wording, "Untucked"),
      "Tucked", wording);
    const locked = Object.freeze({ wear: "untucked" });
    const before = JSON.stringify(locked);
    const mismatch = styleDirectorCandidateWearIssues(wording, locked);
    assert.deepEqual(mismatch.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, locked), mismatch, wording);
    assert.equal(JSON.stringify(locked), before);
    assert.deepEqual(codes(wording, "tucked"), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), [], wording);
  }
});

test("positive optional and conflicting postposed wear instructions retain safety semantics", () => {
  for (const [wording, selected] of [
    ["Tucked should be worn", "tucked"],
    ["Untucked must be selected", "untucked"],
  ] as const) {
    assert.deepEqual(codes(wording, selected), [], wording);
    assert.deepEqual(codes(wording, selected === "tucked" ? "untucked" : "tucked"),
      ["candidate_shirt_wear_mismatch"], wording);
  }
  for (const wording of ["Tucked is optional", "Untucked isn't required"]) {
    assert.deepEqual(codes(wording, "tucked"), [], wording);
    assert.deepEqual(codes(wording, "untucked"), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), [], wording);
  }
  for (const wording of [
    "Tucked shouldn't be worn; tucked shirt required",
    "Untucked mustn’t be selected; untucked shirt required",
  ]) {
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording).map(issue => issue.code),
      ["ambiguous_candidate_wear"], wording);
    assert.deepEqual(codes(wording, "tucked"), ["candidate_shirt_wear_mismatch"], wording);
    assert.deepEqual(codes(wording, "untucked"), ["candidate_shirt_wear_mismatch"], wording);
  }
  const agreement = "Tucked shouldn't be worn; untucked shirt required";
  assert.deepEqual(styleDirectorCandidateWordingIssues(agreement), []);
  assert.deepEqual(codes(agreement, "untucked"), []);
  assert.deepEqual(codes(agreement, "tucked"), ["candidate_shirt_wear_mismatch"]);
});
