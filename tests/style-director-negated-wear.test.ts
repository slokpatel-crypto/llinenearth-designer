import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateWearIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorWearForCandidate,
} from "../src/lib/designer/style-director-compatibility.ts";

const issues = (name: string, wear: "tucked" | "untucked") =>
  styleDirectorCandidateWearIssues(name, { wear }).map(issue => issue.code);
const wording = (name: string) =>
  styleDirectorCandidateWordingIssues(name).map(issue => issue.code);

test("No/Without Untucked means tucked, not a request to wear untucked", () => {
  for (const name of [
    "No Untucked Shirt",
    "Without Untucked Shirt",
    "Without Being Untucked",
    "No Untucked Shirt; optional tucked",
  ]) {
    assert.equal(styleDirectorWearForCandidate("Casual", name, "Untucked"), "Tucked", name);
    assert.deepEqual(issues(name, "tucked"), [], name);
    assert.deepEqual(issues(name, "untucked"), ["candidate_shirt_wear_mismatch"], name);
    assert.deepEqual(wording(name), [], name);
  }
});

test("No/Without Tucked and Without Tucking mean untucked", () => {
  for (const name of [
    "No Tucked Shirt",
    "Without Tucked Shirt",
    "Without Being Tucked Shirt",
    "Without Tucking",
    "Without The Tuck",
  ]) {
    assert.equal(styleDirectorWearForCandidate("Casual", name, "Tucked"), "Untucked", name);
    assert.deepEqual(issues(name, "untucked"), [], name);
    assert.deepEqual(issues(name, "tucked"), ["candidate_shirt_wear_mismatch"], name);
    assert.deepEqual(wording(name), [], name);
  }
});

test("no-tuck constraints coexist with an affirmative matching direction", () => {
  for (const [name, expected] of [
    ["No Untucked Shirt; Tucked Dress Shirt", "tucked"],
    ["No Tucked Shirt; Untucked Oxford Shirt", "untucked"],
    ["Without Tucking; Untucked Resort Shirt", "untucked"],
  ] as const) {
    assert.deepEqual(wording(name), [], name);
    assert.deepEqual(issues(name, expected), [], name);
  }
});

test("a negated wear direction plus its opposite affirmative stays review-only", () => {
  for (const name of [
    "No Untucked Shirt; Untucked Oxford Shirt",
    "Without Being Tucked; Tucked Shirt",
  ]) {
    assert.deepEqual(wording(name), ["ambiguous_candidate_wear"], name);
    const locked = { wear: "tucked" as const };
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateWearIssues(name, locked).map(x => x.code),
      ["candidate_shirt_wear_mismatch"], name);
    assert.equal(JSON.stringify(locked), before, "review cannot rewrite locked wear");
  }
});

test("ordinary affirmative wear and existing not/do-not instructions retain original meaning", () => {
  for (const [name, expected] of [
    ["Tucked Shirt", "tucked"],
    ["Untucked Shirt", "untucked"],
    ["Not Untucked Shirt", "tucked"],
    ["Do Not Tuck Shirt", "untucked"],
    ["No Tuck Shirt", "untucked"],
  ] as const) {
    assert.deepEqual(wording(name), [], name);
    assert.deepEqual(issues(name, expected), [], name);
    assert.equal(styleDirectorWearForCandidate("Casual", name,
      expected === "tucked" ? "Untucked" : "Tucked"),
      expected === "tucked" ? "Tucked" : "Untucked", name);
  }
});
