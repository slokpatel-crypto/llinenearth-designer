import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateFrontConstructionIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const codes = (wording: string, pleat: string) =>
  styleDirectorCandidateFrontConstructionIssues(wording, { pleat }).map(issue => issue.code);

test("preposed do-not-select and contracted prohibitions constrain only named pleat counts", () => {
  for (const [negative, allowed, forbidden] of [
    ["Do not select double pleats", "single_pleat_forward", "double_pleat_forward"],
    ["Don't select double pleats", "single_pleat_reverse", "double_pleat_reverse"],
    ["Shouldn't select single pleats", "double_pleat_reverse", "single_pleat_reverse"],
    ["Shouldn’t select double pleats", "single_pleat_forward", "double_pleat_forward"],
    ["Mustn't use two pleats", "single_pleat_reverse", "double_pleat_reverse"],
    ["Mustn’t choose one pleat", "double_pleat_forward", "single_pleat_forward"],
  ] as const) {
    for (const wording of [negative, negative + "; pleated trousers"]) {
      assert.equal(styleDirectorCandidateTrouserFront(wording),
        wording === negative ? null : "pleated", wording);
      assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording), [], wording);
      assert.deepEqual(codes(wording, allowed), [], "independent safe alternative: " + wording);
      const locked = Object.freeze({ pleat: forbidden });
      const original = JSON.stringify(locked);
      const first = styleDirectorCandidateFrontConstructionIssues(wording, locked);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, locked), first);
      assert.equal(JSON.stringify(locked), original, "never rewrite the locked pleat ID");
      assert.deepEqual(codes(wording, "retired_pleat_count"), ["candidate_trouser_pleat_mismatch"],
        "unknown saved pleat cannot certify a ban");
    }
  }
});

test("preposed do-not-select and contracted prohibitions constrain named pleat directions", () => {
  for (const [negative, allowed, forbidden] of [
    ["Do not select reverse pleats", "single_pleat_forward", "single_pleat_reverse"],
    ["Don’t select forward pleats", "double_pleat_reverse", "double_pleat_forward"],
    ["Shouldn't select forward pleats", "single_pleat_reverse", "single_pleat_forward"],
    ["Shouldn’t select reverse pleats", "double_pleat_forward", "double_pleat_reverse"],
    ["Mustn't use reverse pleats", "single_pleat_forward", "single_pleat_reverse"],
    ["Mustn’t select forward pleats", "double_pleat_reverse", "double_pleat_forward"],
  ] as const) {
    for (const wording of [negative, negative + "; pleated trousers"]) {
      assert.equal(styleDirectorCandidateTrouserFront(wording),
        wording === negative ? null : "pleated", wording);
      assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording), [], wording);
      assert.deepEqual(codes(wording, allowed), [], wording);
      const locked = Object.freeze({ pleat: forbidden });
      const first = styleDirectorCandidateFrontConstructionIssues(wording, locked);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, locked), first);
      assert.equal(locked.pleat, forbidden);
      assert.deepEqual(codes(wording, "retired_pleat_direction"),
        ["candidate_trouser_pleat_mismatch"], wording);
    }
  }
});

test("generic no-pleat requests stay flat-front and positive instructions stay positive", () => {
  for (const negative of [
    "Do not select pleats",
    "Shouldn't select pleats",
    "Shouldn’t select pleats",
    "Mustn't use pleats",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(negative), "flat_front", negative);
    assert.deepEqual(codes(negative, "flat_front"), [], negative);
    assert.deepEqual(codes(negative, "single_pleat_forward"),
      ["candidate_trouser_pleat_mismatch"], negative);
  }
  for (const positive of [
    "Select double pleats", "Should select single pleats",
    "Select reverse pleats", "Choose forward pleats",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(positive), "pleated", positive);
  }
  for (const optional of [
    "Double pleats are optional", "Reverse pleats aren't required",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(optional), null, optional);
  }
  assert.deepEqual(codes(
    "Shouldn't select double pleats; single pleat required", "single_pleat_forward",
  ), [], "a distinct requested count is still allowed");
  assert.deepEqual(codes(
    "Shouldn't select reverse pleats; forward pleats required", "single_pleat_forward",
  ), [], "a distinct requested direction is still allowed");
  assert.deepEqual(codes(
    "Shouldn't select double pleats; double pleats required", "double_pleat_forward",
  ), ["candidate_trouser_pleat_mismatch"], "contradictory count cannot be certified");
  assert.deepEqual(codes(
    "Shouldn't select reverse pleats; reverse pleats required", "single_pleat_reverse",
  ), ["candidate_trouser_pleat_mismatch"], "contradictory direction cannot be certified");
});
