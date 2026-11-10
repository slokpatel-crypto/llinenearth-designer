import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollarFinish,
  styleDirectorCandidateCollarFinishIntent,
  styleDirectorCandidateCollarFinishIssues,
  styleDirectorCandidateRollUpSleeveIntent,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const finishIssues = (wording: string, collarFinish: string) =>
  styleDirectorCandidateCollarFinishIssues(wording, Object.freeze({ collarFinish })).map(x => x.code);
const sleeveIssues = (wording: string, sleeve: string) =>
  styleDirectorCandidateSleeveIssues(wording, Object.freeze({ sleeve })).map(x => x.code);

test("unwanted or forbidden white contrast collar prohibits both supported contrast finishes", () => {
  for (const ending of [
    "is not wanted", "isn't wanted", "isn’t wanted", "unwanted",
    "should not be selected", "must not be used",
  ]) {
    const wording = `White contrast collar ${ending}`;
    const intent = styleDirectorCandidateCollarFinishIntent(wording);
    assert.deepEqual(intent, {
      requested: null,
      prohibited: ["White contrast collar", "White contrast collar + cuffs"],
      ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidateCollarFinish(wording), null);
    assert.deepEqual(finishIssues(wording, "Self-fabric"), [], wording);
    for (const forbidden of intent.prohibited) {
      const issues = finishIssues(wording, forbidden);
      assert.deepEqual(issues, ["candidate_collar_finish_mismatch"], wording);
      assert.deepEqual(finishIssues(wording, forbidden), issues, "deterministic replay");
    }
  }
  const onlyCombination = "White contrast collar + cuffs isn't wanted";
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent(onlyCombination), {
    requested: null, prohibited: ["White contrast collar + cuffs"], ambiguous: false,
  });
  assert.deepEqual(finishIssues(onlyCombination, "White contrast collar"), []);
  assert.deepEqual(finishIssues(onlyCombination, "White contrast collar + cuffs"),
    ["candidate_collar_finish_mismatch"]);
});

test("contracted optional collar-finish language stays neutral and positive requests still work", () => {
  for (const wording of [
    "White contrast collar isn't required",
    "White contrast collar isn’t needed",
    "White contrast collar isn't mandatory",
    "Self-fabric isn't required",
  ]) {
    assert.deepEqual(styleDirectorCandidateCollarFinishIntent(wording), {
      requested: null, prohibited: [], ambiguous: false,
    }, wording);
    assert.deepEqual(finishIssues(wording, "Self-fabric"), []);
  }
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent("White contrast collar required"), {
    requested: "White contrast collar", prohibited: [], ambiguous: false,
  });
  const contradiction = "White contrast collar isn't wanted; white contrast collar required";
  assert.equal(styleDirectorCandidateCollarFinishIntent(contradiction).ambiguous, true);
  assert.ok(styleDirectorCandidateWordingIssues(contradiction)
    .some(issue => issue.code === "ambiguous_candidate_collar_finish"));
});

test("unwanted rolled sleeve does not become an affirmative roll-up request", () => {
  for (const ending of [
    "is not wanted", "isn't wanted", "isn’t wanted", "unwanted",
    "should not be selected", "must not be used",
  ]) {
    const wording = `Roll-up Styled ${ending}`;
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(wording), {
      requested: false, prohibited: true, ambiguous: false,
    }, wording);
    const frozen = Object.freeze({ sleeve: "roll_up_styled" });
    const issues = styleDirectorCandidateSleeveIssues(wording, frozen).map(x => x.code);
    assert.deepEqual(issues, ["candidate_sleeve_mismatch"], wording);
    assert.deepEqual(sleeveIssues(wording, "full_sleeve"), [], wording);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, frozen).map(x => x.code), issues);
    assert.equal(frozen.sleeve, "roll_up_styled", "saved canonical ID must not be rewritten");
  }
});

test("optional rolled sleeve is not a cut instruction, while contradictions require review", () => {
  for (const wording of [
    "Roll-up Styled isn't required", "Roll-up Styled isn’t needed",
    "Roll-up Styled isn't mandatory", "Roll-up Styled optional",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(wording), {
      requested: false, prohibited: false, ambiguous: false,
    }, wording);
    assert.deepEqual(sleeveIssues(wording, "full_sleeve"), []);
  }
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent("Roll-up Styled required"), {
    requested: true, prohibited: false, ambiguous: false,
  });
  const contradiction = "Roll-up Styled isn't wanted; Roll-up Styled required";
  assert.equal(styleDirectorCandidateRollUpSleeveIntent(contradiction).ambiguous, true);
  assert.ok(styleDirectorCandidateWordingIssues(contradiction)
    .some(issue => issue.code === "ambiguous_candidate_sleeve"));
});
