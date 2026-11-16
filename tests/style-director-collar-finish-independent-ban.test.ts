import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollarFinishIssues,
  styleDirectorCandidateCollarFinishIntent,
} from "../src/lib/designer/style-director-compatibility.ts";

test("an unresolved finish alternative cannot erase a separate white-contrast exclusion", () => {
  const wording = "With or without self-fabric, but no white contrast collar";
  const intent = styleDirectorCandidateCollarFinishIntent(wording);
  assert.equal(intent.ambiguous, true);
  assert.ok(intent.prohibited.includes("White contrast collar"));
  assert.ok(intent.prohibited.includes("White contrast collar + cuffs"));

  const locked = Object.freeze({ collarFinish: "White contrast collar + cuffs" as const });
  const review = () => styleDirectorCandidateCollarFinishIssues(wording, locked).map(issue => issue.code);
  assert.deepEqual(review(), ["candidate_collar_finish_mismatch"]);
  assert.deepEqual(review(), ["candidate_collar_finish_mismatch"]);
  assert.equal(locked.collarFinish, "White contrast collar + cuffs");

  assert.deepEqual(
    styleDirectorCandidateCollarFinishIssues(wording, { collarFinish: "Self-fabric" }),
    [],
    "an unresolved alternative cannot invent a replacement finish",
  );
});

test("a neutral undecided finish without exclusions remains undecided", () => {
  const wording = "With or without self-fabric";
  assert.equal(styleDirectorCandidateCollarFinishIntent(wording).ambiguous, true);
  assert.deepEqual(
    styleDirectorCandidateCollarFinishIssues(wording, { collarFinish: "White contrast collar" }),
    [],
  );
});
