import test from "node:test";
import assert from "node:assert/strict";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

function lockedSpec(type: string, pleat: unknown): StyleSpecV2 {
  return Object.freeze({
    shirt: Object.freeze({
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "full_sleeve", cuff: "barrel_cuff_1_button",
    }),
    pant: Object.freeze({
      type, pleat, hem: "plain_hem", break: "no_break",
    }),
  }) as unknown as StyleSpecV2;
}

test("high-rise double-pleat trouser requires a canonical two-pleat construction", () => {
  const catalogue = optionsFor("pant.pleat");
  assert.deepEqual(catalogue.map(item => item.parameters.pleatCount).sort(),
    [0, 1, 1, 2, 2], "the source catalogue must expose its pleat counts");

  for (const option of catalogue) {
    const locked = lockedSpec("double_pleat_high_rise", option.id);
    const before = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    const mismatch = issues.filter(issue => issue.code === "double_pleat_type_mismatch");
    assert.equal(mismatch.length, option.parameters.pleatCount === 2 ? 0 : 1,
      `${option.id}: the named garment type must have two real pleats`);
    assert.ok(!issues.some(issue => issue.code === "unknown_trouser_pleat_option"),
      `${option.id}: a canonical pleat is always recognized`);
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues, "deterministic replay");
    assert.equal(JSON.stringify(locked), before, "never rewrite a locked garment");
  }
});

test("missing, stale and forged pleat IDs remain unknown, not fabricated double-pleat construction", () => {
  for (const pleat of [undefined, null, "", "single_pleat", "double_pleat_forward "]) {
    const locked = lockedSpec("double_pleat_high_rise", pleat);
    const before = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.equal(issues.filter(issue => issue.code === "unknown_trouser_pleat_option").length,
      pleat === undefined ? 0 : 1, "missing fields are checked by the full parser; supplied invalid IDs fail closed");
    assert.ok(!issues.some(issue => issue.code === "double_pleat_type_mismatch"),
      "a nonexistent option must not establish a real pleat count");
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
    assert.equal(JSON.stringify(locked), before);
  }
});

test("double-pleat type review never contaminates other trouser types", () => {
  for (const type of ["formal_flat_front", "pleated_trouser", "cropped_ankle"] as const) {
    const locked = lockedSpec(type, "single_pleat_forward");
    const issues = styleDirectorConstructionIssues(locked);
    assert.ok(!issues.some(issue => issue.code === "double_pleat_type_mismatch"), type);
  }
});

test("named high-rise double-pleat type respects real catalogue rise IDs", () => {
  const validRises = ["high_rise", "extra_high_rise"] as const;
  const lowerRises = ["low_rise", "mid_rise"] as const;
  for (const rise of [...validRises, ...lowerRises]) {
    assert.ok(optionsFor("pant.rise").some(option => option.id === rise),
      rise + ": rise choice must exist in the versioned catalogue");
    for (const pleat of ["double_pleat_forward", "double_pleat_reverse"]) {
      const base = lockedSpec("double_pleat_high_rise", pleat);
      const locked = Object.freeze({
        shirt: base.shirt, pant: Object.freeze({ ...base.pant, rise }),
      }) as StyleSpecV2;
      const snapshot = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.equal(issues.filter(issue => issue.code === "high_rise_type_mismatch").length,
        lowerRises.includes(rise as typeof lowerRises[number]) ? 1 : 0, rise);
      assert.ok(!issues.some(issue => issue.code === "double_pleat_type_mismatch"),
        "matching double pleats must not depend on rise review");
      assert.ok(!issues.some(issue => issue.code === "unknown_versioned_option"), rise);
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
      assert.equal(JSON.stringify(locked), snapshot, "locked rise and pleat IDs stay unchanged");
    }
  }
});

test("missing and stale rise IDs do not fabricate a verified lower-rise construction", () => {
  for (const rise of [undefined, null, "", "high_rise ", "obsolete_low_rise"]) {
    const base = lockedSpec("double_pleat_high_rise", "double_pleat_forward");
    const locked = Object.freeze({
      shirt: base.shirt, pant: Object.freeze({ ...base.pant, rise }),
    }) as unknown as StyleSpecV2;
    const before = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.equal(issues.filter(issue => issue.code === "high_rise_type_mismatch").length, 0,
      "unrecognized rise cannot establish a physical mismatch");
    assert.equal(issues.filter(issue => issue.code === "unknown_versioned_option").length,
      rise === undefined ? 0 : 1, "invalid saved rise must remain reviewable");
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
    assert.equal(JSON.stringify(locked), before);
  }
});

test("independent low-rise and missing-double-pleat conflicts both reach review", () => {
  const base = lockedSpec("double_pleat_high_rise", "flat_front");
  const locked = Object.freeze({
    shirt: base.shirt, pant: Object.freeze({ ...base.pant, rise: "low_rise" }),
  }) as StyleSpecV2;
  const before = JSON.stringify(locked);
  const issues = styleDirectorConstructionIssues(locked);
  assert.equal(issues.filter(issue => issue.code === "high_rise_type_mismatch").length, 1);
  assert.equal(issues.filter(issue => issue.code === "double_pleat_type_mismatch").length, 1);
  assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
  assert.equal(JSON.stringify(locked), before);
  const ordinary = lockedSpec("pleated_trouser", "double_pleat_forward");
  const withoutNamedRise = Object.freeze({
    shirt: ordinary.shirt, pant: Object.freeze({ ...ordinary.pant, rise: "mid_rise" }),
  }) as StyleSpecV2;
  assert.ok(!styleDirectorConstructionIssues(withoutNamedRise)
    .some(issue => issue.code === "high_rise_type_mismatch"),
    "ordinary pleated trouser must not inherit named high-rise restrictions");
});
