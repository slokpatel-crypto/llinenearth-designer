import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorConstructionIssues,
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateFrontConstructionIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

test("unknown flat-front pleat IDs require vocabulary review, not fabricated physical pleats", () => {
  for (const pleat of [undefined, null, "", "flat_front ", "obsolete_double_pleat", "single_pleat"]) {
    const spec = Object.freeze({
      shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
      pant: Object.freeze({ type: "formal_flat_front", pleat, hem: "plain_hem",
        break: "no_break" }),
    }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(spec);
    const issues = styleDirectorConstructionIssues(spec);
    assert.equal(issues.filter(issue => issue.code === "unknown_trouser_pleat_option").length,
      pleat === undefined ? 0 : 1);
    assert.ok(!issues.some(issue => issue.code === "flat_front_has_pleat"),
      "an unknown ID cannot establish that a real pleat exists");
    assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
    assert.equal(JSON.stringify(spec), snapshot);
  }
});

test("known pleated front on a flat-front trouser still requires construction review", () => {
  const spec = Object.freeze({
    shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
    pant: Object.freeze({ type: "formal_flat_front", pleat: "single_pleat_forward",
      hem: "plain_hem", break: "no_break" }),
  }) as unknown as StyleSpecV2;
  const issues = styleDirectorConstructionIssues(spec);
  assert.ok(issues.some(issue => issue.code === "flat_front_has_pleat"));
  assert.ok(!issues.some(issue => issue.code === "unknown_trouser_pleat_option"));
  assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
});

test("half-sleeve French and barrel cuffs require construction review, while an open hem does not", () => {
  for (const cuff of ["french_double_cuff", "barrel_cuff_1_button", "open_short_hem_cuff"]) {
    const spec = Object.freeze({
      shirt: Object.freeze({ type: "short_sleeve_shirt", collar: "spread_collar",
        wear: "untucked", sleeve: "half_sleeve", cuff }),
      pant: Object.freeze({ type: "formal_flat_front", pleat: "flat_front",
        hem: "plain_hem", break: "no_break" }),
    }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(spec);
    const issues = styleDirectorConstructionIssues(spec);
    assert.equal(issues.some(issue => issue.code === "short_sleeve_cuff_review"),
      cuff !== "open_short_hem_cuff", cuff);
    assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
    assert.equal(JSON.stringify(spec), snapshot);
  }
});

test("postposed blanket pleat refusal means flat-front construction", () => {
  const flat = Object.freeze({ pleat: "flat_front" });
  const pleated = Object.freeze({ pleat: "single_pleat_forward" });
  for (const wording of [
    "pleats aren't wanted",
    "pleats aren’t wanted",
    "pleating isn't wanted",
    "pleats are unwanted",
    "pleats not wanted",
    "pleats should not be selected",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, flat), [], wording);
    const first = styleDirectorCandidateFrontConstructionIssues(wording, pleated);
    assert.deepEqual(first.map(x => x.code), ["candidate_trouser_pleat_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, pleated), first);
  }
  const conflict = "pleats aren't wanted, but double pleats required";
  assert.equal(styleDirectorCandidateTrouserFront(conflict), "ambiguous");
  assert.ok(styleDirectorCandidateWordingIssues("plain shirt", conflict)
    .some(x => x.code === "ambiguous_candidate_trouser_front"));
  assert.equal(flat.pleat, "flat_front");
  assert.equal(pleated.pleat, "single_pleat_forward");
});

test("a postposed pleat-count ban rejects only that count", () => {
  for (const [wording, forbidden, permitted] of [
    ["double pleats aren't wanted", "double_pleat_forward", "single_pleat_forward"],
    ["double pleats should not be selected", "double_pleat_reverse", "single_pleat_forward"],
    ["single pleats aren't wanted", "single_pleat_reverse", "double_pleat_forward"],
    ["single pleats should not be selected", "single_pleat_forward", "double_pleat_forward"],
  ] as const) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    const locked = Object.freeze({ pleat: forbidden });
    const snapshot = JSON.stringify(locked);
    const first = styleDirectorCandidateFrontConstructionIssues(wording, locked);
    assert.deepEqual(first.map(x => x.code), ["candidate_trouser_pleat_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, locked), first);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording,
      Object.freeze({ pleat: permitted })), [], wording);
    assert.equal(JSON.stringify(locked), snapshot);
  }
});

test("contracted optional pleat wording is neutral without hiding positive instructions", () => {
  for (const wording of [
    "pleats aren't required",
    "pleats aren’t needed",
    "pleating isn't mandatory",
    "double pleats aren't required",
    "single pleats aren't necessary",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording,
      Object.freeze({ pleat: "flat_front" })), [], wording);
  }
  const mixed = "double pleats aren't required; single pleats required";
  assert.equal(styleDirectorCandidateTrouserFront(mixed), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(mixed,
    Object.freeze({ pleat: "single_pleat_forward" })), []);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(mixed,
    Object.freeze({ pleat: "double_pleat_forward" })).map(x => x.code),
    ["candidate_trouser_pleat_mismatch"]);
});
