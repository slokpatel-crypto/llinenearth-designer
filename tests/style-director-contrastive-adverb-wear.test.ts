import assert from "node:assert/strict";
import test from "node:test";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

// Contrastive discourse markers terminate the garment-object prohibition.
// A following positive instruction must remain visible, never swallowed.
test("contrastive adverbs preserve contradictory garment-wear clauses", () => {
  for (const join of ["nevertheless", "nonetheless"] as const) {
    for (const noun of ["shirt", "shirts", "garment", "garments"] as const) {
      const candidate = `do not tuck the blue striped linen ${noun} ${join} tucked shirt`;
      for (const wear of ["tucked", "untucked"] as const) {
        const locked = Object.freeze({ wear });
        const first = styleDirectorCandidateWearIssues(candidate, locked);
        assert.deepEqual(first.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], candidate);
        assert.deepEqual(styleDirectorCandidateWearIssues(candidate, locked), first);
        assert.equal(locked.wear, wear);
      }
    }
  }
});
