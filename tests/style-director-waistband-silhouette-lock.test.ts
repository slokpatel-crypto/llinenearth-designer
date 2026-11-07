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
  const standard = Object.freeze({ waistband: "belt_loops" });
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
    { name: "wide-leg trousers with drawstring", pant: { type: "wide_leg_relaxed_drape", waistband: "belt_loops" }, wide: false, waist: true },
    { name: "wide-leg trousers with drawstring", pant: { type: "formal_flat_front", waistband: "belt_loops" }, wide: true, waist: true },
    { name: "no wide-leg trousers and no drawstring", pant: { type: "formal_flat_front", waistband: "belt_loops" }, wide: false, waist: false },
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

test("inherited and accessor trouser IDs cannot authorize locked construction", () => {
  for (const [field, wording, check] of [
    ["type", "wide-leg trousers", styleDirectorCandidateWideLegIssues],
    ["waistband", "drawstring trousers", styleDirectorCandidateWaistbandIssues],
  ] as const) {
    const canonical = field === "type" ? "wide_leg_relaxed_drape" : "drawstring_elastic";
    const inherited = Object.create({ [field]: canonical });
    const getter = Object.defineProperty({}, field, {
      enumerable: true,
      get() { throw new Error("untrusted accessor must not run"); },
    });
    for (const value of [inherited, getter, Object.freeze({})]) {
      const first = check(wording, value);
      assert.equal(first.length, 1, `${field}: missing own data property must mismatch`);
      assert.deepEqual(check(wording, value), first, "deterministic replay");
    }
    const safe = Object.freeze(Object.assign(Object.create(null), { [field]: canonical }));
    assert.deepEqual(check(wording, safe), [], "canonical own data property remains valid");
  }
});

test("prohibited trouser constructions fail closed on missing or unrecognised saved IDs", () => {
  const cases = [
    { field: "type", wording: "no wide-leg trousers", check: styleDirectorCandidateWideLegIssues, code: "candidate_wide_leg_mismatch", valid: "formal_flat_front" },
    { field: "waistband", wording: "no drawstring", check: styleDirectorCandidateWaistbandIssues, code: "candidate_waistband_mismatch", valid: "belt_loops" },
  ] as const;
  for (const { field, wording, check, code, valid } of cases) {
    const inherited = Object.create({ [field]: valid });
    const getter = Object.defineProperty({}, field, {
      get() { throw new Error("accessor must not execute"); },
    });
    const invalid = Object.freeze({ [field]: "unapproved_option" });
    for (const saved of [Object.freeze({}), inherited, getter, invalid, null]) {
      const issues = check(wording, saved as never);
      assert.equal(issues.length, 1, `${field}: untrusted locked ID must require review`);
      assert.equal(issues[0].code, code);
      assert.deepEqual(check(wording, saved as never), issues, "deterministic replay");
    }
    const canonical = Object.freeze(Object.assign(Object.create(null), { [field]: valid }));
    assert.deepEqual(check(wording, canonical), [], "valid own canonical ID satisfies exclusion");
  }
});
