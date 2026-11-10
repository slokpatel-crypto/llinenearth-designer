import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// An unverified saved hem is not evidence of a physically non-cropped hem.
// Its versioned-option review must not be replaced by an invented length claim.
test("missing or stale hem IDs do not prove cropped type/hem or break/hem mismatch", () => {
  for (const type of ["cropped_ankle", "formal_flat_front"] as const) {
    for (const hem of [undefined, null, "", "plain_hem ", "retired_hem"]) {
      const locked = Object.freeze({
        shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar",
          wear: "tucked", sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
        pant: Object.freeze({ type, pleat: "flat_front", rise: "mid_rise",
          waistband: "belt_loops", hem, break: "cropped_above_ankle" }),
      }) as unknown as StyleSpecV2;
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.equal(issues.filter(issue => issue.code === "unknown_versioned_option").length,
        hem === undefined ? 0 : 1, `${type}/${String(hem)}`);
      assert.ok(!issues.some(issue => issue.code === "cropped_type_hem_mismatch" ||
        issue.code === "cropped_break_hem_mismatch"),
        "unknown hem must not be interpreted as a known non-cropped hem");
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues, "deterministic replay");
      assert.equal(JSON.stringify(locked), before, "review must preserve saved options");
    }
  }
});

test("known ordinary and cropped hem IDs still receive their real construction checks", () => {
  for (const type of ["cropped_ankle", "formal_flat_front"] as const) {
    for (const hem of ["plain_hem", "cropped_above_ankle_hem"] as const) {
      const locked = Object.freeze({
        shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar",
          wear: "tucked", sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
        pant: Object.freeze({ type, pleat: "flat_front", rise: "mid_rise",
          waistband: "belt_loops", hem, break: "cropped_above_ankle" }),
      }) as unknown as StyleSpecV2;
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.equal(issues.some(issue => issue.code === "cropped_type_hem_mismatch"),
        type === "cropped_ankle" && hem === "plain_hem");
      assert.equal(issues.some(issue => issue.code === "cropped_break_hem_mismatch"),
        hem === "plain_hem");
      assert.ok(!issues.some(issue => issue.code === "unknown_versioned_option"));
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
      assert.equal(JSON.stringify(locked), before);
    }
  }
});
