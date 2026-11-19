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
