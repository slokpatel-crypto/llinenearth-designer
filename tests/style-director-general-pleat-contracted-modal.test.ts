import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateFrontConstructionIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const issueCodes = (wording: string, pleat: string) =>
  styleDirectorCandidateFrontConstructionIssues(wording, { pleat }).map(issue => issue.code);

test("generic contracted postposed pleat bans require a flat front, never positive pleats", () => {
  for (const wording of [
    "Pleats shouldn't be selected",
    "Pleats mustn't be used",
    "Pleating shouldn’t be included",
    "Pleats mustn’t be added",
    "Pleats should not be selected",
    "Pleats can't be used",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording), [], wording);
    const locked = Object.freeze({ pleat: "single_pleat_forward" });
    const before = JSON.stringify(locked);
    const mismatch = styleDirectorCandidateFrontConstructionIssues(wording, locked);
    assert.deepEqual(mismatch.map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, locked), mismatch,
      "repeated frozen checks must be deterministic");
    assert.equal(JSON.stringify(locked), before, "review must not alter saved garment option IDs");
    assert.deepEqual(issueCodes(wording, "flat_front"), [], wording);
    assert.deepEqual(issueCodes(wording, "double_pleat_reverse"),
      ["candidate_trouser_pleat_mismatch"], wording);
    assert.deepEqual(issueCodes(wording, "unknown_pleat"),
      ["candidate_trouser_pleat_mismatch"], "unknown locked pleat cannot certify compliance");
    assert.equal(styleDirectorCandidateTrouserFront("Flat-front trousers; " + wording),
      "flat_front", "matching construction remains non-ambiguous");
  }
});

test("positive and optional pleat wording stays independent of explicit bans", () => {
  for (const wording of [
    "Pleats should be selected",
    "Pleats must be used",
    "Pleating should be included",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "pleated", wording);
  }
  for (const wording of [
    "Pleats are optional",
    "Pleats aren't required",
    "Pleating isn't mandatory",
    "Pleats may be added",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(issueCodes(wording, "flat_front"), [], wording);
    assert.deepEqual(issueCodes(wording, "single_pleat_forward"), [], wording);
  }
  for (const wording of [
    "Pleats shouldn't be selected; single pleat required",
    "Pleats mustn’t be used; double pleats required",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "ambiguous", wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording)
      .map(issue => issue.code), ["ambiguous_candidate_trouser_front"], wording);
  }
});
