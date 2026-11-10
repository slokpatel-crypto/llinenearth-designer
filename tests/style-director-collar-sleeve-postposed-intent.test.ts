import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateOrdinaryCollar,
  styleDirectorCandidateVariantCollar,
  styleDirectorCandidateSleeve,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

const collarIssues = (wording: string, collar: string) =>
  styleDirectorCandidateCollarIssues(wording, Object.freeze({ collar }))
    .map(issue => issue.code);
const sleeveIssues = (wording: string, sleeve: string) =>
  styleDirectorCandidateSleeveIssues(wording, Object.freeze({ sleeve }))
    .map(issue => issue.code);
const wordingIssues = (wording: string) =>
  styleDirectorCandidateWordingIssues(wording).map(issue => issue.code);

test("unwanted collar families and named variants are prohibited, never selected", () => {
  for (const suffix of [
    "isn't wanted", "isn’t wanted", "is not wanted", "is unwanted",
    "should not be selected", "must not be used",
  ]) {
    const camp = `Camp Collar ${suffix}`;
    assert.deepEqual(collarIssues(camp, "cuban_camp_collar"),
      ["candidate_collar_mismatch"], camp);
    assert.deepEqual(collarIssues(camp, "spread_collar"), [], camp);
    assert.equal(styleDirectorCandidateOrdinaryCollar(camp), null);
    assert.deepEqual(wordingIssues(camp), [], camp);
    assert.deepEqual(collarIssues(camp, "cuban_camp_collar"),
      ["candidate_collar_mismatch"], "deterministic replay");
    const english = `English Spread Collar ${suffix}`;
    assert.deepEqual(collarIssues(english, "english_spread_collar"),
      ["candidate_collar_mismatch"], english);
    assert.deepEqual(collarIssues(english, "spread_collar"), [], english);
    assert.equal(styleDirectorCandidateVariantCollar(english), null);
  }
  assert.deepEqual(collarIssues("Spread Collar isn't wanted", "spread_collar"),
    ["candidate_collar_mismatch"]);
  assert.deepEqual(collarIssues("Spread Collar isn't wanted", "english_spread_collar"),
    ["candidate_collar_mismatch"]);
});

test("optional collar wording is neutral; separate positive variants still bind", () => {
  for (const label of [
    "Camp Collar isn't needed",
    "Camp Collar isn’t required",
    "Camp Collar isn't mandatory",
    "English Spread Collar isn't needed",
  ]) {
    assert.deepEqual(collarIssues(label, "spread_collar"), [], label);
    assert.deepEqual(collarIssues(label, "cuban_camp_collar"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
  const independent = "Spread Collar isn't needed; Soft Button-down Collar required";
  assert.equal(styleDirectorCandidateVariantCollar(independent), "soft_button_down");
  assert.deepEqual(collarIssues(independent, "soft_button_down"), []);
  assert.deepEqual(collarIssues(independent, "spread_collar"), ["candidate_collar_mismatch"]);
  const conflicting = "Camp Collar isn't wanted; Camp Collar required";
  assert.deepEqual(wordingIssues(conflicting), ["ambiguous_candidate_collar"]);
});

test("unwanted sleeve lengths cannot select a forbidden half or full sleeve", () => {
  for (const suffix of [
    "aren't wanted", "aren’t wanted", "are not wanted", "are unwanted",
    "should not be selected", "must not be used",
  ]) {
    const short = `Short sleeves ${suffix}`;
    const long = `Full sleeves ${suffix}`;
    assert.equal(styleDirectorCandidateSleeve(short), null, short);
    assert.deepEqual(sleeveIssues(short, "half_sleeve"), ["candidate_sleeve_mismatch"], short);
    assert.deepEqual(sleeveIssues(short, "full_sleeve"), [], short);
    assert.deepEqual(sleeveIssues(long, "full_sleeve"), ["candidate_sleeve_mismatch"], long);
    assert.deepEqual(sleeveIssues(long, "roll_up_styled"), ["candidate_sleeve_mismatch"], long);
    assert.deepEqual(sleeveIssues(long, "half_sleeve"), [], long);
    assert.deepEqual(wordingIssues(short), [], short);
    assert.deepEqual(wordingIssues(long), [], long);
  }
});

test("optional sleeves stay neutral; independent requests and conflicting bans require review", () => {
  for (const label of [
    "Short sleeves aren't required",
    "Half sleeves aren’t needed",
    "Full sleeves aren't mandatory",
    "Long sleeves aren't needed",
  ]) {
    assert.equal(styleDirectorCandidateSleeve(label), null, label);
    assert.deepEqual(sleeveIssues(label, "full_sleeve"), [], label);
    assert.deepEqual(sleeveIssues(label, "half_sleeve"), [], label);
    assert.deepEqual(wordingIssues(label), [], label);
  }
  const independent = "Short sleeves aren't required; Full sleeves required";
  assert.deepEqual(sleeveIssues(independent, "full_sleeve"), []);
  assert.deepEqual(sleeveIssues(independent, "half_sleeve"), ["candidate_sleeve_mismatch"]);
  const conflicting = "Full sleeves aren't wanted; full sleeves required";
  assert.ok(wordingIssues(conflicting).includes("ambiguous_candidate_sleeve"));
  const locked = Object.freeze({ sleeve: "full_sleeve" });
  assert.equal(locked.sleeve, "full_sleeve", "saved canonical sleeve IDs remain immutable");
});
