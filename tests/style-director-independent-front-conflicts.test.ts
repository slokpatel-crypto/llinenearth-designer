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
