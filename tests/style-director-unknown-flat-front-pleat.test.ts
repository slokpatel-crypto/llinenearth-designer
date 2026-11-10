import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

test("unknown flat-front pleat IDs require vocabulary review, not fabricated physical pleats", () => {
  for (const pleat of [undefined, null, "", "flat_front ", "obsolete_double_pleat"]) {
    const spec = Object.freeze({
      shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
        sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
      pant: Object.freeze({ type: "formal_flat_front", pleat, hem: "plain_hem",
        break: "no_break" }),
    }) as unknown as StyleSpecV2;
    const snapshot = JSON.stringify(spec);
    const issues = styleDirectorConstructionIssues(spec);
    assert.equal(issues.filter(issue => issue.code === "unknown_trouser_pleat_option").length, 1);
    assert.ok(!issues.some(issue => issue.code === "flat_front_has_pleat"),
      "an unknown ID cannot establish that a real pleat exists");
    assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
    assert.equal(JSON.stringify(spec), snapshot);
  }
});

test("known pleated front on a flat-front trouser still requires construction review", () => {
  const spec = Object.freeze({
    shirt: Object.freeze({ type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "full_sleeve", cuff: "barrel_cuff_1_button" }),
    pant: Object.freeze({ type: "formal_flat_front", pleat: "single_pleat",
      hem: "plain_hem", break: "no_break" }),
  }) as unknown as StyleSpecV2;
  const issues = styleDirectorConstructionIssues(spec);
  assert.ok(issues.some(issue => issue.code === "flat_front_has_pleat"));
  assert.ok(!issues.some(issue => issue.code === "unknown_trouser_pleat_option"));
  assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
});
