import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWearIssues } from "../src/lib/designer/style-director-compatibility.ts";

// Explicit wear is a cutting instruction. A value inherited from an object
// prototype or supplied by an accessor is not a saved versioned option.
test("explicit tuck instructions reject untrusted locked wear properties", () => {
  for (const [wording, canonical] of [
    ["tucked shirt", "tucked"],
    ["untucked shirt", "untucked"],
  ] as const) {
    const inherited = Object.create({ wear: canonical });
    const accessor = Object.defineProperty({}, "wear", {
      enumerable: true,
      get() { throw new Error("untrusted getter must not execute"); },
    });
    for (const saved of [inherited, accessor, Object.freeze({}), Object.freeze({ wear: "unknown" })]) {
      const issues = styleDirectorCandidateWearIssues(wording, saved);
      assert.equal(issues.length, 1, wording);
      assert.equal(issues[0].code, "candidate_shirt_wear_mismatch");
      assert.deepEqual(styleDirectorCandidateWearIssues(wording, saved), issues);
    }
    const valid = Object.freeze(Object.assign(Object.create(null), { wear: canonical }));
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, valid), []);
  }
});

test("optional tuck phrasing never reads or mutates a locked wear getter", () => {
  const accessor = Object.defineProperty({}, "wear", {
    get() { throw new Error("optional intent must not read wear"); },
  });
  for (const wording of [
    "with or without tucked",
    "with or without being untucked",
    "maybe tucked",
    "untucked is optional",
  ]) {
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, accessor), [], wording);
  }
});

test("optional wear wording cannot mask a separate mandatory construction instruction", () => {
  const unsafe = Object.defineProperty({}, "wear", {
    enumerable: true,
    get() { throw new Error("saved accessor must never execute"); },
  });
  for (const [wording, required] of [
    ["with or without tucked, but untucked shirt", "untucked"],
    ["with or without untucked, but tucked shirt", "tucked"],
  ] as const) {
    const mismatched = Object.freeze({ wear: required === "tucked" ? "untucked" : "tucked" });
    const matched = Object.freeze({ wear: required });
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, matched), [], wording);
    for (const saved of [mismatched, unsafe, Object.create({ wear: required })]) {
      const issues = styleDirectorCandidateWearIssues(wording, saved);
      assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidateWearIssues(wording, saved), issues);
    }
  }
});
