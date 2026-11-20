import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateWideLegIntent,
  styleDirectorCandidateWideLeg,
  styleDirectorCandidateWideLegIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("unnecessary wide-leg wording stays neutral, without selecting or rejecting a locked cut", () => {
  const phrases = [
    "Wide-leg trousers are not necessary",
    "Wide-leg pants aren't necessary",
    "Wide-leg trousers aren't mandatory",
    "Wide-leg pants are not needed",
  ];
  for (const phrase of phrases) {
    assert.equal(styleDirectorCandidateWideLegIntent(phrase), null, phrase);
    assert.equal(styleDirectorCandidateWideLeg(phrase), false, phrase);
    for (const type of ["wide_leg_relaxed_drape", "formal_flat_front"]) {
      const locked = Object.freeze({ type });
      const original = JSON.stringify(locked);
      assert.deepEqual(styleDirectorCandidateWideLegIssues(phrase, locked), [], phrase);
      assert.equal(JSON.stringify(locked), original, phrase);
    }
  }
});

test("optional wording never suppresses an independently stated positive or negative cut", () => {
  const optional = "Wide-leg trousers are not necessary";
  assert.equal(styleDirectorCandidateWideLegIntent(optional + "; wide-leg trousers requested"), "requested");
  assert.equal(styleDirectorCandidateWideLegIntent(optional + "; no wide-leg trousers"), "prohibited");
  assert.equal(styleDirectorCandidateWideLegIntent("Wide-leg trousers requested; no wide-leg trousers"), "ambiguous");
});
