import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateWearIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorWearForCandidate,
} from "../src/lib/designer/style-director-compatibility.ts";

const wearIssues = (label: string, wear: "tucked" | "untucked") =>
  styleDirectorCandidateWearIssues(label, { wear }).map(issue => issue.code);
const wordingIssues = (label: string) =>
  styleDirectorCandidateWordingIssues(label).map(issue => issue.code);

test("optional tucked wording cannot force a casual proposal to tuck", () => {
  for (const label of ["Optional Tucked Shirt", "Maybe Tucked Dress Shirt",
    "Tucked is optional", "Tucked not required", "Tucked is not mandatory"]) {
    assert.equal(styleDirectorWearForCandidate("Casual", label, "Untucked"),
      "Untucked", label);
    assert.deepEqual(wearIssues(label, "untucked"), [], label);
    assert.deepEqual(wearIssues(label, "tucked"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
});

test("optional untucked wording cannot force a formal proposal outside trousers", () => {
  for (const label of ["Optional Untucked Shirt", "Maybe Untucked Dress Shirt",
    "Untucked is optional", "Untucked not needed", "Untucked not required"]) {
    assert.equal(styleDirectorWearForCandidate("Formal", label, "Tucked"),
      "Tucked", label);
    assert.deepEqual(wearIssues(label, "tucked"), [], label);
    assert.deepEqual(wearIssues(label, "untucked"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
});

test("optional wear does not mask a separately requested tucked or untucked style", () => {
  for (const [label, expected] of [
    ["Optional Tucked Shirt; Untucked Oxford Shirt", "untucked"],
    ["Untucked is optional; Tucked Dress Shirt", "tucked"],
    ["Optional Untucked Shirt; Tucked Dress Shirt", "tucked"],
    ["Tucked not required; Untucked Shirt", "untucked"],
  ] as const) {
    assert.equal(styleDirectorWearForCandidate("Casual", label, "Untucked"),
      expected === "tucked" ? "Tucked" : "Untucked", label);
    assert.deepEqual(wearIssues(label, expected), [], label);
    assert.deepEqual(wearIssues(label, expected === "tucked" ? "untucked" : "tucked"),
      ["candidate_shirt_wear_mismatch"], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
});

test("explicit no-tuck directions retain their meaning alongside optional text", () => {
  for (const [label, expected] of [
    ["Do Not Tuck Shirt; Tucked is optional", "untucked"],
    ["Not Untucked; Untucked is optional", "tucked"],
    ["No Tuck Shirt; Optional Tucked", "untucked"],
  ] as const) {
    assert.deepEqual(wordingIssues(label), [], label);
    assert.deepEqual(wearIssues(label, expected), [], label);
    assert.deepEqual(wearIssues(label, expected === "tucked" ? "untucked" : "tucked"),
      ["candidate_shirt_wear_mismatch"], label);
  }
});

test("two mandatory wear instructions still require review without rewriting the lock", () => {
  for (const label of ["Tucked and Untucked Shirt", "Tucked / Untucked Shirt"]) {
    assert.deepEqual(wordingIssues(label), ["ambiguous_candidate_wear"], label);
    const locked = { wear: "tucked" as const };
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateWearIssues(label, locked).map(x => x.code),
      ["candidate_shirt_wear_mismatch"], label);
    assert.equal(JSON.stringify(locked), before);
  }
});
