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

test("postposed short/long sleeve prohibitions respect locked versioned sleeve IDs", () => {
  for (const [candidate, forbidden, permitted] of [
    ["Short sleeves aren't wanted", "half_sleeve", "full_sleeve"],
    ["Half sleeve isn’t wanted", "half_sleeve", "roll_up_styled"],
    ["Short sleeves is not wanted", "half_sleeve", "full_sleeve"],
    ["Half-sleeved unwanted", "half_sleeve", "full_sleeve"],
    ["Short sleeve should not be selected", "half_sleeve", "full_sleeve"],
    ["Long sleeves aren't wanted", "full_sleeve", "half_sleeve"],
    ["Full sleeve isn't wanted", "roll_up_styled", "half_sleeve"],
    ["Full sleeves are unwanted", "full_sleeve", "half_sleeve"],
    ["Long sleeve must not be used", "roll_up_styled", "half_sleeve"],
  ] as const) {
    const saved = Object.freeze({ sleeve: forbidden });
    const snapshot = JSON.stringify(saved);
    assert.equal(styleDirectorCandidateSleeve(candidate), null, candidate);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, saved)
      .map(issue => issue.code), ["candidate_sleeve_mismatch"], candidate);
    assert.deepEqual(lockedIssues(candidate, permitted), [], candidate);
    assert.deepEqual(wordingIssues(candidate), [], candidate);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, saved)
      .map(issue => issue.code), ["candidate_sleeve_mismatch"], "deterministic replay");
    assert.equal(JSON.stringify(saved), snapshot, "locked sleeve IDs are immutable");
  }
});

test("contracted optional sleeve wording is neutral, but does not hide firm instructions", () => {
  for (const candidate of [
    "Short sleeves aren't needed",
    "Half-sleeve isn’t required",
    "Short sleeve isn't mandatory",
    "Long sleeves aren't required",
    "Full sleeve isn't needed",
    "Full sleeves aren’t mandatory",
  ]) {
    assert.equal(styleDirectorCandidateSleeve(candidate), null, candidate);
    assert.deepEqual(lockedIssues(candidate, "full_sleeve"), [], candidate);
    assert.deepEqual(lockedIssues(candidate, "half_sleeve"), [], candidate);
    assert.deepEqual(lockedIssues(candidate, "roll_up_styled"), [], candidate);
    assert.deepEqual(wordingIssues(candidate), [], candidate);
  }
  const forbidden = "Short sleeves aren't wanted; short sleeves required";
  assert.deepEqual(wordingIssues(forbidden), ["ambiguous_candidate_sleeve"]);
  assert.deepEqual(lockedIssues(forbidden, "half_sleeve"), [],
    "wording gate, not a silently rewritten lock, owns contradictions");
  const selected = "Short sleeves aren't needed; full sleeve shirt";
  assert.deepEqual(lockedIssues(selected, "full_sleeve"), []);
  assert.deepEqual(lockedIssues(selected, "half_sleeve"), ["candidate_sleeve_mismatch"]);
  assert.deepEqual(wordingIssues(selected), []);
  const ban = "Full sleeves aren't wanted; short sleeve shirt";
  assert.equal(styleDirectorCandidateSleeve(ban)?.sleeve, "half_sleeve");
  assert.deepEqual(lockedIssues(ban, "half_sleeve"), []);
  assert.deepEqual(lockedIssues(ban, "full_sleeve"), ["candidate_sleeve_mismatch"]);
  assert.deepEqual(wordingIssues(ban), []);
});

test("undecided with-or-without sleeve lengths require wording review without changing a lock", () => {
  const alternatives = [
    "with or without short sleeves",
    "with or without half-sleeve",
    "with without long sleeves",
    "with or without any full sleeves",
    "with or without a short sleeve",
  ];
  for (const wording of alternatives) {
    assert.equal(styleDirectorCandidateSleeve(wording), null, wording);
    assert.deepEqual(wordingIssues(wording), ["ambiguous_candidate_sleeve"], wording);
    for (const sleeve of ["half_sleeve", "full_sleeve", "roll_up_styled"]) {
      const saved = Object.freeze({ sleeve });
      const snapshot = JSON.stringify(saved);
      assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, saved), [], wording);
      assert.equal(JSON.stringify(saved), snapshot, "saved sleeve remains immutable");
    }
  }
});

test("undecided sleeves retain independent firm restrictions for review", () => {
  for (const [wording, forbidden, permitted] of [
    ["with or without short sleeves; no full sleeves", "full_sleeve", "half_sleeve"],
    ["with or without full sleeves; no short sleeves", "half_sleeve", "full_sleeve"],
    ["with or without half sleeves; full sleeves required", "half_sleeve", "full_sleeve"],
  ] as const) {
    assert.deepEqual(wordingIssues(wording), ["ambiguous_candidate_sleeve"], wording);
    assert.equal(styleDirectorCandidateSleeve(wording), null, wording);
    assert.deepEqual(lockedIssues(wording, forbidden), ["candidate_sleeve_mismatch"], wording);
    assert.deepEqual(lockedIssues(wording, permitted), [], wording);
  }
  assert.deepEqual(wordingIssues("no short sleeves"), [], "ordinary prohibition unaffected");
  assert.deepEqual(lockedIssues("no short sleeves", "half_sleeve"),
    ["candidate_sleeve_mismatch"]);
});

test("cross-family short/long sleeve alternatives require review, not a selected cut", () => {
  for (const wording of [
    "short or long sleeves",
    "half or full sleeves",
    "full or half sleeves",
    "long or short sleeves",
    "short sleeve or long sleeves",
    "either half or full sleeve",
    "full sleeves or short sleeve",
  ]) {
    assert.equal(styleDirectorCandidateSleeve(wording), null, wording);
    assert.deepEqual(wordingIssues(wording), ["ambiguous_candidate_sleeve"], wording);
    for (const sleeve of ["half_sleeve", "full_sleeve", "roll_up_styled"]) {
      const locked = Object.freeze({ sleeve });
      const snapshot = JSON.stringify(locked);
      assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, locked), [], wording);
      assert.equal(JSON.stringify(locked), snapshot, "a review cannot alter a locked sleeve ID");
    }
  }
});

test("cross-family alternatives keep independent bans while synonyms remain supported", () => {
  for (const [wording, denied, permitted] of [
    ["half or full sleeves; no short sleeves", "half_sleeve", "full_sleeve"],
    ["long or short sleeves; no full sleeves", "full_sleeve", "half_sleeve"],
    ["half or full sleeves; full sleeves required", "half_sleeve", "full_sleeve"],
  ] as const) {
    assert.equal(styleDirectorCandidateSleeve(wording), null, wording);
    assert.deepEqual(wordingIssues(wording), ["ambiguous_candidate_sleeve"], wording);
    assert.deepEqual(lockedIssues(wording, denied), ["candidate_sleeve_mismatch"], wording);
    assert.deepEqual(lockedIssues(wording, permitted), [], wording);
  }
  assert.deepEqual(wordingIssues("short or half sleeves"), []);
  assert.equal(styleDirectorCandidateSleeve("short or half sleeves")?.sleeve, "half_sleeve");
  assert.deepEqual(lockedIssues("short or half sleeves", "half_sleeve"), []);
  assert.deepEqual(wordingIssues("long or full sleeves"), []);
  assert.deepEqual(lockedIssues("long or full sleeves", "full_sleeve"), []);
});
