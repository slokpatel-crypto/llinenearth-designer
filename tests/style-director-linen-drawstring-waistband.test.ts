import test from "node:test";
import assert from "node:assert/strict";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";
import variants from "../src/lib/garment-viewer-style-variants.json" with { type: "json" };

function lockedSpec(type: string, waistband: unknown): StyleSpecV2 {
  return Object.freeze({
    shirt: Object.freeze({
      type: "dress_shirt", collar: "spread_collar", cuff: "barrel_cuff_1_button",
      sleeve: "full_sleeve", wear: "tucked",
    }),
    pant: Object.freeze({
      type, pleat: "flat_front", rise: "mid_rise", waistband,
      hem: "plain_hem", break: "no_break",
    }),
  }) as unknown as StyleSpecV2;
}

test("linen drawstring preset requires its canonical drawstring waistband", () => {
  assert.equal(variants.trouserTypes.find(item => item.id === "linen_drawstring")?.preset.waistband,
    "drawstring", "rule must track the actual named trouser preset");
  const waistbands = optionsFor("pant.waistband");
  assert.ok(waistbands.some(item => item.id === "drawstring_elastic"));
  assert.ok(waistbands.some(item => item.id !== "drawstring_elastic"));
  for (const option of waistbands) {
    const spec = lockedSpec("linen_drawstring", option.id);
    const before = JSON.stringify(spec);
    const issues = styleDirectorConstructionIssues(spec);
    assert.equal(
      issues.filter(issue => issue.code === "linen_drawstring_waistband_mismatch").length,
      option.id === "drawstring_elastic" ? 0 : 1,
      option.id,
    );
    assert.ok(!issues.some(issue => issue.code === "unknown_versioned_option"),
      "a catalogue waistband must never be unknown: " + option.id);
    assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
    assert.equal(JSON.stringify(spec), before, "locked selections must not change");
  }
});

test("unrecognised and missing drawstring waistband IDs remain unverified", () => {
  for (const waistband of [undefined, null, "", "drawstring_elastic ", "outdated_drawstring"]) {
    const spec = lockedSpec("linen_drawstring", waistband);
    const before = JSON.stringify(spec);
    const issues = styleDirectorConstructionIssues(spec);
    assert.ok(!issues.some(issue => issue.code === "linen_drawstring_waistband_mismatch"),
      "unknown construction cannot establish a verified non-drawstring waist");
    assert.equal(issues.filter(issue => issue.code === "unknown_versioned_option").length,
      waistband === undefined ? 0 : 1, "supplied invalid options require review");
    assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
    assert.equal(JSON.stringify(spec), before);
  }
});

test("drawstring requirement does not leak to other trouser types", () => {
  for (const type of ["formal_flat_front", "pleated_trouser", "gurkha", "cargo_trouser"]) {
    const spec = lockedSpec(type, "belt_loops");
    const issues = styleDirectorConstructionIssues(spec);
    assert.ok(!issues.some(issue => issue.code === "linen_drawstring_waistband_mismatch"), type);
    assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
  }
});
