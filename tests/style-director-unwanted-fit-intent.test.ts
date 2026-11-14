import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateShirtFitIntent,
  styleDirectorCandidateShirtFitIssues,
  styleDirectorCandidateTrouserFitIntent,
  styleDirectorCandidateTrouserFitIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("unwanted shirt fits are prohibitions, never affirmations", () => {
  for (const [wording, fit] of [
    ["slim fit is not wanted", "slim_fit"],
    ["slim-fit unwanted", "slim_fit"],
    ["regular fit is not wanted", "regular_classic_fit"],
    ["relaxed fit unwanted", "relaxed_fit"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(wording),
      { requested: null, prohibited: [fit], ambiguous: false }, wording);
    const saved = Object.freeze({ fit });
    const issues = styleDirectorCandidateShirtFitIssues(wording, saved);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_fit_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(wording, saved), issues);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(wording, { fit: "athletic_taper" }), []);
    assert.equal(saved.fit, fit, "locked fit remains unchanged");
  }
});

test("unwanted trouser fits are prohibitions, never affirmations", () => {
  for (const [wording, fit] of [
    ["slim tapered fit is not wanted", "slim_tapered"],
    ["slim tapered fit unwanted", "slim_tapered"],
    ["straight classic fit is not wanted", "straight_classic"],
    ["baggy wide fit unwanted", "baggy_wide"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateTrouserFitIntent(wording),
      { requested: null, prohibited: [fit], ambiguous: false }, wording);
    const saved = Object.freeze({ fit });
    const issues = styleDirectorCandidateTrouserFitIssues(wording, saved);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_trouser_fit_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(wording, saved), issues);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(wording, { fit: "regular_tapered" }), []);
    assert.equal(saved.fit, fit);
  }
});

test("contradictory positive and unwanted fit clauses require review", () => {
  const shirt = "slim fit unwanted, but slim fit required";
  const trouser = "slim tapered fit is not wanted; slim tapered fit requested";
  assert.equal(styleDirectorCandidateShirtFitIntent(shirt).ambiguous, true);
  assert.equal(styleDirectorCandidateTrouserFitIntent(trouser).ambiguous, true);
  assert.ok(styleDirectorCandidateWordingIssues(shirt).some(issue =>
    issue.code === "ambiguous_candidate_shirt_fit"));
  assert.ok(styleDirectorCandidateWordingIssues("", trouser).some(issue =>
    issue.code === "ambiguous_candidate_trouser_fit"));
});

test("wanted and optional fits retain their distinct meaning", () => {
  assert.deepEqual(styleDirectorCandidateShirtFitIntent("slim fit wanted"),
    { requested: "slim_fit", prohibited: [], ambiguous: false });
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent("slim tapered fit wanted"),
    { requested: "slim_tapered", prohibited: [], ambiguous: false });
  assert.deepEqual(styleDirectorCandidateShirtFitIntent("slim fit not required"),
    { requested: null, prohibited: [], ambiguous: false });
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent("slim tapered fit optional"),
    { requested: null, prohibited: [], ambiguous: false });
});
