import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// Pure locked-design regression: no physical measurements or inferred defaults.
test("missing and retired trouser fit IDs do not hide independent sleeve and cropped-break conflicts", () => {
  for (const [fit, invalid] of [
    [undefined, false], [null, true], ["retired_trouser_fit", true],
    ["barrel_cuff_1_button", true],
  ] as const) {
    const shirt = Object.freeze({
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "half_sleeve", cuff: "french_double_cuff",
    });
    const pant: Record<string, unknown> = {
      type: "cropped_ankle", pleat: "flat_front",
      hem: "plain_hem", break: "stacked_break",
    };
    if (fit !== undefined) pant.fit = fit;
    Object.freeze(pant);
    const locked = Object.freeze({ shirt, pant }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(locked);
    const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
    const first = review();
    assert.equal(first.includes("unknown_versioned_option"), invalid);
    for (const code of [
      "short_sleeve_double_cuff", "cropped_type_hem_mismatch", "cropped_stacked_break",
    ]) assert.ok(first.includes(code), "fit uncertainty concealed " + code);
    assert.deepEqual(review(), first);
    assert.equal(JSON.stringify(locked), snapshot);
  }
});
