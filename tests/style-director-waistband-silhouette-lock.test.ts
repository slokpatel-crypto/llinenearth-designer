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
