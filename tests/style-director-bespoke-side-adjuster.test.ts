import test from "node:test";
import assert from "node:assert/strict";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

function lockedSpec(type: string, waistband: unknown): StyleSpecV2 {
  return Object.freeze({
    shirt: Object.freeze({
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "full_sleeve", cuff: "barrel_cuff_1_button",
    }),
    pant: Object.freeze({
      type, pleat: "single_pleat_forward", rise: "high_rise",
      waistband, hem: "plain_hem", break: "slight_break",
    }),
  }) as unknown as StyleSpecV2;
}

test("bespoke side-adjuster trouser accepts both canonical side-adjuster waistband types", () => {
  const allowed = new Set(["side_adjuster_tabs", "adjuster_tabs_no_belt"]);
  const catalogue = optionsFor("pant.waistband").map(option => option.id);
  assert.ok(catalogue.length > allowed.size, "must cover incompatible waistbands");
  for (const id of allowed) {
    assert.ok(catalogue.includes(id), id + ": approved side-adjuster ID must be in the catalogue");
  }
  for (const waistband of catalogue) {
    const locked = lockedSpec("bespoke_side_adjuster", waistband);
    const before = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.equal(issues.filter(issue => issue.code === "side_adjuster_type_mismatch").length,
      allowed.has(waistband) ? 0 : 1, waistband);
    assert.ok(!issues.some(issue => issue.code === "unknown_versioned_option"),
      waistband + ": an actual catalogue ID must not be marked unknown");
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues, "deterministic replay");
    assert.equal(JSON.stringify(locked), before, "saved ID must not be rewritten");
  }
});

test("unlisted or missing waistbands are not misreported as verified non-adjusters", () => {
  for (const waistband of [undefined, null, "", "side_adjuster_tabs ", "unknown_side_adjuster"]) {
    const locked = lockedSpec("bespoke_side_adjuster", waistband);
    const before = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.ok(!issues.some(issue => issue.code === "side_adjuster_type_mismatch"),
      "unrecognised or missing IDs do not establish the physical waistband construction");
    assert.equal(issues.filter(issue => issue.code === "unknown_versioned_option").length,
      waistband === undefined ? 0 : 1,
      "invalid supplied IDs require review; missing fields are handled by the full locked-spec parser");
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
    assert.equal(JSON.stringify(locked), before);
  }
});

test("side-adjuster requirement does not impose a bespoke waist on other trouser types", () => {
  for (const type of ["formal_flat_front", "pleated_trouser", "cropped_ankle", "double_pleat_high_rise"]) {
    const locked = lockedSpec(type, "belt_loops");
    const issues = styleDirectorConstructionIssues(locked);
    assert.ok(!issues.some(issue => issue.code === "side_adjuster_type_mismatch"), type);
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
  }
});
