import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  styleDirectorCandidateRollUpSleeveIntent,
  styleDirectorCandidateSleeve,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorPresentationIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

const issueCodes = (candidate: string, id: string) =>
  styleDirectorCandidateSleeveIssues(candidate, { sleeve: id }).map(issue => issue.code);
const wordingCodes = (candidate: string) =>
  styleDirectorCandidateWordingIssues(candidate).map(issue => issue.code);

test("Roll-up Styled is a real canonical long-sleeve choice, not half-sleeve", () => {
  const option = optionsFor("shirt.sleeve").find(entry => entry.id === "roll_up_styled");
  assert.equal(option?.label, "Roll-up Styled");
  for (const candidate of ["Roll-up Styled Shirt", "Full Sleeve Roll-up Styled Shirt", "Roll up sleeves"]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(candidate), {
      requested: true, prohibited: false, ambiguous: false,
    }, candidate);
    assert.deepEqual(issueCodes(candidate, "roll_up_styled"), [], candidate);
    assert.deepEqual(issueCodes(candidate, "full_sleeve"), ["candidate_sleeve_mismatch"], candidate);
    assert.equal(styleDirectorCandidateSleeve(candidate), null,
      "a rolled long sleeve must not select an open short-sleeve cuff");
    assert.deepEqual(wordingCodes(candidate), [], candidate);
  }
});

test("negative Roll-up Styled wording prohibits rolled construction, not a normal full sleeve", () => {
  for (const candidate of [
    "No Roll-up Styled Shirt",
    "Avoid Roll-up Styled sleeves",
    "Roll-up Styled is forbidden",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(candidate), {
      requested: false, prohibited: true, ambiguous: false,
    }, candidate);
    const saved = { sleeve: "full_sleeve" };
    const before = JSON.stringify(saved);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, saved), [], candidate);
    assert.deepEqual(issueCodes(candidate, "roll_up_styled"), ["candidate_sleeve_mismatch"], candidate);
    assert.deepEqual(wordingCodes(candidate), [], candidate);
    assert.equal(JSON.stringify(saved), before);
  }
});

test("optional Roll-up Styled wording never overwrites a locked ordinary sleeve", () => {
  for (const candidate of ["Optional Roll-up Styled", "Roll-up Styled is optional"]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(candidate), {
      requested: false, prohibited: false, ambiguous: false,
    }, candidate);
    assert.deepEqual(issueCodes(candidate, "full_sleeve"), [], candidate);
    assert.deepEqual(wordingCodes(candidate), [], candidate);
  }
});

test("contradictory short vs rolled and explicit roll-up bans require wording review", () => {
  for (const candidate of [
    "Roll-up Styled Shirt; Short Sleeve Shirt",
    "Roll-up Styled Shirt; no Roll-up Styled",
    "Roll-up Styled Shirt; no full sleeves",
  ]) {
    assert.equal(styleDirectorCandidateRollUpSleeveIntent(candidate).ambiguous, true, candidate);
    assert.deepEqual(wordingCodes(candidate), ["ambiguous_candidate_sleeve"], candidate);
    assert.deepEqual(issueCodes(candidate, "roll_up_styled"), [], "wording gate owns ambiguity");
  }
});

test("Roll-up Styled new proposals retain exact ID and cannot claim a verified photo", () => {
  const source = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(source.includes("const rollUpSleeve=styleDirectorCandidateRollUpSleeveIntent(shirt)"));
  assert.ok(source.includes('spec.shirt.sleeve="roll_up_styled"'));
  assert.ok(source.includes("if(rollUpSleeve.requested && !rollUpSleeve.ambiguous)"));
  const saved = {
    shirt: { collar: "spread_collar", wear: "tucked", sleeve: "roll_up_styled" },
  } as unknown as Pick<StyleSpecV2, "shirt">;
  const before = JSON.stringify(saved);
  assert.deepEqual(styleDirectorPresentationIssues(
    { collar: "Spread Collar", shirtWear: "Tucked" }, saved,
  ).map(issue => issue.code), ["unverified_roll_up_sleeve_photo"]);
  assert.equal(JSON.stringify(saved), before);
});
