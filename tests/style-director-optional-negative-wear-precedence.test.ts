import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

// The optional clause must not swallow a separate, explicit construction
// instruction. Locked wear is checked without altering the saved specification.
test("optional wear clause does not cancel a later explicit negative instruction", () => {
  for (const optional of [
    "with or without tucked",
    "with or without being tucked",
    "with or without untucked",
    "with or without being untucked",
  ]) {
    for (const [mandatory, allowed, rejected] of [
      ["never tucked", "untucked", "tucked"],
      ["never untucked", "tucked", "untucked"],
      ["do not tuck", "untucked", "tucked"],
    ] as const) {
      const wording = optional + "; " + mandatory;
      const lockedAllowed = Object.freeze({ wear: allowed });
      const lockedRejected = Object.freeze({ wear: rejected });
      assert.deepEqual(styleDirectorCandidateWearIssues(wording, lockedAllowed), [], wording);
      const issues = styleDirectorCandidateWearIssues(wording, lockedRejected);
      assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidateWearIssues(wording, lockedRejected), issues, wording);
      assert.equal(lockedRejected.wear, rejected);
    }
  }
});

test("optional wear clause with a separate prohibition cannot trust inherited or accessor-backed wear", () => {
  let accessorReads = 0;
  const unsafe = Object.defineProperty({}, "wear", {
    enumerable: true,
    get() { accessorReads++; throw new Error("must not read accessor"); },
  });
  for (const saved of [unsafe, Object.create({ wear: "untucked" }), Object.freeze({ wear: "stale" })]) {
    assert.deepEqual(
      styleDirectorCandidateWearIssues("with or without being tucked; never tucked", saved)
        .map(issue => issue.code),
      ["candidate_shirt_wear_mismatch"],
    );
  }
  assert.equal(accessorReads, 0);
});
