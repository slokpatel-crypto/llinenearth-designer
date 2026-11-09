import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// A cropped hem is independent of trouser silhouette, but not of shoe break.
// Keep both truths when a customer locks a formal or pleated trouser.
test("formal and pleated cropped hems reject incompatible shoe breaks without changing silhouette", () => {
  const breaks = [
    ["full_break", "cropped_full_break"],
    ["half_break", "cropped_half_break"],
    ["slight_break", "cropped_slight_break"],
    ["stacked_break", "cropped_stacked_break"],
  ] as const;
  for (const [type, pleat] of [
    ["formal_flat_front", "flat_front"],
    ["pleated_trouser", "single_pleat"],
  ] as const) {
    for (const [shoeBreak, code] of breaks) {
      const locked = Object.freeze({
        shirt: Object.freeze({
          type: "dress_shirt", collar: "spread_collar", sleeve: "full_sleeve",
          cuff: "barrel_cuff_1_button", wear: "tucked",
        }),
        pant: Object.freeze({
          type, pleat, hem: "cropped_above_ankle_hem", break: shoeBreak,
        }),
      }) as unknown as StyleSpecV2;
      const snapshot = JSON.stringify(locked);
      const first = styleDirectorConstructionIssues(locked);
      assert.ok(first.some(issue => issue.code === code), `${type}/${shoeBreak}`);
      assert.ok(!first.some(issue => issue.code === "cropped_hem_type_mismatch"), type);
      assert.deepEqual(styleDirectorConstructionIssues(locked), first);
      assert.equal(JSON.stringify(locked), snapshot, "locked choices must remain unchanged");
    }
  }
});

test("matching above-ankle break remains permissible for formal and pleated hems", () => {
  for (const [type, pleat] of [
    ["formal_flat_front", "flat_front"],
    ["pleated_trouser", "single_pleat"],
  ] as const) {
    const locked = {
      shirt: { type: "dress_shirt", collar: "spread_collar",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button", wear: "tucked" },
      pant: { type, pleat, hem: "cropped_above_ankle_hem", break: "cropped_above_ankle" },
    } as unknown as StyleSpecV2;
    const issues = styleDirectorConstructionIssues(locked);
    assert.ok(!issues.some(issue => issue.code.startsWith("cropped_")), type);
  }
});
