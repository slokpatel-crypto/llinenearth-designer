import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateButtonIntent,
  styleDirectorCandidateButtonIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const codes = (name: string, button: string) =>
  styleDirectorCandidateButtonIssues(name, { button } as never).map(issue => issue.code);

test("independent button-material bans survive an undecided material choice", () => {
  const name = "with or without horn buttons; no corozo buttons";
  assert.deepEqual(styleDirectorCandidateButtonIntent(name), {
    requested: null, prohibited: ["corozo"], ambiguous: true,
  });
  const locked = Object.freeze({ button: "corozo" });
  const before = JSON.stringify(locked);
  assert.deepEqual(codes(name, locked.button), ["candidate_button_mismatch"]);
  assert.deepEqual(codes(name, "horn"), []);
  assert.deepEqual(codes(name, "mother_of_pearl"), []);
  assert.deepEqual(codes(name, locked.button), ["candidate_button_mismatch"]);
  assert.equal(JSON.stringify(locked), before);
});

test("contradictory button request still enforces its explicit exclusion", () => {
  const name = "horn buttons; no horn buttons";
  assert.deepEqual(styleDirectorCandidateButtonIntent(name), {
    requested: "horn", prohibited: ["horn"], ambiguous: true,
  });
  assert.deepEqual(codes(name, "horn"), ["candidate_button_mismatch"]);
  assert.deepEqual(codes(name, "corozo"), [],
    "contradictory positive intent requires wording review, not a guessed material");
});

test("unambiguous button intent keeps its original positive and negative checks", () => {
  assert.deepEqual(codes("horn buttons", "horn"), []);
  assert.deepEqual(codes("horn buttons", "corozo"), ["candidate_button_mismatch"]);
  assert.deepEqual(codes("no corozo buttons", "horn"), []);
  assert.deepEqual(codes("no corozo buttons", "corozo"), ["candidate_button_mismatch"]);
  assert.deepEqual(codes("no corozo buttons", "retired_button"), ["candidate_button_mismatch"]);
});
