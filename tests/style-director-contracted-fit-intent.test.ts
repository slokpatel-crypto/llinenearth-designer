import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateShirtFitIntent,
  styleDirectorCandidateShirtFitIssues,
  styleDirectorCandidateTrouserFitIntent,
  styleDirectorCandidateTrouserFitIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("contracted and modal shirt fit bans do not select the prohibited fit", () => {
  for (const phrase of [
    "slim fit isn't wanted", "slim fit isn’t wanted",
    "slim fit should not be selected", "slim fit must not be chosen",
  ]) {
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(phrase),
      { requested: null, prohibited: ["slim_fit"], ambiguous: false }, phrase);
    const locked = Object.freeze({ fit: "slim_fit" });
    const issues = styleDirectorCandidateShirtFitIssues(phrase, locked);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_fit_mismatch"], phrase);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(phrase, { fit: "relaxed_fit" }), []);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(phrase, locked), issues);
    assert.equal(locked.fit, "slim_fit", "review must preserve locked option");
  }
});

test("contracted and modal trouser fit bans remain distinct from selection", () => {
  for (const phrase of [
    "slim tapered fit isn't wanted", "slim tapered fit isn’t wanted",
    "slim tapered fit should not be used", "slim tapered fit must not be selected",
  ]) {
    assert.deepEqual(styleDirectorCandidateTrouserFitIntent(phrase),
      { requested: null, prohibited: ["slim_tapered"], ambiguous: false }, phrase);
    const locked = Object.freeze({ fit: "slim_tapered" });
    const issues = styleDirectorCandidateTrouserFitIssues(phrase, locked);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_trouser_fit_mismatch"], phrase);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(phrase, { fit: "straight_classic" }), []);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(phrase, locked), issues);
    assert.equal(locked.fit, "slim_tapered");
  }
});

test("contracted not required wording remains optional, not prohibited or selected", () => {
  for (const phrase of ["slim fit isn't required", "slim fit isn’t needed", "slim fit isn't mandatory"]) {
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(phrase),
      { requested: null, prohibited: [], ambiguous: false }, phrase);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(phrase, { fit: "slim_fit" }), []);
  }
  for (const phrase of [
    "slim tapered fit isn't required", "slim tapered fit isn’t needed",
    "slim tapered fit isn't mandatory",
  ]) {
    assert.deepEqual(styleDirectorCandidateTrouserFitIntent(phrase),
      { requested: null, prohibited: [], ambiguous: false }, phrase);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(phrase, { fit: "slim_tapered" }), []);
  }
});

test("contracted bans and explicit positive requests remain contradictory and reviewable", () => {
  const shirt = "slim fit isn't wanted; slim fit requested";
  const trouser = "slim tapered fit should not be selected, but slim tapered fit required";
  assert.equal(styleDirectorCandidateShirtFitIntent(shirt).ambiguous, true);
  assert.equal(styleDirectorCandidateTrouserFitIntent(trouser).ambiguous, true);
  assert.ok(styleDirectorCandidateWordingIssues(shirt).some(issue =>
    issue.code === "ambiguous_candidate_shirt_fit"));
  assert.ok(styleDirectorCandidateWordingIssues("", trouser).some(issue =>
    issue.code === "ambiguous_candidate_trouser_fit"));
});
