import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePlacketIntent,
  styleDirectorCandidatePlacketIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("contradictory named placket cannot suppress an independent prohibition", () => {
  const phrase = "french placket, but do not use french placket; covered placket must not be used";
  const intent = styleDirectorCandidatePlacketIntent(phrase);
  assert.equal(intent.ambiguous, true);
  assert.equal(intent.requested, "french_placket");
  assert.deepEqual(intent.prohibited, ["french_placket", "covered_placket"]);
  const expected = [{
    code: "candidate_placket_mismatch",
    explanation: "The requested or prohibited shirt placket conflicts with the locked versioned construction; confirm the front before tailoring.",
  }];
  for (const placket of ["covered_placket", "retired_placket"]) {
    const locked = Object.freeze({ placket });
    const before = Object.getOwnPropertyDescriptors(locked);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(phrase, locked as Parameters<typeof styleDirectorCandidatePlacketIssues>[1]), expected);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(phrase, locked as Parameters<typeof styleDirectorCandidatePlacketIssues>[1]), expected);
    assert.deepEqual(Object.getOwnPropertyDescriptors(locked), before);
  }
  assert.deepEqual(styleDirectorCandidatePlacketIssues(phrase, { placket: "hidden_fly_front" }), []);
});

test("contradiction alone remains with the wording review gate", () => {
  const phrase = "french placket but no french placket";
  assert.deepEqual(styleDirectorCandidatePlacketIssues(phrase, { placket: "french_placket" }), []);
  assert.deepEqual(styleDirectorCandidatePlacketIssues(phrase, { placket: "covered_placket" }), []);
});
