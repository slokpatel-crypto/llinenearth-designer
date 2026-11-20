import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

test("retired cuff and sleeve IDs cannot suppress independent pleated-front review", () => {
  for (const cuff of ["barrel_cuff_1_button", "retired_cuff_id"]) {
    for (const sleeve of ["full_sleeve", "retired_sleeve_id"]) {
      for (const pleat of ["flat_front", "single_pleat_forward"]) {
        const locked = Object.freeze({
          shirt: Object.freeze({
            type: "dress_shirt", collar: "spread_collar", wear: "tucked",
            sleeve, cuff,
          }),
          pant: Object.freeze({
            type: "pleated_trouser", pleat, hem: "plain_hem", break: "slight_break",
          }),
        }) as unknown as StyleSpecV2;
        const before = JSON.stringify(locked);
        const issues = styleDirectorConstructionIssues(locked);
        const codes = issues.map(issue => issue.code);
        assert.equal(codes.includes("unknown_versioned_option"),
          cuff === "retired_cuff_id" || sleeve === "retired_sleeve_id");
        assert.equal(codes.includes("pleated_front_missing_pleat"), pleat === "flat_front");
        assert.deepEqual(styleDirectorConstructionIssues(locked), issues, "stable review");
        assert.equal(JSON.stringify(locked), before, "locked IDs must be preserved");
      }
    }
  }
});
