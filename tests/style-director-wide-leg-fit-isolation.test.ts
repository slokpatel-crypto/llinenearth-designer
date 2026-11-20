import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorConstructionIssues } from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

// A stale shirt option must not suppress the independent wide-leg fit review
// or authorize silent repairs to frozen saved garment IDs.
test("wide-leg tapered fit review survives stale shirt IDs", () => {
  for (const sleeve of ["full_sleeve", "retired_sleeve"] as const) {
    for (const tapered of [false, true]) {
      const spec = {
          shirt: { type: "dress_shirt", collar: "spread_collar", wear: "tucked",
            sleeve, cuff: "barrel_cuff_1_button" },
          pant: { type: "wide_leg_relaxed_drape",
            fit: tapered ? "slim_tapered" : "wide_leg_drape",
            pleat: "flat_front",
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
});
