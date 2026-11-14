import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

test("explicit wear restrictions never approve inherited or accessor-only locked state", () => {
  const cases = [
    ["do not tuck the shirt", "untucked"],
    ["do not untuck the shirt", "tucked"],
    ["wear tucked", "tucked"],
    ["wear untucked", "untucked"],
  ] as const;
  for (const [instruction, expected] of cases) {
    const inherited = Object.create({ wear: expected }) as { wear: "tucked" | "untucked" };
    const getter = Object.defineProperty({}, "wear", {
      enumerable: true,
      get() { return expected; },
    }) as { wear: "tucked" | "untucked" };
    const absent = {} as { wear: "tucked" | "untucked" };
    for (const locked of [inherited, getter, absent]) {
      const first = styleDirectorCandidateWearIssues(instruction, locked);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], instruction);
      assert.deepEqual(styleDirectorCandidateWearIssues(instruction, locked), first);
    }
    const own = Object.freeze({ wear: expected });
    assert.deepEqual(styleDirectorCandidateWearIssues(instruction, own), []);
    assert.equal(own.wear, expected);
  }
});
