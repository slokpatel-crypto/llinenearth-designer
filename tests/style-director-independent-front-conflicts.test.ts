import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// A stale saved sleeve ID must never suppress independent trouser construction
// findings. These are pure reviews: neither garment may be silently repaired.
const makeSpec = (sleeve: string, pantType: string, pleat: string): StyleSpecV2 => ({
  shirt: {
    type: "dress_shirt", collar: "spread_collar", wear: "tucked",
    sleeve, cuff: "barrel_cuff_1_button",
  },
  pant: {
    type: pantType, pleat, hem: "plain_hem", break: "slight_break",
  },
} as StyleSpecV2);

test("stale sleeve IDs cannot mask independent front-construction conflicts", () => {
  const cases = [
    ["formal_flat_front", "single_pleat_forward", "flat_front_has_pleat"],
    ["formal_flat_front", "double_pleat_reverse", "flat_front_has_pleat"],
    ["pleated_trouser", "flat_front", "pleated_front_missing_pleat"],
  ] as const;
  for (const sleeve of ["full_sleeve", "half_sleeve", "retired_sleeve"] as const) {
    for (const [pantType, pleat, expected] of cases) {
      const locked = makeSpec(sleeve, pantType, pleat);
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.ok(issues.some(issue => issue.code === expected),
        `${sleeve}/${pantType}/${pleat}: missing independent trouser finding`);
      if (sleeve === "retired_sleeve") {
        assert.ok(issues.some(issue => issue.code === "unknown_versioned_option"),
          "retired sleeve must be reviewed rather than normalized");
      }
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues,
        "pure construction review must be repeatable");
      assert.equal(JSON.stringify(locked), before, "locked garment IDs must not mutate");
    }
  }
});

test("stale collar and cuff IDs do not conceal independent pleat construction findings", () => {
  for (const [collar, cuff] of [
    ["spread_collar", "barrel_cuff_1_button"],
    ["retired_collar", "barrel_cuff_1_button"],
    ["spread_collar", "retired_cuff"],
    ["retired_collar", "retired_cuff"],
  ] as const) {
    const locked = makeSpec("full_sleeve", "formal_flat_front", "single_pleat_forward");
    locked.shirt.collar = collar;
    locked.shirt.cuff = cuff;
    const before = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.ok(issues.some(issue => issue.code === "flat_front_has_pleat"),
      "front construction must be reviewed regardless of unrelated stale IDs");
    if (collar.startsWith("retired_") || cuff.startsWith("retired_")) {
      assert.ok(issues.some(issue => issue.code === "unknown_versioned_option"),
        "retired saved IDs must remain visible for review");
    }
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
    assert.equal(JSON.stringify(locked), before);
  }
});

test("independent waistband and rise mismatches survive a stale sleeve selection", () => {
  const cases = [
    { type: "double_pleat_high_rise", pleat: "double_pleat_reverse", rise: "low_rise", waistband: "extended_tab", expected: "high_rise_type_mismatch" },
    { type: "bespoke_side_adjuster", pleat: "flat_front", rise: "mid_rise", waistband: "belt_loops", expected: "side_adjuster_type_mismatch" },
    { type: "gurkha", pleat: "flat_front", rise: "mid_rise", waistband: "belt_loops", expected: "gurkha_tab_waistband_mismatch" },
    { type: "linen_drawstring", pleat: "flat_front", rise: "mid_rise", waistband: "belt_loops", expected: "linen_drawstring_waistband_mismatch" },
  ] as const;
  for (const scenario of cases) {
    for (const sleeve of ["full_sleeve", "retired_sleeve"] as const) {
      const locked = makeSpec(sleeve, scenario.type, scenario.pleat);
      locked.pant.rise = scenario.rise;
      locked.pant.waistband = scenario.waistband;
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.ok(issues.some(issue => issue.code === scenario.expected),
        `${scenario.type}/${sleeve}: independent construction mismatch was hidden`);
      if (sleeve === "retired_sleeve") {
        assert.ok(issues.some(issue => issue.code === "unknown_versioned_option"));
      }
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
      assert.equal(JSON.stringify(locked), before);
    }
  }
});

test("cropped hem and stacked shoe break remain independently reviewable with stale shirt IDs", () => {
  for (const sleeve of ["full_sleeve", "retired_sleeve"] as const) {
    for (const pantType of ["cropped_ankle", "formal_flat_front"] as const) {
      const locked = makeSpec(sleeve, pantType, "flat_front");
      locked.pant.hem = "cropped_above_ankle_hem";
      locked.pant.break = "stacked_break";
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.ok(issues.some(issue => issue.code === "cropped_stacked_break"),
        `${pantType}/${sleeve}: cropped hem cannot support stacked shoe break`);
      if (sleeve === "retired_sleeve") {
        assert.ok(issues.some(issue => issue.code === "unknown_versioned_option"));
      }
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
      assert.equal(JSON.stringify(locked), before);
    }
  }
});

test("independent trouser construction conflicts accumulate without repairing frozen saved IDs", () => {
  for (const sleeve of ["full_sleeve", "retired_sleeve"] as const) {
    for (const pantType of ["formal_flat_front", "pleated_trouser"] as const) {
      const pantPleat = pantType === "formal_flat_front" ? "single_pleat_forward" : "flat_front";
      const frontCode = pantType === "formal_flat_front" ? "flat_front_has_pleat" : "pleated_front_missing_pleat";
      const spec = makeSpec(sleeve, pantType, pantPleat);
      spec.pant.hem = "cropped_above_ankle_hem";
      spec.pant.break = "stacked_break";
      Object.freeze(spec.shirt);
      Object.freeze(spec.pant);
      Object.freeze(spec);
      const first = styleDirectorConstructionIssues(spec);
      const codes = first.map(issue => issue.code);
      assert.ok(codes.includes(frontCode), `${sleeve}/${pantType}: front mismatch missing`);
      assert.ok(codes.includes("cropped_stacked_break"),
        `${sleeve}/${pantType}: independent shoe-break mismatch missing`);
      assert.equal(codes.includes("unknown_versioned_option"), sleeve === "retired_sleeve");
      assert.deepEqual(styleDirectorConstructionIssues(spec), first,
        "reviewing a frozen locked design must be deterministic");
      assert.equal(spec.shirt.sleeve, sleeve);
      assert.equal(spec.pant.pleat, pantPleat);
      assert.equal(spec.pant.break, "stacked_break");
    }
  }
});


test("multiple stale shirt options cannot suppress simultaneous independent trouser faults", () => {
  for (const pantType of ["formal_flat_front", "pleated_trouser"] as const) {
    const pleat = pantType === "formal_flat_front" ? "double_pleat_reverse" : "flat_front";
    const expectedFront = pantType === "formal_flat_front"
      ? "flat_front_has_pleat" : "pleated_front_missing_pleat";
    const spec = makeSpec("retired_sleeve", pantType, pleat);
    spec.shirt.collar = "retired_collar";
    spec.shirt.cuff = "retired_cuff";
    spec.pant.hem = "cropped_above_ankle_hem";
    spec.pant.break = "stacked_break";
    const original = JSON.stringify(spec);
    Object.freeze(spec.shirt);
    Object.freeze(spec.pant);
    Object.freeze(spec);
    const first = styleDirectorConstructionIssues(spec);
    const codes = first.map(issue => issue.code);
    for (const code of ["unknown_versioned_option", expectedFront, "cropped_stacked_break"]) {
      assert.ok(codes.includes(code), `${pantType}: missing ${code}`);
    }
    assert.deepEqual(styleDirectorConstructionIssues(spec), first);
    assert.equal(JSON.stringify(spec), original, "frozen saved garment must remain untouched");
  }
});

test("three independent trouser faults survive retired collar cuff and sleeve IDs", () => {
  for (const sleeve of ["full_sleeve", "retired_sleeve"] as const) {
    const spec = makeSpec(sleeve, "double_pleat_high_rise", "flat_front");
    spec.shirt.collar = "retired_collar";
    spec.shirt.cuff = "retired_cuff";
    spec.pant.rise = "low_rise";
    spec.pant.hem = "cropped_above_ankle_hem";
    spec.pant.break = "stacked_break";
    const original = JSON.stringify(spec);
    Object.freeze(spec.shirt);
    Object.freeze(spec.pant);
    Object.freeze(spec);
    const first = styleDirectorConstructionIssues(spec);
    const codes = first.map(issue => issue.code);
    for (const expected of [
      "unknown_versioned_option",
      "high_rise_type_mismatch",
      "cropped_stacked_break",
    ]) {
      assert.ok(codes.includes(expected), `${sleeve}: missing ${expected}`);
    }
    assert.deepEqual(styleDirectorConstructionIssues(spec), first);
    assert.equal(JSON.stringify(spec), original);
  }
});
