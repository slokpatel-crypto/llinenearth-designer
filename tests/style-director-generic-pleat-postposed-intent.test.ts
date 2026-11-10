import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateFrontConstructionIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const issues = (label: string, id: string) =>
  styleDirectorCandidateFrontConstructionIssues(
    label, Object.freeze({ pleat: id }),
  ).map(issue => issue.code);

test("unwanted unqualified pleats request a flat front, never a positive pleat", () => {
  for (const label of [
    "pleats are not wanted",
    "pleats aren't wanted",
    "pleats aren’t wanted",
    "pleats are unwanted",
    "pleats should not be selected",
    "pleats must not be used",
    "pleating isn't wanted",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), "flat_front", label);
    assert.deepEqual(issues(label, "flat_front"), [], label);
    for (const saved of ["single_pleat_forward", "double_pleat_reverse"]) {
      const result = issues(label, saved);
      assert.deepEqual(result, ["candidate_trouser_pleat_mismatch"], label);
      assert.deepEqual(issues(label, saved), result, "deterministic replay");
    }
    assert.deepEqual(styleDirectorCandidateWordingIssues("", label), [], label);
  }
});

test("neutral optional general pleats never force flat-front or pleated construction", () => {
  for (const label of [
    "pleats are not required",
    "pleats aren't required",
    "pleats aren’t needed",
    "pleats aren't mandatory",
    "pleating isn't needed",
    "pleats optional",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), null, label);
    assert.deepEqual(issues(label, "flat_front"), [], label);
    assert.deepEqual(issues(label, "single_pleat_forward"), [], label);
    assert.deepEqual(issues(label, "double_pleat_reverse"), [], label);
  }
});

test("positive pleats remain requirements and contradictory general bans demand review", () => {
  assert.equal(styleDirectorCandidateTrouserFront("pleats required"), "pleated");
  assert.deepEqual(issues("pleats required", "flat_front"),
    ["candidate_trouser_pleat_mismatch"]);
  assert.deepEqual(issues("pleats required", "single_pleat_forward"), []);

  const conflicting = "pleats aren't wanted; double pleats required";
  assert.equal(styleDirectorCandidateTrouserFront(conflicting), "ambiguous");
  assert.deepEqual(styleDirectorCandidateWordingIssues("", conflicting)
    .map(issue => issue.code), ["ambiguous_candidate_trouser_front"]);
});

test("general optional wording preserves separate explicit count instructions and locked IDs", () => {
  const candidate = "pleats aren't needed; double pleats required";
  assert.equal(styleDirectorCandidateTrouserFront(candidate), "pleated");
  const locked = Object.freeze({ pleat: "double_pleat_reverse" });
  const before = JSON.stringify(locked);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, locked), []);
  assert.deepEqual(issues(candidate, "single_pleat_forward"),
    ["candidate_trouser_pleat_mismatch"]);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, locked), []);
  assert.equal(JSON.stringify(locked), before, "review must never alter the saved pleat ID");
  assert.equal(styleDirectorCandidateTrouserFront("no double pleats"), null,
    "prohibiting one pleat count must not prohibit every pleat");
});
