import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateWideLegIntent,
  styleDirectorCandidateWideLegIssues,
  styleDirectorCandidateDrawstringWaistband,
  styleDirectorCandidateWaistbandIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("unwanted wide-leg silhouettes do not become affirmative cutting instructions", () => {
  const wide = Object.freeze({ type: "wide_leg_relaxed_drape" });
  const classic = Object.freeze({ type: "formal_flat_front" });
  for (const label of [
    "wide-leg trousers aren't wanted",
    "wide-leg trousers aren’t wanted",
    "wide-leg trousers is unwanted",
    "wide-leg trousers should not be selected",
    "wide-leg trousers must not be selected",
  ]) {
    assert.equal(styleDirectorCandidateWideLegIntent(label), "prohibited", label);
    const issues = styleDirectorCandidateWideLegIssues(label, wide);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_wide_leg_mismatch"], label);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(label, classic), [], label);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(label, wide), issues);
    assert.equal(wide.type, "wide_leg_relaxed_drape");
  }
});

test("contracted optional wide-leg phrases do not request or prohibit a silhouette", () => {
  for (const label of [
    "wide-leg trousers aren't required", "wide-leg trousers aren’t needed",
    "wide-leg trousers aren't mandatory", "wide-leg trousers are optional",
  ]) {
    assert.equal(styleDirectorCandidateWideLegIntent(label), null, label);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(label, { type: "wide_leg_relaxed_drape" }), [], label);
  }
  assert.equal(styleDirectorCandidateWideLegIntent("wide-leg trousers required"), "requested");
  const contradiction = "wide-leg trousers aren't wanted; wide-leg trousers required";
  assert.equal(styleDirectorCandidateWideLegIntent(contradiction), "ambiguous");
  assert.ok(styleDirectorCandidateWordingIssues("", contradiction)
    .some(issue => issue.code === "ambiguous_candidate_wide_leg"));
});

test("unwanted drawstring waistband phrases never become positive garment requests", () => {
  const drawstring = Object.freeze({ waistband: "drawstring_elastic" });
  const belt = Object.freeze({ waistband: "belt_loops" });
  for (const label of [
    "drawstring isn't wanted", "drawstring isn’t wanted", "drawstring is unwanted",
    "drawstring should not be selected", "drawstring must not be selected",
  ]) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(label), "prohibited", label);
    const issues = styleDirectorCandidateWaistbandIssues(label, drawstring);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_waistband_mismatch"], label);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(label, belt), [], label);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(label, drawstring), issues);
    assert.equal(drawstring.waistband, "drawstring_elastic");
  }
});

test("optional drawstring and contradictory drawstring clauses remain distinct", () => {
  for (const label of [
    "drawstring isn't required", "drawstring isn’t needed", "drawstring isn't mandatory",
    "drawstring is optional",
  ]) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(label), null, label);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(label, { waistband: "drawstring_elastic" }), [], label);
  }
  assert.equal(styleDirectorCandidateDrawstringWaistband("drawstring requested"), "requested");
  const contradiction = "drawstring isn't wanted; drawstring required";
  assert.equal(styleDirectorCandidateDrawstringWaistband(contradiction), "ambiguous");
  assert.ok(styleDirectorCandidateWordingIssues("", contradiction)
    .some(issue => issue.code === "ambiguous_candidate_waistband"));
  assert.equal(styleDirectorCandidateDrawstringWaistband("with or without drawstring"), "ambiguous");
});
