import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateWideLegIntent,
  styleDirectorCandidateWideLegIssues,
  styleDirectorCandidateDrawstringWaistband,
  styleDirectorCandidateWaistbandIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// Candidate wording may recommend construction, but must never rewrite a
// locked versioned garment. These checks do not assume measured fabric or fit.
test("wide-leg request and exclusion respect the locked trouser silhouette", () => {
  const wide = Object.freeze({ type: "wide_leg_relaxed_drape" });
  const narrow = Object.freeze({ type: "formal_flat_front" });
  assert.equal(styleDirectorCandidateWideLegIntent("wide-leg trousers"), "requested");
  assert.equal(styleDirectorCandidateWideLegIntent("no wide-leg trousers"), "prohibited");
  assert.deepEqual(styleDirectorCandidateWideLegIssues("wide-leg trousers", wide), []);
  assert.ok(styleDirectorCandidateWideLegIssues("wide-leg trousers", narrow)
    .some(issue => issue.code === "candidate_wide_leg_mismatch"));
  assert.ok(styleDirectorCandidateWideLegIssues("no wide-leg trousers", wide)
    .some(issue => issue.code === "candidate_wide_leg_mismatch"));
  assert.deepEqual(styleDirectorCandidateWideLegIssues("no wide-leg trousers", narrow), []);
  assert.equal(wide.type, "wide_leg_relaxed_drape");
  assert.equal(narrow.type, "formal_flat_front");
});

test("drawstring instructions cannot silently override the saved waistband", () => {
  const drawstring = Object.freeze({ waistband: "drawstring_elastic" });
  const standard = Object.freeze({ waistband: "standard_belt_loops" });
  assert.equal(styleDirectorCandidateDrawstringWaistband("drawstring trousers"), "requested");
  assert.equal(styleDirectorCandidateDrawstringWaistband("no drawstring"), "prohibited");
  assert.deepEqual(styleDirectorCandidateWaistbandIssues("drawstring trousers", drawstring), []);
  assert.ok(styleDirectorCandidateWaistbandIssues("drawstring trousers", standard)
    .some(issue => issue.code === "candidate_waistband_mismatch"));
  assert.ok(styleDirectorCandidateWaistbandIssues("no drawstring", drawstring)
    .some(issue => issue.code === "candidate_waistband_mismatch"));
  assert.deepEqual(styleDirectorCandidateWaistbandIssues("no drawstring", standard), []);
  assert.deepEqual(styleDirectorCandidateWaistbandIssues("no drawstring", standard),
    styleDirectorCandidateWaistbandIssues("no drawstring", standard));
  assert.equal(drawstring.waistband, "drawstring_elastic");
});

test("combined trouser construction instructions validate silhouette and waistband independently", () => {
  const cases = [
    { name: "wide-leg trousers with drawstring", pant: { type: "wide_leg_relaxed_drape", waistband: "drawstring_elastic" }, wide: false, waist: false },
    { name: "wide-leg trousers with drawstring", pant: { type: "formal_flat_front", waistband: "drawstring_elastic" }, wide: true, waist: false },
    { name: "wide-leg trousers with drawstring", pant: { type: "wide_leg_relaxed_drape", waistband: "standard_belt_loops" }, wide: false, waist: true },
    { name: "wide-leg trousers with drawstring", pant: { type: "formal_flat_front", waistband: "standard_belt_loops" }, wide: true, waist: true },
    { name: "no wide-leg trousers and no drawstring", pant: { type: "formal_flat_front", waistband: "standard_belt_loops" }, wide: false, waist: false },
    { name: "no wide-leg trousers and no drawstring", pant: { type: "wide_leg_relaxed_drape", waistband: "drawstring_elastic" }, wide: true, waist: true },
  ] as const;
  for (const { name, pant, wide, waist } of cases) {
    const locked = Object.freeze({ ...pant });
    const before = JSON.stringify(locked);
    const silhouette = styleDirectorCandidateWideLegIssues(name, locked);
    const waistband = styleDirectorCandidateWaistbandIssues(name, locked);
    assert.equal(silhouette.some(issue => issue.code === "candidate_wide_leg_mismatch"), wide, name);
    assert.equal(waistband.some(issue => issue.code === "candidate_waistband_mismatch"), waist, name);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(name, locked), silhouette);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(name, locked), waistband);
    assert.equal(JSON.stringify(locked), before, "locked garment options must not change");
  }
});

test("ambiguous and optional trouser wording cannot silently authorize a locked construction", () => {
  const cases = [
    { wording: "wide-leg trousers and no wide-leg trousers", wide: "ambiguous", waist: null },
    { wording: "optional wide-leg trousers", wide: null, waist: null },
    { wording: "drawstring and no drawstring", wide: null, waist: "ambiguous" },
    { wording: "with or without drawstring", wide: null, waist: "ambiguous" },
    { wording: "drawstring optional", wide: null, waist: null },
    { wording: "no wide-leg trousers with drawstring", wide: "prohibited", waist: "requested" },
  ] as const;
  const saved = Object.freeze({ type: "wide_leg_relaxed_drape", waistband: "drawstring_elastic" });
  const snapshot = JSON.stringify(saved);
  for (const { wording, wide, waist } of cases) {
    assert.equal(styleDirectorCandidateWideLegIntent(wording), wide, wording);
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), waist, wording);
    const wideIssues = styleDirectorCandidateWideLegIssues(wording, saved);
    const waistIssues = styleDirectorCandidateWaistbandIssues(wording, saved);
    assert.equal(wideIssues.some(issue => issue.code === "candidate_wide_leg_mismatch"),
      wide === "prohibited", wording);
    assert.deepEqual(waistIssues, [], wording);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(wording, saved), wideIssues);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, saved), waistIssues);
    assert.equal(JSON.stringify(saved), snapshot, "locked IDs must remain immutable");
  }
});
