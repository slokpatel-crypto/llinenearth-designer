import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

test("explicit tucked instructions fail closed for malformed locked wear", () => {
  const candidate = "wear tucked";
  const invalid = [
    {},
    { wear: undefined },
    { wear: "Tucked" },
    { wear: null },
    Object.create({ wear: "tucked" }),
    Object.defineProperty({}, "wear", { get() { return "tucked"; } }),
    new Proxy({}, { getOwnPropertyDescriptor() { throw Error("unreadable"); } }),
  ];
  for (const saved of invalid) {
    const first = styleDirectorCandidateWearIssues(candidate, saved as { wear: "tucked" });
    assert.deepEqual(first.map(issue => issue.code), ["candidate_shirt_wear_mismatch"]);
    assert.deepEqual(styleDirectorCandidateWearIssues(candidate, saved as { wear: "tucked" }), first);
  }
  assert.deepEqual(styleDirectorCandidateWearIssues(candidate, Object.freeze({ wear: "tucked" })), []);
});

test("explicit untucked instructions never rewrite a frozen locked selection", () => {
  const saved = Object.freeze({ wear: "tucked" as const });
  const issues = styleDirectorCandidateWearIssues("wear untucked", saved);
  assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"]);
  assert.equal(saved.wear, "tucked");
});
