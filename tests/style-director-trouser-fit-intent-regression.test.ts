import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateTrouserFit,
  styleDirectorCandidateTrouserFitIntent,
  styleDirectorCandidateTrouserFitIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// Candidate prose must never silently override the versioned tailoring recipe.
test("trouser fit negation is not interpreted as a positive fit request", () => {
  for (const phrase of ["no slim tapered fit", "without slim tapered fit", "avoid slim tapered fit"]) {
    const intent = styleDirectorCandidateTrouserFitIntent(phrase);
    assert.equal(intent.requested, null, phrase);
    assert.deepEqual(intent.prohibited, ["slim_tapered"], phrase);
    assert.equal(styleDirectorCandidateTrouserFit(phrase), null, phrase);
    assert.equal(styleDirectorCandidateTrouserFitIssues(phrase, { fit: "slim_tapered" })[0]?.code,
      "candidate_trouser_fit_mismatch", phrase);
    assert.equal(styleDirectorCandidateTrouserFitIssues(phrase, { fit: "straight_classic" })
      .some(issue => issue.code === "candidate_trouser_fit_mismatch"), false, phrase);
  }
});

test("conflicting trouser fit instructions require review without choosing a fit", () => {
  for (const phrase of ["slim tapered fit and straight classic fit", "slim tapered fit but no slim tapered fit"]) {
    assert.equal(styleDirectorCandidateTrouserFitIntent(phrase).ambiguous, true, phrase);
    assert.equal(styleDirectorCandidateTrouserFit(phrase), null, phrase);
    assert.ok(styleDirectorCandidateWordingIssues("plain shirt", phrase)
      .some(issue => issue.code === "ambiguous_candidate_trouser_fit"), phrase);
  }
});

test("optional trouser fit does not override locked canonical fit", () => {
  for (const phrase of ["optional slim tapered fit", "slim tapered fit optional"]) {
    const intent = styleDirectorCandidateTrouserFitIntent(phrase);
    assert.equal(intent.requested, null, phrase);
    assert.equal(intent.ambiguous, false, phrase);
    assert.equal(styleDirectorCandidateTrouserFit(phrase), null, phrase);
  }
});
