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
    { wording: "with or without wide-leg trousers", wide: "ambiguous", waist: null },
    { wording: "with or without wide-leg pants", wide: "ambiguous", waist: null },
    { wording: "with or without a wide-leg trouser", wide: "ambiguous", waist: null },
    { wording: "with or without any wide-leg pants", wide: "ambiguous", waist: null },
    { wording: "with or without a drawstring", wide: null, waist: "ambiguous" },
    { wording: "with or without any drawstring", wide: null, waist: "ambiguous" },
    { wording: "with without wide-leg trousers", wide: "ambiguous", waist: null },
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

test("optional waistband wording does not mask an independent silhouette prohibition", () => {
  const saved = Object.freeze({ type: "wide_leg_relaxed_drape", waistband: "belt_loops" });
  const cases = [
    "no wide-leg trousers, drawstring optional",
    "no wide-leg trousers; optional drawstring",
    "no wide-leg trousers and maybe drawstring",
  ];
  for (const wording of cases) {
    assert.equal(styleDirectorCandidateWideLegIntent(wording), "prohibited", wording);
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), null, wording);
    assert.equal(styleDirectorCandidateWideLegIssues(wording, saved)[0]?.code,
      "candidate_wide_leg_mismatch", wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, saved), [], wording);
    assert.equal(saved.type, "wide_leg_relaxed_drape");
    assert.equal(saved.waistband, "belt_loops");
  }
});

test("maybe drawstring remains optional without hiding an independent affirmative request", () => {
  const saved = Object.freeze({ type: "formal_flat_front", waistband: "belt_loops" });
  for (const wording of [
    "maybe drawstring",
    "maybe draw-string",
    "no wide-leg trousers and maybe drawstring",
  ]) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, saved), [], wording);
  }
  assert.equal(styleDirectorCandidateDrawstringWaistband("drawstring trousers"), "requested");
  assert.equal(styleDirectorCandidateDrawstringWaistband("no drawstring"), "prohibited");
  assert.equal(saved.waistband, "belt_loops");
});

test("tentative wide-leg wording stays optional without masking independent firm instructions", () => {
  const locked = Object.freeze({ type: "formal_flat_front", waistband: "belt_loops" });
  const tentative = [
    "maybe wide-leg trousers",
    "possibly wide-leg pants",
    "maybe wide-fit trousers",
    "wide-leg trousers maybe",
    "maybe wide-legged trousers",
  ];
  for (const wording of tentative) {
    assert.equal(styleDirectorCandidateWideLegIntent(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(wording, locked), [], wording);
  }
  const checks = [
    { wording: "wide-leg trousers", expected: "requested" },
    { wording: "maybe wide-leg trousers, but wide-leg pants required", expected: "requested" },
    { wording: "maybe wide-leg trousers; no wide-leg pants", expected: "prohibited" },
    { wording: "no wide-leg trousers, possibly wide-leg pants", expected: "prohibited" },
    { wording: "maybe wide-leg trousers with drawstring trousers", expected: null },
  ] as const;
  for (const { wording, expected } of checks) {
    assert.equal(styleDirectorCandidateWideLegIntent(wording), expected, wording);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(wording, locked),
      expected === "requested" ? [{
        code: "candidate_wide_leg_mismatch",
        explanation: "The named wide-leg silhouette request or prohibition conflicts with the saved versioned trouser type; confirm the cut before tailoring.",
      }] : [], wording);
  }
  assert.equal(styleDirectorCandidateDrawstringWaistband(
    "maybe wide-leg trousers with drawstring trousers"), "requested");
  assert.equal(locked.type, "formal_flat_front", "locked type unchanged");
  assert.equal(locked.waistband, "belt_loops", "locked waistband unchanged");
});

test("tentative trouser options remain neutral while firm construction instructions survive", () => {
  const locked = Object.freeze({ type: "formal_flat_front", waistband: "belt_loops" });
  const unchanged = JSON.stringify(locked);
  const cases = [
    { wording: "perhaps wide-leg trousers and possibly drawstring", wide: null, waist: null },
    { wording: "wide-leg pants perhaps, drawstring maybe", wide: null, waist: null },
    { wording: "wide-fit trousers possibly, drawstring perhaps", wide: null, waist: null },
    { wording: "maybe wide-legged trousers, perhaps draw-string", wide: null, waist: null },
    { wording: "no wide-leg trousers; perhaps drawstring", wide: "prohibited", waist: null },
    { wording: "possibly wide-leg pants; no drawstring", wide: null, waist: "prohibited" },
    { wording: "perhaps wide-leg trousers; wide-leg pants required", wide: "requested", waist: null },
    { wording: "drawstring maybe; drawstring required", wide: null, waist: "requested" },
    { wording: "perhaps wide-leg trousers; wide-leg pants; no wide-leg pants", wide: "ambiguous", waist: null },
    { wording: "possibly drawstring; drawstring; no drawstring", wide: null, waist: "ambiguous" },
  ] as const;
  for (const { wording, wide, waist } of cases) {
    assert.equal(styleDirectorCandidateWideLegIntent(wording), wide, wording);
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), waist, wording);
    assert.equal(styleDirectorCandidateWideLegIssues(wording, locked)
      .some(issue => issue.code === "candidate_wide_leg_mismatch"), wide === "requested", wording);
    assert.equal(styleDirectorCandidateWaistbandIssues(wording, locked)
      .some(issue => issue.code === "candidate_waistband_mismatch"), waist === "requested", wording);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(wording, locked),
      styleDirectorCandidateWideLegIssues(wording, locked), "deterministic silhouette review");
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, locked),
      styleDirectorCandidateWaistbandIssues(wording, locked), "deterministic waistband review");
    assert.equal(JSON.stringify(locked), unchanged, "never rewrite locked construction");
  }
});

test("quantified drawstring exclusions never become affirmative waistband instructions", () => {
  const withDrawstring = Object.freeze({ waistband: "drawstring_elastic" });
  const withoutDrawstring = Object.freeze({ waistband: "belt_loops" });
  const negative = [
    "without any drawstring",
    "without the drawstring",
    "avoid any draw-string",
    "never use any drawstring",
    "do not include the drawstring",
    "no drawstring",
  ];
  for (const wording of negative) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), "prohibited", wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, withoutDrawstring), [], wording);
    const first = styleDirectorCandidateWaistbandIssues(wording, withDrawstring);
    assert.equal(first.length, 1, wording);
    assert.equal(first[0].code, "candidate_waistband_mismatch", wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, withDrawstring), first);
  }
  const contradictory = [
    "without any drawstring, but drawstring is required",
    "avoid the draw-string and use a drawstring",
    "drawstring trousers; without any drawstring",
  ];
  for (const wording of contradictory) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), "ambiguous", wording);
  }
  assert.equal(styleDirectorCandidateDrawstringWaistband("drawstring trousers"), "requested");
  assert.deepEqual(styleDirectorCandidateWaistbandIssues("drawstring trousers", withDrawstring), []);
  assert.equal(withDrawstring.waistband, "drawstring_elastic");
  assert.equal(withoutDrawstring.waistband, "belt_loops");
});

test("unwanted drawstring wording cannot be mistaken for an affirmative selection", () => {
  const plain = Object.freeze({ waistband: "belt_loops" });
  const drawstring = Object.freeze({ waistband: "drawstring_elastic" });
  const negatives = [
    "I don't want any drawstring",
    "I don’t want a draw-string",
    "do not want the drawstring",
    "never want drawstring",
    "drawstring is not wanted",
    "draw-string not wanted",
    "drawstring not wanted; perhaps drawstring",
  ];
  for (const wording of negatives) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), "prohibited", wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, plain), [], wording);
    const issues = styleDirectorCandidateWaistbandIssues(wording, drawstring);
    assert.equal(issues.length, 1, wording);
    assert.equal(issues[0].code, "candidate_waistband_mismatch", wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, drawstring), issues, wording);
  }
  const conflicts = [
    "I don't want any drawstring, but drawstring is required",
    "drawstring not wanted; add drawstring",
    "drawstring is not wanted, but drawstring trousers",
  ];
  for (const wording of conflicts) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), "ambiguous", wording);
  }
  assert.equal(styleDirectorCandidateDrawstringWaistband("drawstring is wanted"), "requested");
  assert.deepEqual(styleDirectorCandidateWaistbandIssues("drawstring is wanted", drawstring), []);
  assert.equal(plain.waistband, "belt_loops");
  assert.equal(drawstring.waistband, "drawstring_elastic");
});
