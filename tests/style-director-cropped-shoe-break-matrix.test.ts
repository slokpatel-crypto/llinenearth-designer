import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2";

// A cropped garment cannot promise a shoe break requiring cloth at the shoe.
// Verify the construction matrix without inventing physical trouser lengths.
test("cropped hem and trouser type reject every incompatible shoe break without mutating locked IDs", () => {
  const conflicts = {
    full_break: "cropped_full_break",
    half_break: "cropped_half_break",
    slight_break: "cropped_slight_break",
    stacked_break: "cropped_stacked_break",
  } as const;
  for (const [breakId, expectedCode] of Object.entries(conflicts)) {
    for (const croppedField of ["type", "hem"] as const) {
      const pant = Object.freeze({
        type: croppedField === "type" ? "cropped_ankle" : "formal_flat_front",
        hem: croppedField === "hem" ? "cropped_above_ankle_hem" : "plain_hem",
        break: breakId,
        pleat: "flat_front",
      });
      const shirt = Object.freeze({});
      const spec = Object.freeze({ shirt, pant }) as unknown as Pick<StyleSpecV2, "shirt" | "pant">;
      const before = JSON.stringify(spec);
      const first = styleDirectorConstructionIssues(spec);
      assert.ok(first.some(issue => issue.code === expectedCode), `${croppedField}/${breakId}`);
      assert.deepEqual(styleDirectorConstructionIssues(spec), first);
      assert.equal(JSON.stringify(spec), before, "validation must never rewrite locked selections");
    }
  }
});
