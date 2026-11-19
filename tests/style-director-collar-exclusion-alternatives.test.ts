import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateOrdinaryCollar,
  styleDirectorCandidateVariantCollar,
} from "../src/lib/designer/style-director-compatibility.ts";

// A rejected construction must not become the selected canonical collar merely
// because its name is present beside an independently requested alternative.
test("collar exclusions preserve separately requested canonical constructions", () => {
  for (const phrase of [
    "Camp collar is not feasible; spread collar requested",
    "No camp collar; spread collar requested",
    "Camp collar cannot be used; spread collar requested",
    "Band collar ruled out; spread collar requested",
    "Cutaway collar is unsuitable; spread collar requested",
  ]) {
    assert.equal(styleDirectorCandidateOrdinaryCollar(phrase), "spread", phrase);
    assert.equal(styleDirectorCandidateVariantCollar(phrase), null, phrase);
    assert.equal(styleDirectorCandidateOrdinaryCollar(phrase), "spread", phrase);
  }
});

test("specific collar variant prohibitions do not select the prohibited variant", () => {
  for (const phrase of [
    "English spread collar is not feasible",
    "Soft button-down collar cannot be used",
  ]) {
    assert.equal(styleDirectorCandidateVariantCollar(phrase), null, phrase);
    assert.equal(styleDirectorCandidateOrdinaryCollar(phrase), null, phrase);
  }
});

test("no-longer-permitted collars remain exclusions rather than new selections", () => {
  for (const phrase of [
    "Camp collar is no longer allowed; spread collar requested",
    "Band collar no longer permitted; spread collar requested",
    "Cutaway collar is no longer recommended; spread collar requested",
    "Camp collar no longer acceptable; spread collar requested",
  ]) {
    assert.equal(styleDirectorCandidateOrdinaryCollar(phrase), "spread", phrase);
    assert.equal(styleDirectorCandidateVariantCollar(phrase), null, phrase);
    assert.equal(styleDirectorCandidateOrdinaryCollar(phrase), "spread", "repeatability: " + phrase);
  }
  for (const phrase of [
    "English spread collar is no longer permitted",
    "Soft button-down collar is no longer allowed",
  ]) {
    assert.equal(styleDirectorCandidateVariantCollar(phrase), null, phrase);
    assert.equal(styleDirectorCandidateOrdinaryCollar(phrase), null, phrase);
  }
});

test("withdrawn collar approval never overrides an independent spread selection", () => {
  for (const phrase of [
    "Band collar is no longer suitable; spread collar requested",
    "Camp collar is no longer permitted; spread collar requested",
    "Cutaway collar no longer allowed; spread collar requested",
  ]) {
    const first = [
      styleDirectorCandidateOrdinaryCollar(phrase),
      styleDirectorCandidateVariantCollar(phrase),
    ];
    assert.deepEqual(first, ["spread", null], phrase);
    assert.deepEqual([
      styleDirectorCandidateOrdinaryCollar(phrase),
      styleDirectorCandidateVariantCollar(phrase),
    ], first, "deterministic replay: " + phrase);
  }
});
