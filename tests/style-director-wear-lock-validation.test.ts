import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateWearIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// Explicit cutting instructions cannot be approved by inherited, accessor,
// missing or stale values masquerading as a saved versioned tuck selection.
test("firm tuck and untuck requests require canonical own-data wear", () => {
  const tucked = Object.freeze({ wear: "tucked" as const });
  const untucked = Object.freeze({ wear: "untucked" as const });
  for (const [wording, matching, other] of [
    ["tucked shirt", tucked, untucked],
    ["untucked shirt", untucked, tucked],
    ["no tuck", untucked, tucked],
    ["not untucked", tucked, untucked],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, matching), [], wording);
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, other).map(x => x.code),
      ["candidate_shirt_wear_mismatch"], wording);
  }
  const inherited = Object.create({ wear: "tucked" });
  const accessor = Object.defineProperty({}, "wear", {
    get() { throw new Error("saved wear getter must not be executed"); },
  });
  const throwingProxy = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("untrusted wear descriptor"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const saved of [null, {}, inherited, accessor, throwingProxy, revoked.proxy,
    { wear: "unknown" }, { wear: "full_sleeve" }]) {
    for (const wording of ["tucked shirt", "untucked shirt", "no tuck"]) {
      const issues = styleDirectorCandidateWearIssues(wording, saved as never);
      assert.deepEqual(issues.map(x => x.code), ["candidate_shirt_wear_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidateWearIssues(wording, saved as never), issues);
    }
  }
  for (const neutral of ["dress shirt", "maybe tucked", "optional untucked",
    "tucked is optional"]) {
    assert.deepEqual(styleDirectorCandidateWearIssues(neutral, null as never), [],
      "neutral or conflicting language is not an approval instruction: " + neutral);
  }
  assert.deepEqual(styleDirectorCandidateWearIssues("untucked and tucked", null as never).map(x => x.code),
    ["candidate_shirt_wear_mismatch"], "contradictory instructions must fail closed");
  assert.equal(tucked.wear, "tucked");
  assert.equal(untucked.wear, "untucked");
});
