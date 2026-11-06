import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorConstructionIssues,
  styleDirectorProposedCroppedHem,
} from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// A photo's cropped-length label is not permission to alter a saved hem.
// Every footwear break incompatible with a cropped hem must remain review-only.
test("cropped trouser length conflicts are deterministic and non-destructive", () => {
  const conflictingBreaks = [
    ["full_break", "cropped_full_break"],
    ["half_break", "cropped_half_break"],
    ["slight_break", "cropped_slight_break"],
    ["stacked_break", "cropped_stacked_break"],
  ] as const;
  for (const [shoeBreak, expectedCode] of conflictingBreaks) {
    const locked = {
      shirt: { type: "dress_shirt", collar: "spread_collar", wear: "tucked",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" },
      pant: { type: "cropped_ankle", pleat: "flat_front",
        hem: "cropped_above_ankle_hem", break: shoeBreak },
    } as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(locked);
    const first = styleDirectorConstructionIssues(locked);
    assert.ok(first.some(issue => issue.code === expectedCode), shoeBreak);
    assert.deepEqual(styleDirectorConstructionIssues(locked), first, shoeBreak);
    assert.equal(styleDirectorProposedCroppedHem(locked.pant), null, shoeBreak);
    assert.equal(JSON.stringify(locked), snapshot, "saved IDs must not be rewritten");
  }
});

test("matching cropped proposal is a suggestion, never a locked-design mutation", () => {
  const pant = { type: "cropped_ankle", break: "cropped_above_ankle",
    hem: "plain_hem" } as const;
  const original = JSON.stringify(pant);
  assert.equal(styleDirectorProposedCroppedHem(pant), "cropped_above_ankle_hem");
  assert.equal(JSON.stringify(pant), original);
  assert.equal(styleDirectorProposedCroppedHem({
    type: "formal_flat_front", break: "cropped_above_ankle",
  }), null);
});
