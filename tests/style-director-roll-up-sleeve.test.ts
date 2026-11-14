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

test("postposed roll-up refusals cannot silently select a rolled sleeve", () => {
  const rolled = Object.freeze({ sleeve: "roll_up_styled" });
  const ordinary = Object.freeze({ sleeve: "full_sleeve" });
  const snapshot = JSON.stringify(rolled);
  for (const candidate of [
    "Roll-up sleeves aren't wanted",
    "Roll-up sleeves aren’t wanted",
    "Roll-up Styled isn't wanted",
    "Roll-up Styled is not wanted",
    "Roll-up Styled unwanted",
    "Roll-up sleeves must not be selected",
    "Roll-up Styled should not be used",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(candidate), {
      requested: false, prohibited: true, ambiguous: false,
    }, candidate);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, ordinary), [], candidate);
    const mismatch = styleDirectorCandidateSleeveIssues(candidate, rolled);
    assert.deepEqual(mismatch.map(issue => issue.code), ["candidate_sleeve_mismatch"], candidate);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, rolled), mismatch);
    assert.deepEqual(wordingCodes(candidate), [], candidate);
    assert.equal(JSON.stringify(rolled), snapshot);
  }
});

test("postposed roll-up optionality and contradictory bans preserve locked sleeve IDs", () => {
  const rolled = Object.freeze({ sleeve: "roll_up_styled" });
  const full = Object.freeze({ sleeve: "full_sleeve" });
  for (const candidate of [
    "Roll-up Styled isn't required",
    "Roll-up sleeves aren't needed",
    "Roll-up sleeves aren’t mandatory",
    "Roll-up Styled is not required",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(candidate), {
      requested: false, prohibited: false, ambiguous: false,
    }, candidate);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, rolled), [], candidate);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, full), [], candidate);
    assert.deepEqual(wordingCodes(candidate), [], candidate);
  }
  for (const candidate of [
    "Roll-up sleeves aren't wanted; Roll-up Styled Shirt",
    "Roll-up Styled must not be selected; Roll-up Styled Shirt",
  ]) {
    assert.equal(styleDirectorCandidateRollUpSleeveIntent(candidate).ambiguous, true, candidate);
    assert.deepEqual(wordingCodes(candidate), ["ambiguous_candidate_sleeve"], candidate);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, rolled), [], candidate);
  }
  assert.equal(rolled.sleeve, "roll_up_styled");
  assert.equal(full.sleeve, "full_sleeve");
});

test("with-or-without roll-up sleeve alternatives require review instead of a ban", () => {
  const choices = [
    "with or without roll-up sleeves",
    "with or without roll up sleeves",
    "with or without roll-up styled",
    "with or without a roll-up styled",
    "with or without any roll up sleeves",
    "with without roll-up sleeves",
  ];
  for (const phrase of choices) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(phrase), {
      requested: false, prohibited: false, ambiguous: true,
    }, phrase);
    assert.deepEqual(wordingCodes(phrase), ["ambiguous_candidate_sleeve"], phrase);
    assert.equal(styleDirectorCandidateSleeve(phrase), null, phrase);
    for (const id of ["half_sleeve", "full_sleeve", "roll_up_styled"]) {
      const locked = Object.freeze({ sleeve: id });
      const before = JSON.stringify(locked);
      assert.deepEqual(styleDirectorCandidateSleeveIssues(phrase, locked), [], phrase);
      assert.deepEqual(styleDirectorCandidateSleeveIssues(phrase, locked), [], "deterministic review");
      assert.equal(JSON.stringify(locked), before, "no locked sleeve mutation");
    }
  }
});

test("undecided roll-up alternatives preserve independent firm exclusions", () => {
  const phrase = "with or without roll-up sleeves; no roll-up styled";
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(phrase), {
    requested: false, prohibited: true, ambiguous: true,
  });
  assert.deepEqual(wordingCodes(phrase), ["ambiguous_candidate_sleeve"]);
  assert.deepEqual(issueCodes(phrase, "roll_up_styled"), [],
    "the wording review gate must block selection");
  const positive = "with or without roll-up styled; roll-up sleeves required";
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(positive), {
    requested: true, prohibited: false, ambiguous: true,
  });
  assert.deepEqual(wordingCodes(positive), ["ambiguous_candidate_sleeve"]);
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent("without roll-up styled"), {
    requested: false, prohibited: true, ambiguous: false,
  }, "firm prohibition must retain existing semantics");
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent("roll-up styled shirt"), {
    requested: true, prohibited: false, ambiguous: false,
  });
});

test("ordinary full-sleeve versus roll-up alternatives need review rather than ID selection", () => {
  const alternatives = [
    "full sleeve or roll-up styled",
    "full sleeves or roll-up sleeves",
    "long sleeves or roll up styled",
    "roll-up styled or full sleeves",
    "roll up sleeves or long sleeve",
    "full or roll-up sleeves",
    "roll-up or full sleeves",
    "long or roll-up styled",
  ];
  for (const candidate of alternatives) {
    const intent = styleDirectorCandidateRollUpSleeveIntent(candidate);
    assert.equal(intent.ambiguous, true, candidate);
    assert.deepEqual(wordingCodes(candidate), ["ambiguous_candidate_sleeve"], candidate);
    assert.equal(styleDirectorCandidateSleeve(candidate), null, candidate);
    for (const sleeve of ["half_sleeve", "full_sleeve", "roll_up_styled"]) {
      const locked = Object.freeze({ sleeve });
      const before = JSON.stringify(locked);
      assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, locked), [], candidate);
      assert.equal(JSON.stringify(locked), before, "review never rewrites sleeve IDs");
    }
  }
});

test("a fully specified roll-up construction stays distinct from a true alternative", () => {
  for (const label of [
    "Full Sleeve Roll-up Styled Shirt",
    "long sleeve roll up styled shirt",
    "roll-up styled long sleeve shirt",
    "roll-up sleeves",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(label), {
      requested: true, prohibited: false, ambiguous: false,
    }, label);
    assert.deepEqual(wordingCodes(label), [], label);
    assert.deepEqual(issueCodes(label, "roll_up_styled"), [], label);
    assert.deepEqual(issueCodes(label, "full_sleeve"), ["candidate_sleeve_mismatch"], label);
  }
  const ordinary = "long sleeve shirt";
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(ordinary), {
    requested: false, prohibited: false, ambiguous: false,
  });
  assert.deepEqual(wordingCodes(ordinary), []);
  assert.deepEqual(issueCodes(ordinary, "full_sleeve"), []);
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent("no roll-up styled"), {
    requested: false, prohibited: true, ambiguous: false,
  });
});

test("contracted postposed roll-up restrictions reject locked rolled sleeves", () => {
  const rolled = Object.freeze({ sleeve: "roll_up_styled" });
  const full = Object.freeze({ sleeve: "full_sleeve" });
  const before = JSON.stringify(rolled);
  for (const phrase of [
    "Roll-up Styled isn't allowed",
    "Roll-up Styled isn’t permitted",
    "Roll-up sleeves aren't allowed",
    "Roll-up sleeves aren’t permitted",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(phrase), {
      requested: false, prohibited: true, ambiguous: false,
    }, phrase);
    assert.deepEqual(issueCodes(phrase, "roll_up_styled"), ["candidate_sleeve_mismatch"], phrase);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(phrase, full), [], phrase);
    assert.deepEqual(wordingCodes(phrase), [], phrase);
    assert.equal(JSON.stringify(rolled), before);
  }
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent("Roll-up Styled is allowed"), {
    requested: true, prohibited: false, ambiguous: false,
  });
  assert.deepEqual(issueCodes("Roll-up Styled is allowed", "roll_up_styled"), []);
});


test("postposed explicit roll-up usage bans reject only the rolled locked ID", () => {
  const rolled = Object.freeze({ sleeve: "roll_up_styled" });
  const ordinary = Object.freeze({ sleeve: "full_sleeve" });
  for (const phrase of [
    "Roll-up Styled cannot be used",
    "Roll-up sleeves can't be selected",
    "Roll-up Styled must not be worn",
    "Roll-up sleeves should never be included",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(phrase), {
      requested: false, prohibited: true, ambiguous: false,
    }, phrase);
    assert.deepEqual(issueCodes(phrase, "roll_up_styled"), ["candidate_sleeve_mismatch"], phrase);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(phrase, ordinary), [], phrase);
    assert.deepEqual(wordingCodes(phrase), [], phrase);
    assert.equal(rolled.sleeve, "roll_up_styled");
  }
});
