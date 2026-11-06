import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateShirtFit,
  styleDirectorCandidateShirtFitIntent,
  styleDirectorCandidateShirtFitIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";

const choices = optionsFor("shirt.fit")
  .filter(option => option.legacySelectable !== false)
  .map(option => option.legacyLabel || option.label);
const issueCodes = (label: string, locked: string) =>
  styleDirectorCandidateShirtFitIssues(label, { fit: locked }).map(issue => issue.code);
const wordingCodes = (label: string) =>
  styleDirectorCandidateWordingIssues(label).map(issue => issue.code);

test("canonical Boxy / Oversized Fit label maps to the existing canonical ID", () => {
  const entry = optionsFor("shirt.fit").find(option => option.id === "boxy_oversized");
  assert.equal(entry?.label, "Boxy / Oversized Fit");
  for (const label of [
    "Boxy / Oversized Fit Shirt",
    "Boxy & Oversized Fit Shirt",
    "Boxy-Oversized Fit Shirt",
  ]) {
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(label), {
      requested: "boxy_oversized", prohibited: [], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidateShirtFit(label, choices)?.versioned, "boxy_oversized", label);
    assert.deepEqual(issueCodes(label, "boxy_oversized"), [], label);
    assert.deepEqual(issueCodes(label, "slim_fit"), ["candidate_shirt_fit_mismatch"], label);
    assert.deepEqual(wordingCodes(label), [], label);
  }
});

test("negative Boxy / Oversized Fit is a ban, not a selection", () => {
  for (const label of [
    "No Boxy / Oversized Fit",
    "Avoid Boxy / Oversized Fit",
    "Without Boxy & Oversized Fit",
    "Boxy / Oversized Fit is forbidden",
  ]) {
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(label), {
      requested: null, prohibited: ["boxy_oversized"], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidateShirtFit(label, choices), null, label);
    const locked = { fit: "regular_classic_fit" };
    const snapshot = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(label, locked), [], label);
    assert.deepEqual(issueCodes(label, "boxy_oversized"), ["candidate_shirt_fit_mismatch"], label);
    assert.deepEqual(wordingCodes(label), [], label);
    assert.equal(JSON.stringify(locked), snapshot);
  }
});

test("optional Boxy / Oversized Fit is not an instruction", () => {
  for (const label of [
    "Optional Boxy / Oversized Fit",
    "Boxy / Oversized Fit is optional",
    "Maybe Boxy & Oversized Fit",
  ]) {
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(label), {
      requested: null, prohibited: [], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidateShirtFit(label, choices), null, label);
    assert.deepEqual(issueCodes(label, "regular_classic_fit"), [], label);
  }
});

test("compound boxy fit prohibition coexists with different requested fit, contradiction remains review-only", () => {
  const valid = "No Boxy / Oversized Fit; Relaxed Fit Shirt";
  assert.deepEqual(styleDirectorCandidateShirtFitIntent(valid), {
    requested: "relaxed_fit", prohibited: ["boxy_oversized"], ambiguous: false,
  });
  assert.deepEqual(issueCodes(valid, "relaxed_fit"), []);
  assert.deepEqual(issueCodes(valid, "boxy_oversized"), ["candidate_shirt_fit_mismatch"]);
  assert.deepEqual(wordingCodes(valid), []);
  const contradictory = "No Boxy / Oversized Fit; Boxy / Oversized Fit Shirt";
  assert.deepEqual(styleDirectorCandidateShirtFitIntent(contradictory), {
    requested: "boxy_oversized", prohibited: ["boxy_oversized"], ambiguous: true,
  });
  assert.deepEqual(wordingCodes(contradictory), ["ambiguous_candidate_shirt_fit"]);
  assert.equal(styleDirectorCandidateShirtFit(contradictory, choices), null);
  assert.deepEqual(issueCodes(contradictory, "boxy_oversized"), [],
    "the wording gate owns contradictions and never rewrites a locked fit");
});
