import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateFrontConstructionIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const codes = (wording: string, pleat: string) =>
  styleDirectorCandidateFrontConstructionIssues(wording, { pleat }).map(issue => issue.code);

test("contracted postposed pleat-count refusals cannot approve a forbidden count", () => {
  for (const [wording, allowed, forbidden] of [
    ["Double pleats shouldn't be selected", "single_pleat_forward", "double_pleat_forward"],
    ["Single pleats mustn't be used", "double_pleat_reverse", "single_pleat_reverse"],
    ["Double pleats shouldn’t be chosen", "single_pleat_reverse", "double_pleat_reverse"],
    ["Single pleats mustn’t be included", "double_pleat_forward", "single_pleat_forward"],
  ] as const) {
    for (const candidate of [wording, wording + "; pleated trousers"]) {
      const front = candidate === wording ? null : "pleated";
      assert.equal(styleDirectorCandidateTrouserFront(candidate), front, candidate);
      assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", candidate), [], candidate);
      assert.deepEqual(codes(candidate, allowed), [], candidate);
      const saved = Object.freeze({ pleat: forbidden });
      const before = JSON.stringify(saved);
      const first = styleDirectorCandidateFrontConstructionIssues(candidate, saved);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], candidate);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, saved), first);
      assert.equal(JSON.stringify(saved), before, "must not rewrite the saved pleat count");
      assert.deepEqual(codes(candidate, "unknown_pleat_id"),
        ["candidate_trouser_pleat_mismatch"], "untrusted versioned selection must never pass");
    }
  }
});

test("contracted postposed pleat-direction bans preserve the opposite direction", () => {
  for (const [wording, allowed, forbidden] of [
    ["Forward pleats shouldn't be selected", "single_pleat_reverse", "single_pleat_forward"],
    ["Reverse pleats mustn't be used", "double_pleat_forward", "double_pleat_reverse"],
    ["Forward pleats shouldn’t be chosen", "double_pleat_reverse", "double_pleat_forward"],
    ["Reverse pleats mustn’t be included", "single_pleat_forward", "single_pleat_reverse"],
  ] as const) {
    for (const candidate of [wording, wording + "; pleated trousers"]) {
      assert.equal(styleDirectorCandidateTrouserFront(candidate),
        candidate === wording ? null : "pleated", candidate);
      assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", candidate), [], candidate);
      assert.deepEqual(codes(candidate, allowed), [], candidate);
      const locked = Object.freeze({ pleat: forbidden });
      const first = styleDirectorCandidateFrontConstructionIssues(candidate, locked);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], candidate);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, locked), first);
      assert.equal(locked.pleat, forbidden);
      assert.deepEqual(codes(candidate, "unknown_pleat_id"),
        ["candidate_trouser_pleat_mismatch"], candidate);
    }
  }
});

test("postposed modal bans remain distinct from positive and optional pleat requirements", () => {
  for (const positive of [
    "Double pleats should be selected",
    "Single pleats must be used",
    "Forward pleats should be selected",
    "Reverse pleats must be used",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(positive), "pleated", positive);
  }
  for (const optional of [
    "Double pleats aren't required", "Single pleats are optional",
    "Forward pleats aren't needed", "Reverse pleats are optional",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(optional), null, optional);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", optional), [], optional);
  }
  const countContradiction = "Double pleats shouldn't be selected; double pleats required";
  const directionContradiction = "Reverse pleats mustn't be used; reverse pleats required";
  assert.deepEqual(codes(countContradiction, "double_pleat_forward"), ["candidate_trouser_pleat_mismatch"]);
  assert.deepEqual(codes(directionContradiction, "single_pleat_reverse"), ["candidate_trouser_pleat_mismatch"]);
  assert.deepEqual(codes("Double pleats shouldn't be selected; single pleat required",
    "single_pleat_forward"), [], "independent allowed count stays valid");
  assert.deepEqual(codes("Reverse pleats mustn't be used; forward pleats required",
    "single_pleat_forward"), [], "independent allowed direction stays valid");
});
