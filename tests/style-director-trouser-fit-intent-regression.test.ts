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

test("shared tapered suffix with different slim/regular fits requires human review", () => {
  for (const wording of [
    "slim or regular tapered fit",
    "regular or slim tapered fit",
    "slim tapered or regular",
    "regular tapered or slim",
    "slim tapered fit or regular",
    "regular tapered fit or slim",
    "slim tapered or regular tapered fit",
    "regular tapered or slim tapered fit",
  ]) {
    assert.deepEqual(styleDirectorCandidateTrouserFitIntent(wording), {
      requested: null, prohibited: [], ambiguous: true,
    }, wording);
    assert.equal(styleDirectorCandidateTrouserFit(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("plain shirt", wording)
      .map(issue => issue.code), ["ambiguous_candidate_trouser_fit"], wording);
    for (const id of ["slim_tapered", "regular_tapered", "straight_classic",
      "korean_tapered", "baggy_wide"]) {
      const locked = Object.freeze({ fit: id });
      const before = JSON.stringify(locked);
      assert.deepEqual(styleDirectorCandidateTrouserFitIssues(wording, locked), [], wording);
      assert.equal(JSON.stringify(locked), before, "saved fit ID must not change");
    }
  }
});

test("repeated same tapered adjective is one option; separate explicit bans survive", () => {
  for (const [wording, id] of [
    ["slim or slim tapered fit", "slim_tapered"],
    ["regular or regular tapered fit", "regular_tapered"],
    ["slim tapered fit or slim", "slim_tapered"],
    ["regular tapered or regular", "regular_tapered"],
    ["slim tapered fit", "slim_tapered"],
    ["regular tapered fit", "regular_tapered"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateTrouserFitIntent(wording), {
      requested: id, prohibited: [], ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidateTrouserFit(wording), id, wording);
    assert.ok(!styleDirectorCandidateWordingIssues("plain shirt", wording)
      .some(issue => issue.code === "ambiguous_candidate_trouser_fit"), wording);
  }
  const wording = "slim or regular tapered fit; no cargo utility fit";
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent(wording), {
    requested: null, prohibited: ["cargo_utility"], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidateWordingIssues("plain shirt", wording)
    .map(issue => issue.code), ["ambiguous_candidate_trouser_fit"]);
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent("no slim tapered fit"), {
    requested: null, prohibited: ["slim_tapered"], ambiguous: false,
  });
});
