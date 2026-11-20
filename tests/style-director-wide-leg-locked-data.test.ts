import test from "node:test";
import assert from "node:assert/strict";
import { styleDirectorCandidateWideLegIssues } from "../src/lib/designer/style-director-compatibility.ts";

// A candidate's prose is not authority to overwrite a versioned trouser ID.
// Missing or executable locked selections must require tailor review.
test("wide-leg requests distinguish a valid locked silhouette from missing and retired IDs", () => {
  const phrase = "wide-leg trousers";
  assert.deepEqual(styleDirectorCandidateWideLegIssues(phrase, { type: "wide_leg_relaxed_drape" }), []);
  for (const type of ["formal_flat_front", "retired_wide_leg", "", undefined, null]) {
    const locked = Object.freeze({ type });
    const before = Object.getOwnPropertyDescriptors(locked);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(phrase, locked as never).map(issue => issue.code),
      ["candidate_wide_leg_mismatch"]);
    assert.deepEqual(Object.getOwnPropertyDescriptors(locked), before);
  }
});

test("wide-leg bans fail closed for inherited and accessor-backed locked types", () => {
  let getterCalls = 0;
  const inherited = Object.create({ type: "formal_flat_front" });
  const accessor = Object.create(null);
  Object.defineProperty(accessor, "type", {
    enumerable: true,
    get() { getterCalls++; throw new Error("untrusted saved selection"); },
  });
  for (const locked of [inherited, accessor]) {
    assert.deepEqual(styleDirectorCandidateWideLegIssues("no wide-leg trousers", locked)
      .map(issue => issue.code), ["candidate_wide_leg_mismatch"]);
    assert.deepEqual(styleDirectorCandidateWideLegIssues("no wide-leg trousers", locked)
      .map(issue => issue.code), ["candidate_wide_leg_mismatch"]);
  }
  assert.equal(getterCalls, 0);
  assert.deepEqual(styleDirectorCandidateWideLegIssues("no wide-leg trousers",
    { type: "formal_flat_front" }), []);
  assert.deepEqual(styleDirectorCandidateWideLegIssues("no wide-leg trousers",
    { type: "wide_leg_relaxed_drape" }).map(issue => issue.code), ["candidate_wide_leg_mismatch"]);
});

test("optional and contradictory wide-leg prose never changes locked selections", () => {
  const locked = Object.freeze({ type: "formal_flat_front" });
  for (const phrase of ["wide-leg trousers are optional", "with or without wide-leg trousers",
    "wide-leg trousers, but no wide-leg trousers"]) {
    assert.deepEqual(styleDirectorCandidateWideLegIssues(phrase, locked), [], phrase);
  }
  assert.equal(locked.type, "formal_flat_front");
});
