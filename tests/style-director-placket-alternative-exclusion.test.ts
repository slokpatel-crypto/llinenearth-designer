import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePlacket,
  styleDirectorCandidatePlacketIntent,
  styleDirectorCandidatePlacketIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("undecided placket choice does not cancel an independent explicit ban", () => {
  const phrase = "with or without french placket, but covered placket must not be used";
  const intent = styleDirectorCandidatePlacketIntent(phrase);
  assert.equal(intent.ambiguous, true);
  assert.equal(intent.requested, null);
  assert.deepEqual(intent.prohibited, ["covered_placket"]);
  assert.equal(styleDirectorCandidatePlacket(phrase, []), null);
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
  for (const placket of ["french_placket", "hidden_fly_front", "standard_visible_placket"]) {
    assert.deepEqual(styleDirectorCandidatePlacketIssues(phrase, { placket }), [], placket);
  }
});

test("undecided placket without an independent exclusion remains a choice, not a ban", () => {
  const phrase = "with or without french placket";
  assert.deepEqual(styleDirectorCandidatePlacketIntent(phrase), {
    requested: null, prohibited: [], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidatePlacketIssues(phrase, { placket: "french_placket" }), []);
});
