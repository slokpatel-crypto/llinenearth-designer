import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateDrawstringWaistband,
  styleDirectorCandidateWaistbandIssues,
  styleDirectorCandidateWideLegIntent,
  styleDirectorCandidateWideLegIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const drawstring = Object.freeze({ waistband: "drawstring_elastic" });
const beltLoops = Object.freeze({ waistband: "belt_loops" });

test("modal drawstring prohibitions cannot select a forbidden waistband", () => {
  const bans = [
    "must not use drawstring",
    "should not include a draw-string",
    "cannot have the drawstring",
    "can't choose drawstring",
    "mustn't select the drawstring",
    "shouldn't wear any drawstring",
    "would not add drawstring",
    "couldn't use drawstring",
    "drawstring cannot be used",
    "draw-string can't be selected",
    "drawstring shouldn't be chosen",
    "drawstring mustn't be included",
  ];
  for (const wording of bans) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), "prohibited", wording);
    const blocked = styleDirectorCandidateWaistbandIssues(wording, drawstring);
    assert.deepEqual(blocked.map(issue => issue.code), ["candidate_waistband_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, drawstring), blocked);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, beltLoops), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("plain shirt", wording)
      .filter(issue => issue.code === "ambiguous_candidate_waistband"), [], wording);
  }
  assert.equal(drawstring.waistband, "drawstring_elastic");
  assert.equal(beltLoops.waistband, "belt_loops");
});

test("modal waistband bans and separate affirmative requests need clarification", () => {
  const mixed = [
    "must not use drawstring; include drawstring",
    "drawstring cannot be used, but drawstring trousers are requested",
    "shouldn't include drawstring; draw-string required",
  ];
  for (const wording of mixed) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), "ambiguous", wording);
    assert.ok(styleDirectorCandidateWordingIssues("plain shirt", wording)
      .some(issue => issue.code === "ambiguous_candidate_waistband"), wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, drawstring), [],
      "an ambiguous prompt must not auto-rewrite a locked design");
  }
});

test("modal waistband bans remain independent of wide-leg silhouette intent", () => {
  const spec = Object.freeze({ type: "wide_leg_relaxed_drape", waistband: "drawstring_elastic" });
  const wording = "wide-leg trousers, but must not include drawstring";
  assert.equal(styleDirectorCandidateWideLegIntent(wording), "requested");
  assert.equal(styleDirectorCandidateDrawstringWaistband(wording), "prohibited");
  assert.deepEqual(styleDirectorCandidateWideLegIssues(wording, spec), []);
  assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, spec)
    .map(issue => issue.code), ["candidate_waistband_mismatch"]);
  assert.equal(spec.type, "wide_leg_relaxed_drape");
  assert.equal(spec.waistband, "drawstring_elastic");
});

test("modal waistband bans fail closed for missing or stale saved IDs", () => {
  const wording = "cannot use drawstring";
  for (const saved of [Object.freeze({}), Object.freeze({ waistband: "retired_waistband" })]) {
    assert.equal(styleDirectorCandidateWaistbandIssues(wording, saved as never)[0]?.code,
      "candidate_waistband_mismatch");
  }
  assert.equal(styleDirectorCandidateDrawstringWaistband("drawstring required"), "requested");
  assert.equal(styleDirectorCandidateDrawstringWaistband("drawstring optional"), null);
  assert.equal(styleDirectorCandidateDrawstringWaistband("with or without drawstring"), "ambiguous");
});
