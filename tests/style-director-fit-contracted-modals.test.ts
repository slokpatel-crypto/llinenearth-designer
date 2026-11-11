import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateShirtFit,
  styleDirectorCandidateShirtFitIntent,
  styleDirectorCandidateShirtFitIssues,
  styleDirectorCandidateTrouserFit,
  styleDirectorCandidateTrouserFitIntent,
  styleDirectorCandidateTrouserFitIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("contracted modal shirt-fit bans respect immutable canonical locked choices", () => {
  for (const [wording, prohibited, allowed] of [
    ["Slim fit shouldn't be selected", "slim_fit", "regular_classic_fit"],
    ["Regular fit mustn't be used", "regular_classic_fit", "slim_fit"],
    ["Relaxed fit shouldn’t be chosen", "relaxed_fit", "regular_classic_fit"],
    ["Athletic taper fit mustn’t be worn", "athletic_taper", "slim_fit"],
    ["Boxy fit should not be selected", "boxy_oversized", "relaxed_fit"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(wording), {
      requested: null, prohibited: [prohibited], ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidateShirtFit(wording, []), null, wording);
    const locked = Object.freeze({ fit: prohibited });
    const before = JSON.stringify(locked);
    const first = styleDirectorCandidateShirtFitIssues(wording, locked);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_shirt_fit_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(wording, locked), first, wording);
    assert.equal(JSON.stringify(locked), before, "the saved fit ID cannot be rewritten");
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(wording, { fit: allowed }), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), [], wording);
  }
  assert.deepEqual(styleDirectorCandidateShirtFitIssues(
    "Slim fit shouldn't be selected", { fit: "unknown_fit" },
  ).map(issue => issue.code), ["candidate_shirt_fit_mismatch"]);
});

test("contracted modal trouser-fit bans respect immutable canonical locked choices", () => {
  for (const [wording, prohibited, allowed] of [
    ["Slim tapered fit shouldn't be selected", "slim_tapered", "regular_tapered"],
    ["Baggy wide fit mustn't be used", "baggy_wide", "slim_tapered"],
    ["Regular tapered fit shouldn’t be chosen", "regular_tapered", "slim_tapered"],
    ["Korean tapered fit mustn’t be worn", "korean_tapered", "straight_classic"],
    ["Wide-leg drape fit should not be selected", "wide_leg_drape", "slim_tapered"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateTrouserFitIntent(wording), {
      requested: null, prohibited: [prohibited], ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidateTrouserFit(wording), null, wording);
    const locked = Object.freeze({ fit: prohibited });
    const before = JSON.stringify(locked);
    const first = styleDirectorCandidateTrouserFitIssues(wording, locked);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_trouser_fit_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(wording, locked), first, wording);
    assert.equal(JSON.stringify(locked), before, "the saved fit ID cannot be rewritten");
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(wording, { fit: allowed }), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", wording), [], wording);
  }
  assert.deepEqual(styleDirectorCandidateTrouserFitIssues(
    "Slim tapered fit shouldn't be selected", { fit: "unknown_fit" },
  ).map(issue => issue.code), ["candidate_trouser_fit_mismatch"]);
});

test("modal fit refusals preserve affirmative choices, optionality and contradiction reviews", () => {
  assert.deepEqual(styleDirectorCandidateShirtFitIntent("Slim fit should be selected"), {
    requested: "slim_fit", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateShirtFitIntent("Slim fit isn't required"), {
    requested: null, prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent("Slim tapered fit should be selected"), {
    requested: "slim_tapered", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent("Slim tapered fit isn't required"), {
    requested: null, prohibited: [], ambiguous: false,
  });
  const shirtConflict = "Slim fit shouldn't be selected; slim fit required";
  const trouserConflict = "Slim tapered fit shouldn't be selected; slim tapered fit required";
  assert.deepEqual(styleDirectorCandidateShirtFitIntent(shirtConflict), {
    requested: "slim_fit", prohibited: ["slim_fit"], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent(trouserConflict), {
    requested: "slim_tapered", prohibited: ["slim_tapered"], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidateWordingIssues(shirtConflict)
    .map(issue => issue.code), ["ambiguous_candidate_shirt_fit"]);
  assert.deepEqual(styleDirectorCandidateWordingIssues("", trouserConflict)
    .map(issue => issue.code), ["ambiguous_candidate_trouser_fit"]);
  assert.equal(styleDirectorCandidateShirtFit(shirtConflict, []), null);
  assert.equal(styleDirectorCandidateTrouserFit(trouserConflict), null);
});
