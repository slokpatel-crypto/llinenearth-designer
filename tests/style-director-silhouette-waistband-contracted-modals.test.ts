import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateDrawstringWaistband,
  styleDirectorCandidateWaistbandIssues,
  styleDirectorCandidateWideLeg,
  styleDirectorCandidateWideLegIntent,
  styleDirectorCandidateWideLegIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("contracted wide-leg refusals cannot select or approve a forbidden locked silhouette", () => {
  for (const name of [
    "Wide-leg shouldn't be selected",
    "Wide-leg mustn't be worn",
    "Wide-leg shouldn’t be chosen",
    "Wide-leg mustn’t be used",
    "Wide-leg should not be selected",
  ]) {
    assert.equal(styleDirectorCandidateWideLegIntent(name), "prohibited", name);
    assert.equal(styleDirectorCandidateWideLeg(name), false, name);
    const locked = Object.freeze({ type: "wide_leg_relaxed_drape" });
    const before = JSON.stringify(locked);
    const first = styleDirectorCandidateWideLegIssues(name, locked);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_wide_leg_mismatch"], name);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(name, locked), first, name);
    assert.equal(JSON.stringify(locked), before, "locked trouser type must not change");
    assert.deepEqual(styleDirectorCandidateWideLegIssues(name, { type: "formal_flat_front" }), [], name);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", name), [], name);
  }
  assert.deepEqual(styleDirectorCandidateWideLegIssues(
    "Wide-leg shouldn't be selected", { type: "not_a_type" },
  ).map(issue => issue.code), ["candidate_wide_leg_mismatch"]);
});

test("contracted drawstring refusals cannot select or approve a forbidden waistband", () => {
  for (const name of [
    "Drawstring shouldn't be selected",
    "Drawstring mustn't be used",
    "Drawstring shouldn’t be added",
    "Drawstring mustn’t be included",
    "Drawstring should not be selected",
  ]) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(name), "prohibited", name);
    const locked = Object.freeze({ waistband: "drawstring_elastic" });
    const before = JSON.stringify(locked);
    const first = styleDirectorCandidateWaistbandIssues(name, locked);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_waistband_mismatch"], name);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(name, locked), first, name);
    assert.equal(JSON.stringify(locked), before, "locked waistband ID must not change");
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(name, { waistband: "belt_loops" }), [], name);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", name), [], name);
  }
  assert.deepEqual(styleDirectorCandidateWaistbandIssues(
    "Drawstring shouldn't be selected", { waistband: "not_a_waistband" },
  ).map(issue => issue.code), ["candidate_waistband_mismatch"]);
});

test("affirmative, optional, and contradictory wording stays distinct for both construction axes", () => {
  for (const [wording, expected] of [
    ["Wide-leg should be selected", "requested"],
    ["Wide-leg shouldn't be selected", "prohibited"],
    ["Wide-leg isn't required", null],
    ["Wide-leg is optional", null],
    ["Wide-leg shouldn't be selected; wide-leg trousers required", "ambiguous"],
  ] as const) {
    assert.equal(styleDirectorCandidateWideLegIntent(wording), expected, wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", wording).map(issue => issue.code),
      expected === "ambiguous" ? ["ambiguous_candidate_wide_leg"] : [], wording);
  }
  for (const [wording, expected] of [
    ["Drawstring should be selected", "requested"],
    ["Drawstring shouldn't be selected", "prohibited"],
    ["Drawstring isn't required", null],
    ["Drawstring is optional", null],
    ["Drawstring shouldn't be selected; drawstring waistband required", "ambiguous"],
  ] as const) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), expected, wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", wording).map(issue => issue.code),
      expected === "ambiguous" ? ["ambiguous_candidate_waistband"] : [], wording);
  }
});
