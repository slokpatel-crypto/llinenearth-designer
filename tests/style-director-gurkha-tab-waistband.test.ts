import test from "node:test";
import assert from "node:assert/strict";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";
import styleVariants from "../src/lib/garment-viewer-style-variants.json" with { type: "json" };

function lockedSpec(type: string, waistband: unknown, pantOverride: Record<string, unknown> = {}): StyleSpecV2 {
  return Object.freeze({
    shirt: Object.freeze({
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "full_sleeve", cuff: "barrel_cuff_1_button",
    }),
    pant: Object.freeze({
      type, pleat: "double_pleat_forward", rise: "high_rise",
      waistband, hem: "plain_hem", break: "no_break", ...pantOverride,
    }),
  }) as unknown as StyleSpecV2;
}

test("Gurkha preset requires an approved extended-tab waistband, without changing a locked design", () => {
  assert.equal(styleVariants.trouserTypes.find(item => item.id === "gurkha")?.preset.waistband,
    "extended_tab", "review rule must match the actual shipped Gurkha preset");
  const waistbands = optionsFor("pant.waistband");
  assert.ok(waistbands.some(option => option.id === "extended_tab" &&
    option.parameters.extendedTab === true), "extended-tab option must be canonical");
  assert.ok(waistbands.length > 1);
  for (const option of waistbands) {
    const saved = lockedSpec("gurkha", option.id);
    const before = JSON.stringify(saved);
    const issues = styleDirectorConstructionIssues(saved);
    assert.equal(issues.filter(issue => issue.code === "gurkha_tab_waistband_mismatch").length,
      option.id === "extended_tab" ? 0 : 1, option.id);
    assert.ok(!issues.some(issue => issue.code === "unknown_versioned_option"),
      "canonical waistband must not be treated as unknown: " + option.id);
    assert.deepEqual(styleDirectorConstructionIssues(saved), issues, "deterministic replay");
    assert.equal(JSON.stringify(saved), before, "locked option IDs must remain unchanged");
  }
});

test("missing and obsolete Gurkha waistband IDs remain unverified rather than fabricating a tab", () => {
  for (const waistband of [undefined, null, "", "extended_tab ", "unknown_tab", "gurkha_buckle"]) {
    const saved = lockedSpec("gurkha", waistband);
    const snapshot = JSON.stringify(saved);
    const issues = styleDirectorConstructionIssues(saved);
    assert.equal(issues.filter(issue => issue.code === "gurkha_tab_waistband_mismatch").length,
      0, "unknown ID cannot establish a real missing-tab construction");
    assert.equal(issues.filter(issue => issue.code === "unknown_versioned_option").length,
      waistband === undefined ? 0 : 1, "supplied invalid IDs require independent review");
    assert.deepEqual(styleDirectorConstructionIssues(saved), issues);
    assert.equal(JSON.stringify(saved), snapshot);
  }
});

test("Gurkha tab review stays independent from hem length and other trouser types", () => {
  const otherTypes = ["formal_flat_front", "pleated_trouser", "bespoke_side_adjuster", "double_pleat_high_rise"];
  for (const type of otherTypes) {
    const saved = lockedSpec(type, "belt_loops");
    assert.ok(!styleDirectorConstructionIssues(saved).some(issue =>
      issue.code === "gurkha_tab_waistband_mismatch"), type);
  }
  const saved = lockedSpec("gurkha", "belt_loops", {
    hem: "cropped_above_ankle_hem", break: "full_break",
  });
  const before = JSON.stringify(saved);
  const issues = styleDirectorConstructionIssues(saved);
  assert.equal(issues.filter(issue => issue.code === "gurkha_tab_waistband_mismatch").length, 1);
  assert.equal(issues.filter(issue => issue.code === "cropped_full_break").length, 1,
    "an independent length contradiction must not be hidden by waistband review");
  assert.deepEqual(styleDirectorConstructionIssues(saved), issues);
  assert.equal(JSON.stringify(saved), before);
});
