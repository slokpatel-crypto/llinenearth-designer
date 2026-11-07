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

test("specific variant prohibition leaves the ordinary collar in the same family available", () => {
  for (const [ban, forbiddenId, ordinaryId] of [
    ["No English Spread Collar", "english_spread_collar", "spread_collar"],
    ["Avoid Soft Button-Down Collar", "soft_button_down", "button_down_collar"],
    ["English Spread Collar is forbidden", "english_spread_collar", "spread_collar"],
    ["Soft Button-Down Collar is prohibited", "soft_button_down", "button_down_collar"],
  ] as const) {
    const locked = { collar: ordinaryId };
    const before = JSON.stringify(locked);
    assert.deepEqual(issueCodes(ban, forbiddenId), ["candidate_collar_mismatch"], ban);
    assert.deepEqual(styleDirectorCandidateCollarIssues(ban, locked), [], ban);
    assert.deepEqual(styleDirectorCandidateWordingIssues(ban), [], ban);
    assert.equal(JSON.stringify(locked), before, "variant prohibitions cannot rewrite an ordinary collar");
  }
});

test("whole-family bans still exclude all variants; generic requests can coexist with variant bans", () => {
  for (const [name, ordinaryId, variantId] of [
    ["No Spread Collar", "spread_collar", "english_spread_collar"],
    ["Without Button-Down Collar", "button_down_collar", "soft_button_down"],
  ] as const) {
    for (const id of [ordinaryId, variantId]) {
      assert.deepEqual(issueCodes(name, id), ["candidate_collar_mismatch"], name + "/" + id);
    }
  }
  for (const [name, ordinaryId, variantId] of [
    ["No English Spread Collar; Spread Collar Shirt", "spread_collar", "english_spread_collar"],
    ["Avoid Soft Button-Down Collar; Button-Down Collar Shirt", "button_down_collar", "soft_button_down"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
    assert.deepEqual(issueCodes(name, ordinaryId), [], name);
    assert.deepEqual(issueCodes(name, variantId), ["candidate_collar_mismatch"], name);
    assert.equal(styleDirectorCandidateVariantCollar(name), null, name);
    assert.deepEqual(issueCodes(name, ordinaryId), issueCodes(name, ordinaryId),
      "rule output must be deterministic");
  }
  for (const name of [
    "No Spread Collar; English Spread Collar Shirt",
    "No Soft Button-Down Collar; Soft Button-Down Collar Shirt",
  ]) {
    assert.equal(styleDirectorCandidateVariantCollar(name), null, name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name).map(issue => issue.code),
      ["ambiguous_candidate_collar"], name);
  }
});

test("catalogue English Spread / British Collar alias preserves the exact versioned ID", () => {
  const option = optionsFor("shirt.collar").find(entry => entry.id === "english_spread_collar");
  assert.equal(option?.label, "English Spread / British Collar");
  for (const name of [
    "English Spread / British Collar",
    "English Spread / British Collar Shirt",
    "English Spread & British Collar Shirt",
  ]) {
    assert.equal(styleDirectorCandidateOrdinaryCollar(name), "spread", name);
    assert.equal(styleDirectorCandidateVariantCollar(name), "english_spread_collar", name);
    assert.deepEqual(issueCodes(name, "english_spread_collar"), [], name);
    assert.deepEqual(issueCodes(name, "spread_collar"), ["candidate_collar_mismatch"], name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
  }
});

test("English Spread / British Collar bans and optional language do not choose a different construction", () => {
  for (const name of [
    "No English Spread / British Collar",
    "Avoid English Spread / British Collar",
    "English Spread / British Collar is forbidden",
  ]) {
    const saved = { collar: "spread_collar" };
    const before = JSON.stringify(saved);
    assert.equal(styleDirectorCandidateVariantCollar(name), null, name);
    assert.deepEqual(styleDirectorCandidateCollarIssues(name, saved), [], name);
    assert.deepEqual(issueCodes(name, "english_spread_collar"), ["candidate_collar_mismatch"], name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
    assert.equal(JSON.stringify(saved), before);
  }
  for (const name of [
    "Optional English Spread / British Collar",
    "English Spread / British Collar is optional",
  ]) {
    assert.equal(styleDirectorCandidateVariantCollar(name), null, name);
    assert.deepEqual(issueCodes(name, "spread_collar"), [], name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
  }
  const contradictory = "No English Spread / British Collar; English Spread / British Collar Shirt";
  assert.equal(styleDirectorCandidateVariantCollar(contradictory), null);
  assert.deepEqual(styleDirectorCandidateWordingIssues(contradictory).map(x => x.code),
    ["ambiguous_candidate_collar"]);
});
