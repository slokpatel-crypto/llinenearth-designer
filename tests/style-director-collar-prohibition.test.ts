import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateOrdinaryCollar,
  styleDirectorCandidateVariantCollar,
  styleDirectorCandidateSpecialCollar,
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorWearForCandidate,
} from "../src/lib/designer/style-director-compatibility.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";

const photographed = optionsFor("shirt.collar")
  .filter(option => option.legacySelectable !== false)
  .map(option => option.legacyLabel || option.label);

const issueCodes = (candidate: string, savedId: string) =>
  styleDirectorCandidateCollarIssues(candidate, { collar: savedId })
    .map(issue => issue.code);

test("forbidden collar wording cannot silently select that photographed or versioned collar", () => {
  const cases = [
    ["No English Spread Collar", "english_spread_collar", "button_down_collar"],
    ["No Soft Button-Down Collar", "soft_button_down", "spread_collar"],
    ["Without Point (Standard) Collar", "point_standard_collar", "spread_collar"],
    ["No Camp-Collar Shirt", "cuban_camp_collar", "spread_collar"],
    ["No Cuban / Camp Collar", "cuban_camp_collar", "spread_collar"],
    ["Without Mandarin Band Collar", "mandarin_band_collar", "spread_collar"],
    ["Avoid Mandarin / Band Collar", "mandarin_band_collar", "spread_collar"],
    ["Avoid Spread-Collar Shirt", "spread_collar", "button_down_collar"],
    ["Club collar is forbidden", "club_collar", "spread_collar"],
    ["Tab collar not allowed", "tab_collar", "spread_collar"],
  ] as const;
  for (const [name, forbidden, accepted] of cases) {
    assert.equal(styleDirectorCandidateCollar(name, photographed), null, name);
    assert.equal(styleDirectorCandidateOrdinaryCollar(name), null, name);
    assert.equal(styleDirectorCandidateSpecialCollar(name, photographed), null, name);
    assert.deepEqual(issueCodes(name, forbidden), ["candidate_collar_mismatch"], name);
    assert.deepEqual(issueCodes(name, accepted), [], name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
  }
  assert.equal(styleDirectorWearForCandidate("Casual", "No Camp-Collar Shirt", "Tucked"),
    "Tucked", "a forbidden camp collar must not force untucked wear");
});

test("requested alternative remains selectable while prohibited collar stays blocked", () => {
  const wording = "No Camp Collar; Mandarin Band Collar Shirt";
  assert.equal(styleDirectorCandidateCollar(wording, photographed)?.versioned, "mandarin_band_collar");
  assert.deepEqual(issueCodes(wording, "mandarin_band_collar"), []);
  assert.deepEqual(issueCodes(wording, "cuban_camp_collar"), ["candidate_collar_mismatch"]);
  assert.deepEqual(styleDirectorCandidateWordingIssues(wording), []);
});

test("optional collar wording is not a required construction", () => {
  for (const name of ["Optional Cutaway Collar Shirt", "Wing Collar is optional", "Club collar not required"]) {
    assert.equal(styleDirectorCandidateCollar(name, photographed), null, name);
    assert.equal(styleDirectorCandidateSpecialCollar(name, photographed), null, name);
    assert.deepEqual(issueCodes(name, "spread_collar"), [], name);
  }
});

test("requesting and forbidding same collar fails review without rewriting an ID", () => {
  const name = "Camp Collar Shirt; no camp collar";
  const saved = { collar: "cuban_camp_collar" };
  const before = JSON.stringify(saved);
  assert.equal(styleDirectorCandidateCollar(name, photographed), null);
  assert.deepEqual(styleDirectorCandidateWordingIssues(name).map(issue => issue.code),
    ["ambiguous_candidate_collar"]);
  assert.deepEqual(styleDirectorCandidateCollarIssues(name, saved), []);
  assert.equal(JSON.stringify(saved), before);
});

test("modified collar names remain affirmative when not forbidden", () => {
  for (const [name, locked, other] of [
    ["English Spread Collar Shirt", "english_spread_collar", "cuban_camp_collar"],
    ["Soft Button-Down Collar Shirt", "soft_button_down", "spread_collar"],
    ["Point (Standard) Collar Shirt", "point_standard_collar", "spread_collar"],
  ] as const) {
    assert.deepEqual(issueCodes(name, locked), [], name);
    assert.deepEqual(issueCodes(name, other), ["candidate_collar_mismatch"], name);
  }
});

test("named collar variants retain the precise canonical construction, not a generic relative", () => {
  const cases = [
    ["English Spread Collar Shirt", "english_spread_collar", "spread_collar"],
    ["Soft Button-Down Collar Shirt", "soft_button_down", "button_down_collar"],
  ] as const;
  const agentSource = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agentSource.includes("const variantCollar=styleDirectorCandidateVariantCollar(shirt)"),
    "Style Director candidate generation must inspect exact variant wording");
  assert.ok(agentSource.includes("if(variantCollar) spec.shirt.collar=variantCollar"),
    "Style Director new canonical proposals must retain exact variant IDs");
  assert.ok(agentSource.includes("...styleDirectorPresentationIssues(best.style,styleSpec)"),
    "unverified photographic variant choices must still block photo approval");
  for (const [candidate, exactId, genericId] of cases) {
    assert.equal(styleDirectorCandidateVariantCollar(candidate), exactId, candidate);
    const selected = optionsFor("shirt.collar").find(option => option.id === exactId);
    assert.ok(selected, "variant must exist in the shared canonical option library");
    assert.equal(selected.renderSupport.livePreview, "none",
      "matching a label cannot assert approved photo construction");
    assert.deepEqual(issueCodes(candidate, exactId), [], candidate);
    const locked = { collar: genericId };
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateCollarIssues(candidate, locked).map(x => x.code),
      ["candidate_collar_mismatch"], candidate);
    assert.equal(JSON.stringify(locked), before, "locked generic choice must not be rewritten");
  }
});

test("negative, optional and mixed collar variant phrases never force a versioned variant", () => {
  for (const wording of [
    "No English Spread Collar", "Avoid Soft Button-Down Collar",
    "English Spread Collar is optional", "Optional Soft Button-Down Collar",
    "English Spread Collar Shirt with Camp Collar",
  ]) {
    assert.equal(styleDirectorCandidateVariantCollar(wording), null, wording);
  }
  assert.equal(styleDirectorCandidateVariantCollar("Spread Collar Shirt"), null);
  assert.equal(styleDirectorCandidateVariantCollar("Button-Down Collar Shirt"), null);
});
