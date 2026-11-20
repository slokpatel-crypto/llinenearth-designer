import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

function locked(type: unknown, collar: unknown, wear: unknown = "untucked"): StyleSpecV2 {
  return Object.freeze({
    shirt: Object.freeze({ type, collar, wear, sleeve: "full_sleeve",
      cuff: "barrel_cuff_1_button", placket: "standard_visible_placket" }),
    pant: Object.freeze({ type: "formal_flat_front", pleat: "flat_front", rise: "mid_rise",
      waistband: "belt_loops", hem: "plain_hem", break: "no_break" }),
  }) as unknown as StyleSpecV2;
}

test("unknown collar IDs cannot prove mismatched camp or band collar construction", () => {
  for (const type of ["camp_collar_resort", "band_collar_shirt"] as const) {
    for (const collar of [undefined, null, "", "point_standard_collar ", "retired_collar"]) {
      const spec = locked(type, collar);
      const before = JSON.stringify(spec);
      const issues = styleDirectorConstructionIssues(spec);
      assert.equal(issues.filter(issue => issue.code === "unknown_versioned_option").length,
        collar === undefined ? 0 : 1, `${type}/${String(collar)}`);
      assert.ok(!issues.some(issue => issue.code === "camp_collar_construction" ||
        issue.code === "band_collar_construction"),
        "unverified collar is not a confirmed known contrasting construction");
      assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
      assert.equal(JSON.stringify(spec), before);
    }
  }
});

test("unknown shirt type IDs cannot prove named collar belongs to another type", () => {
  for (const collar of ["cuban_camp_collar", "mandarin_band_collar"] as const) {
    for (const type of [undefined, null, "", "dress_shirt ", "retired_shirt_type"]) {
      const spec = locked(type, collar);
      const before = JSON.stringify(spec);
      const issues = styleDirectorConstructionIssues(spec);
      assert.equal(issues.filter(issue => issue.code === "unknown_versioned_option").length,
        type === undefined ? 0 : 1);
      assert.ok(!issues.some(issue => issue.code === "camp_collar_type_mismatch" ||
        issue.code === "band_collar_type_mismatch"),
        "unverified type is not evidence of a known different construction");
      assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
      assert.equal(JSON.stringify(spec), before);
    }
  }
});

test("known mismatched shirt IDs still demand construction review", () => {
  for (const [type, collar, code] of [
    ["camp_collar_resort", "point_standard_collar", "camp_collar_construction"],
    ["band_collar_shirt", "spread_collar", "band_collar_construction"],
    ["dress_shirt", "cuban_camp_collar", "camp_collar_type_mismatch"],
    ["dress_shirt", "mandarin_band_collar", "band_collar_type_mismatch"],
  ] as const) {
    const spec = locked(type, collar);
    const before = JSON.stringify(spec);
    const issues = styleDirectorConstructionIssues(spec);
    assert.ok(issues.some(issue => issue.code === code), `${type}/${collar}`);
    assert.ok(!issues.some(issue => issue.code === "unknown_versioned_option"));
    assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
    assert.equal(JSON.stringify(spec), before);
  }
});

test("independent known camp wear mismatch remains visible with an unknown collar", () => {
  for (const collar of [undefined, "retired_collar"]) {
    const spec = locked("camp_collar_resort", collar, "tucked");
    const issues = styleDirectorConstructionIssues(spec);
    assert.equal(issues.filter(issue => issue.code === "camp_collar_construction").length, 1);
    assert.deepEqual(styleDirectorConstructionIssues(spec), issues);
  }
});
