import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// Fit and front construction are independent tailoring decisions. A stale
// shirt option cannot suppress either issue or authorize silent repairs.
test("wide-leg tapered fit and pleated-front errors are reviewed independently", () => {
  for (const sleeve of ["full_sleeve", "retired_sleeve"] as const) {
    for (const tapered of [false, true]) {
      for (const missingPleat of [false, true]) {
        const spec = {
          shirt: { type: "dress_shirt", collar: "spread_collar", wear: "tucked",
            sleeve, cuff: "barrel_cuff_1_button" },
          pant: { type: "wide_leg_relaxed_drape",
            fit: tapered ? "slim_tapered" : "relaxed",
            pleat: missingPleat ? "flat_front" : "single_pleat_forward",
            hem: "plain_hem", break: "no_break" },
        } as StyleSpecV2;
        const before = JSON.stringify(spec);
        Object.freeze(spec.shirt);
        Object.freeze(spec.pant);
        Object.freeze(spec);
        const first = styleDirectorConstructionIssues(spec);
        const codes = first.map(issue => issue.code);
        assert.equal(codes.includes("wide_leg_tapered_fit_mismatch"), tapered);
        assert.equal(codes.includes("unknown_versioned_option"), sleeve === "retired_sleeve");
        assert.deepEqual(styleDirectorConstructionIssues(spec), first);
        assert.equal(JSON.stringify(spec), before);
      }
    }
  }
});
