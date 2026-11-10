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
    assert.equal(issues.filter(issue => issue.code === "unknown_trouser_pleat_option").length, 1);
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
