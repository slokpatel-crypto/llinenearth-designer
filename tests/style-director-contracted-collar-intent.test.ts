import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateOrdinaryCollar,
} from "../src/lib/designer/style-director-compatibility.ts";

test("contracted postposed collar prohibitions cannot approve the forbidden locked ID", () => {
  const cases = [
    ["Camp collar isn't to be selected", "cuban_camp_collar"],
    ["Camp collar isn’t to be worn", "cuban_camp_collar"],
    ["Cuban collar isn't to be chosen", "cuban_camp_collar"],
    ["Band collar isn't to be used", "mandarin_band_collar"],
    ["Cutaway collar isn't to be worn", "cutaway_collar"],
    ["English Spread collar isn't to be selected", "english_spread_collar"],
    ["Soft Button-Down collar isn't to be chosen", "soft_button_down"],
    ["Camp collar isn't to be added", "cuban_camp_collar"],
    ["Camp collar isn’t to be included", "cuban_camp_collar"],
    ["Band collar is not to be added", "mandarin_band_collar"],
    ["Cutaway collar is not to be included", "cutaway_collar"],
    ["Cuban collar mustn't be included", "cuban_camp_collar"],
    ["English Spread collar should not be added", "english_spread_collar"],
    ["Camp collar is never to be selected", "cuban_camp_collar"],
    ["Band collar is never to be included", "mandarin_band_collar"],
    ["Cutaway collar is never to be worn", "cutaway_collar"],
    ["English Spread collar is never to be chosen", "english_spread_collar"],
  ] as const;

  for (const [phrase, forbiddenId] of cases) {
    const locked = Object.freeze({ collar: forbiddenId });
    const before = JSON.stringify(locked);
    assert.equal(styleDirectorCandidateCollar(phrase, []), null, phrase);
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(phrase, locked).map(issue => issue.code),
      ["candidate_collar_mismatch"],
      phrase,
    );
    assert.equal(JSON.stringify(locked), before, "review must never rewrite the locked design");
  }
});

test("a contracted prohibition leaves separately requested permitted collars selectable", () => {
  const phrase = "Camp collar isn't to be selected; choose spread collar";
  assert.equal(styleDirectorCandidateCollar(phrase, []), null);
  assert.equal(styleDirectorCandidateOrdinaryCollar(phrase), "spread");
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(phrase, { collar: "spread_collar" }),
    [],
  );
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(phrase, { collar: "cuban_camp_collar" })
      .map(issue => issue.code),
    ["candidate_collar_mismatch"],
  );
  // A ban on a particular existing variant does not ban its ordinary family.
  const variantPhrase = "English Spread collar isn't to be selected; choose spread collar";
  assert.equal(styleDirectorCandidateOrdinaryCollar(variantPhrase), "spread");
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(variantPhrase, { collar: "spread_collar" }),
    [],
  );
});
