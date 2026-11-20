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
