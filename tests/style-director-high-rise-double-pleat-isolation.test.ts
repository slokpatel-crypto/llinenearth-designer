import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

/**
 * A named double-pleat/high-rise trouser makes two separate construction
 * claims. A stale ID in either field must not suppress review of the other.
 */
test("high-rise double-pleat type checks rise and pleat independently", () => {
  for (const [rise, pleat, expectedUnknown] of [
    ["mid_rise", "flat_front", false],
    ["retired_rise", "flat_front", true],
    ["mid_rise", "retired_pleat", true],
    ["retired_rise", "retired_pleat", true],
  ] as const) {
    const pant = Object.freeze({
      type: "double_pleat_high_rise", rise, pleat,
      waistband: "extended_tab", hem: "plain_hem", break: "no_break",
    });
    const locked = Object.freeze({
      shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
      pant,
    }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(locked);
    const codes = () => styleDirectorConstructionIssues(locked).map(issue => issue.code);
    const actual = codes();
    assert.equal(actual.includes("unknown_versioned_option"), rise === "retired_rise",
      "only a stale rise is unknown in the generic catalogue gate");
    assert.equal(actual.includes("unknown_trouser_pleat_option"), pleat === "retired_pleat");
    assert.equal(actual.includes("high_rise_type_mismatch"), rise === "mid_rise");
    assert.equal(actual.includes("double_pleat_type_mismatch"), pleat === "flat_front");
    assert.deepEqual(codes(), actual, "independent reviews must be deterministic");
    assert.equal(JSON.stringify(locked), snapshot, "never rewrite a locked selection");
  }
});

test("valid high-rise double pleats retain their canonical selections", () => {
  const locked = Object.freeze({
    shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar",
      sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
    pant: Object.freeze({
      type: "double_pleat_high_rise", rise: "high_rise",
      pleat: "double_pleat_forward", waistband: "extended_tab",
      hem: "plain_hem", break: "no_break",
    }),
  }) as unknown as StyleSpecV2;
  const snapshot = JSON.stringify(locked);
  assert.deepEqual(styleDirectorConstructionIssues(locked), [],
    "a buildable double-pleat/high-rise selection must not be rejected");
  assert.equal(JSON.stringify(locked), snapshot);
});
