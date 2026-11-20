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

test("postposed tucked-wear refusals require untucked wear without rewriting locked IDs", () => {
  for (const label of [
    "Tucked shirt isn't wanted",
    "Tucked shirts aren’t wanted",
    "Tucked is not wanted",
    "Tucked shirt unwanted",
    "Tucked should not be worn",
  ]) {
    const saved = Object.freeze({ wear: "tucked" as const });
    const before = JSON.stringify(saved);
    assert.deepEqual(wearIssues(label, "tucked"), ["candidate_shirt_wear_mismatch"], label);
    assert.deepEqual(wearIssues(label, "untucked"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
    assert.equal(styleDirectorWearForCandidate("Formal", label, "Tucked"), "Untucked", label);
    assert.equal(JSON.stringify(saved), before);
  }
});

test("postposed untucked-wear refusals require tucked wear without false positives", () => {
  for (const label of [
    "Untucked shirt isn't wanted",
    "Untucked shirts aren’t wanted",
    "Untucked is not allowed",
    "Untucked shirts prohibited",
    "Untucked should not be worn",
  ]) {
    assert.deepEqual(wearIssues(label, "untucked"), ["candidate_shirt_wear_mismatch"], label);
    assert.deepEqual(wearIssues(label, "tucked"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
    assert.equal(styleDirectorWearForCandidate("Casual", label, "Untucked"), "Tucked", label);
  }
  const contradiction = "Tucked shirt required; tucked shirt isn't wanted";
  assert.deepEqual(wordingIssues(contradiction), ["ambiguous_candidate_wear"]);
  assert.deepEqual(wearIssues(contradiction, "tucked"), ["candidate_shirt_wear_mismatch"]);
  assert.deepEqual(wearIssues(contradiction, "untucked"), ["candidate_shirt_wear_mismatch"]);
});

test("postposed optional tucked and untucked garment states remain neutral", () => {
  for (const label of [
    "Tucked shirt isn't needed",
    "Tucked shirts aren’t mandatory",
    "Tucked shirt not required",
    "Untucked shirt isn't required",
    "Untucked shirts aren't necessary",
    "Untucked shirt optional",
  ]) {
    assert.deepEqual(wearIssues(label, "tucked"), [], label);
    assert.deepEqual(wearIssues(label, "untucked"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
  const selected = "Tucked shirt isn't required; untucked shirt";
  assert.deepEqual(wearIssues(selected, "untucked"), []);
  assert.deepEqual(wearIssues(selected, "tucked"), ["candidate_shirt_wear_mismatch"]);
  assert.deepEqual(wordingIssues(selected), []);
});
