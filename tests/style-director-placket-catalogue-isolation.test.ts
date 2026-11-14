import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

/**
 * Persisted placket IDs are independent of sleeve and trouser construction.
 * Catalogue uncertainty must never erase a separately provable conflict.
 */
test("stale and absent plackets do not mask independent garment construction", () => {
  for (const [placket, suppliedInvalid] of [
    [undefined, false],
    [null, true],
    ["retired_placket", true],
    ["french_double_cuff", true],
    ["", true],
  ] as const) {
    const shirt: Record<string, unknown> = {
      type: "dress_shirt",
      collar: "spread_collar",
      wear: "tucked",
      sleeve: "half_sleeve",
      cuff: "french_double_cuff",
    };
    if (placket !== undefined) shirt.placket = placket;
    const pant = {
      type: "cropped_ankle",
      pleat: "flat_front",
      hem: "plain_hem",
      break: "stacked_break",
    };
    const locked = Object.freeze({
      shirt: Object.freeze(shirt),
      pant: Object.freeze(pant),
    }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(locked);
    const review = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
    const first = review();
    assert.equal(first.includes("unknown_versioned_option"), suppliedInvalid,
      "only an explicitly invalid placket should require catalogue review");
    for (const code of [
      "short_sleeve_double_cuff",
      "cropped_type_hem_mismatch",
      "cropped_stacked_break",
    ]) {
      assert.ok(first.includes(code), "placket uncertainty must not hide " + code);
    }
    assert.deepEqual(review(), first, "review must be deterministic");
    assert.equal(JSON.stringify(locked), snapshot, "review must preserve locked IDs");
  }
});
