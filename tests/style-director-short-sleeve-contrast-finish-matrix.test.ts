import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// A decorative contrast-cuff request cannot certify an open short-sleeve hem.
// Keep both the locked sleeve-end construction and finish unchanged for review.
test("white contrast cuff finish requires sleeve-end construction review", () => {
  for (const collarFinish of [
    "Self-fabric", "White contrast collar", "White contrast collar + cuffs",
  ] as const) {
    const locked = Object.freeze({
      shirt: Object.freeze({
        type: "short_sleeve_shirt", collar: "spread_collar",
        wear: "untucked", sleeve: "half_sleeve",
        cuff: "open_short_hem_cuff", collarFinish,
      }),
      pant: Object.freeze({
        type: "formal_flat_front", pleat: "flat_front",
        hem: "plain_hem", break: "slight_break",
      }),
    }) as unknown as StyleSpecV2;
    const before = JSON.stringify(locked);
    const first = styleDirectorConstructionIssues(locked);
    assert.equal(first.some(issue => issue.code === "short_sleeve_contrast_cuff_finish"),
      collarFinish === "White contrast collar + cuffs", collarFinish);
    assert.deepEqual(styleDirectorConstructionIssues(locked), first, "deterministic replay");
    assert.equal(JSON.stringify(locked), before, "locked garment must not change");
  }
});
