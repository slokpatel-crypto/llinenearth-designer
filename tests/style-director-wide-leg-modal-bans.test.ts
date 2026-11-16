import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateWideLegIntent,
  styleDirectorCandidateWideLeg,
  styleDirectorCandidateWideLegIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("modal prohibitions of wide-leg construction are binding, not positive requests", () => {
  for (const phrase of [
    "Must not use wide-leg trousers",
    "Should not choose wide-leg trousers",
    "Cannot wear wide-leg trousers",
    "Can't have wide-leg trousers",
    "Wouldn't use wide-leg trousers",
    "Mustn't add wide-leg trousers",
    "Could not wear wide-leg trousers",
  ]) {
    assert.equal(styleDirectorCandidateWideLegIntent(phrase), "prohibited", phrase);
    assert.equal(styleDirectorCandidateWideLeg(phrase), false, phrase);
    const locked = Object.freeze({ type: "wide_leg_relaxed_drape" });
    const before = JSON.stringify(locked);
    const first = styleDirectorCandidateWideLegIssues(phrase, locked);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_wide_leg_mismatch"], phrase);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(phrase, locked), first, phrase);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(phrase, { type: "formal_flat_front" }), [], phrase);
    assert.equal(JSON.stringify(locked), before, phrase);
  }
});

test("modal bans and separate positive requests stay ambiguous without overwriting selections", () => {
  const phrase = "Must not use wide-leg trousers; wide-leg trousers requested";
  assert.equal(styleDirectorCandidateWideLegIntent(phrase), "ambiguous");
  assert.equal(styleDirectorCandidateWideLeg(phrase), false);
  const locked = Object.freeze({ type: "wide_leg_relaxed_drape" });
  assert.deepEqual(styleDirectorCandidateWideLegIssues(phrase, locked), []);
  assert.equal(locked.type, "wide_leg_relaxed_drape");
});

test("postposed modal wide-leg exclusions bind locked construction without selecting a replacement", () => {
  for (const phrase of [
    "Wide-leg trousers cannot be used",
    "Wide-leg pants can't be selected",
    "Wide-leg trousers mustn't be worn",
    "Wide-leg pants shouldn't be chosen",
  ]) {
    assert.equal(styleDirectorCandidateWideLegIntent(phrase), "prohibited", phrase);
    assert.equal(styleDirectorCandidateWideLeg(phrase), false, phrase);
    const locked = Object.freeze({ type: "wide_leg_relaxed_drape" });
    const issues = styleDirectorCandidateWideLegIssues(phrase, locked);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_wide_leg_mismatch"], phrase);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(phrase, locked), issues, phrase);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(phrase, { type: "formal_flat_front" }), [], phrase);
    assert.equal(locked.type, "wide_leg_relaxed_drape");
  }
});
