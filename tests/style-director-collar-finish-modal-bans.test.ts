import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollarFinishIntent,
  styleDirectorCandidateCollarFinish,
  styleDirectorCandidateCollarFinishIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("modal collar-finish exclusions never become positive construction requests", () => {
  for (const prefix of [
    "Must not use", "Should not choose", "Cannot have", "Can't select",
    "Mustn't include", "May not wear", "Would not want",
  ]) {
    const name = `${prefix} White contrast collar`;
    const intent = styleDirectorCandidateCollarFinishIntent(name);
    assert.deepEqual(intent, {
      requested: null,
      prohibited: ["White contrast collar", "White contrast collar + cuffs"],
      ambiguous: false,
    }, name);
    assert.equal(styleDirectorCandidateCollarFinish(name), null, name);
    assert.deepEqual(styleDirectorCandidateCollarFinishIssues(name, { collarFinish: "Self-fabric" }), [], name);
    for (const locked of intent.prohibited) {
      assert.deepEqual(
        styleDirectorCandidateCollarFinishIssues(name, { collarFinish: locked }).map(issue => issue.code),
        ["candidate_collar_finish_mismatch"], name,
      );
    }
    assert.deepEqual(styleDirectorCandidateCollarFinishIntent(name), intent, "deterministic result");
  }
});

test("modal ban of combo leaves standalone contrast collar available", () => {
  const name = "Must not use White contrast collar + cuffs";
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent(name), {
    requested: null, prohibited: ["White contrast collar + cuffs"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCollarFinishIssues(name, { collarFinish: "White contrast collar" }), []);
  assert.deepEqual(
    styleDirectorCandidateCollarFinishIssues(name, { collarFinish: "White contrast collar + cuffs" }).map(issue => issue.code),
    ["candidate_collar_finish_mismatch"],
  );
});

test("independent affirmative and modal prohibition remain contradictory", () => {
  const name = "Must not use White contrast collar; White contrast collar";
  const intent = styleDirectorCandidateCollarFinishIntent(name);
  assert.equal(intent.ambiguous, true);
  assert.equal(intent.requested, "White contrast collar");
  assert.deepEqual(intent.prohibited, ["White contrast collar", "White contrast collar + cuffs"]);
  assert.equal(styleDirectorCandidateCollarFinish(name), null);
});
