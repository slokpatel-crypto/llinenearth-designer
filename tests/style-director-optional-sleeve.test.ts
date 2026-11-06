import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateSleeve,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorCandidateRollUpSleeveIntent,
} from "../src/lib/designer/style-director-compatibility.ts";

const lockedIssues = (candidate: string, sleeve: string) =>
  styleDirectorCandidateSleeveIssues(candidate, { sleeve }).map(issue => issue.code);
const wordingIssues = (candidate: string) =>
  styleDirectorCandidateWordingIssues(candidate).map(issue => issue.code);

test("optional short/half sleeves do not force an open-hem short-sleeve construction", () => {
  for (const label of [
    "Optional Short Sleeve Shirt",
    "Maybe Half-Sleeve Shirt",
    "Short sleeves are optional",
    "Half-sleeved is optional",
    "Short Sleeve not required",
  ]) {
    assert.equal(styleDirectorCandidateSleeve(label), null, label);
    assert.deepEqual(lockedIssues(label, "full_sleeve"), [], label);
    assert.deepEqual(lockedIssues(label, "half_sleeve"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
});

test("optional full/long sleeves do not force normal full sleeve or reject an allowed half sleeve", () => {
  for (const label of [
    "Optional Full Sleeve Shirt",
    "Maybe Long-Sleeve Shirt",
    "Full sleeves are optional",
    "Long sleeve is not required",
  ]) {
    assert.equal(styleDirectorCandidateSleeve(label), null, label);
    assert.deepEqual(lockedIssues(label, "full_sleeve"), [], label);
    assert.deepEqual(lockedIssues(label, "half_sleeve"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
});

test("optional sleeve phrases do not mask a separate affirmative sleeve choice", () => {
  for (const label of [
    "Optional short sleeve; full sleeve shirt",
    "Short sleeves are optional; long sleeve shirt",
    "Full sleeve optional; half sleeve shirt",
  ]) {
    const requiredShort = /half sleeve shirt$/.test(label);
    assert.equal(styleDirectorCandidateSleeve(label)?.sleeve ?? null,
      requiredShort ? "half_sleeve" : null, label);
    assert.deepEqual(lockedIssues(label, requiredShort ? "half_sleeve" : "full_sleeve"), [], label);
    assert.deepEqual(lockedIssues(label, requiredShort ? "full_sleeve" : "half_sleeve"),
      ["candidate_sleeve_mismatch"], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
});

test("optional sleeve length does not erase an independently prohibited length", () => {
  for (const label of [
    "No short sleeves; long sleeves optional",
    "Avoid half sleeve; optional full sleeve",
  ]) {
    assert.equal(styleDirectorCandidateSleeve(label), null, label);
    assert.deepEqual(lockedIssues(label, "half_sleeve"), ["candidate_sleeve_mismatch"], label);
    assert.deepEqual(lockedIssues(label, "full_sleeve"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
});

test("Roll-up Styled remains compatible with optional short sleeves but not a requested short cut", () => {
  const option = "Roll-up Styled Shirt; optional short sleeves";
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(option), {
    requested: true, prohibited: false, ambiguous: false,
  });
  assert.deepEqual(wordingIssues(option), []);
  assert.deepEqual(lockedIssues(option, "roll_up_styled"), []);
  assert.equal(styleDirectorCandidateSleeve(option), null,
    "an optional short sleeve cannot override an explicitly requested rolled sleeve");
  const impossible = "Roll-up Styled Shirt; short sleeves required";
  assert.equal(styleDirectorCandidateRollUpSleeveIntent(impossible).ambiguous, true);
  assert.deepEqual(wordingIssues(impossible), ["ambiguous_candidate_sleeve"]);
});
