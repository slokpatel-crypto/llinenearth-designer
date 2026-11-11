import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateOrdinaryCollar,
  styleDirectorCandidateVariantCollar,
} from "../src/lib/designer/style-director-compatibility.ts";

test("cannot and can't prevent a forbidden candidate collar being approved or selected", () => {
  const cases = [
    ["Cannot use the camp collar", "cuban_camp_collar"],
    ["Can't use a Cuban collar", "cuban_camp_collar"],
    ["Can’t select the band collar", "mandarin_band_collar"],
    ["Can not choose the cutaway collar", "cutaway_collar"],
    ["Cannot include English Spread collar", "english_spread_collar"],
    ["Can't wear Soft Button-Down collar", "soft_button_down"],
    ["Camp collar cannot be used", "cuban_camp_collar"],
    ["Band collar can't be selected", "mandarin_band_collar"],
    ["Cutaway collar can’t be worn", "cutaway_collar"],
    ["English Spread collar can not be included", "english_spread_collar"],
    ["Soft Button-Down collar cannot be added", "soft_button_down"],
  ] as const;
  for (const [wording, forbidden] of cases) {
    const locked = Object.freeze({ collar: forbidden });
    const before = JSON.stringify(locked);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
    assert.equal(styleDirectorCandidateOrdinaryCollar(wording), null, wording);
    assert.equal(styleDirectorCandidateVariantCollar(wording), null, wording);
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(wording, locked).map(issue => issue.code),
      ["candidate_collar_mismatch"], wording,
    );
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, { collar: "spread_collar" }), [], wording);
    assert.equal(JSON.stringify(locked), before, "locked selected IDs remain immutable");
  }
});

test("cannot exclusion permits an independent positive choice, not a substituted forbidden ID", () => {
  const wording = "Cannot use camp collar; choose spread collar";
  assert.equal(styleDirectorCandidateOrdinaryCollar(wording), "spread");
  assert.deepEqual(styleDirectorCandidateCollarIssues(wording, { collar: "spread_collar" }), []);
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(wording, { collar: "cuban_camp_collar" })
      .map(issue => issue.code), ["candidate_collar_mismatch"],
  );
  const variant = "English Spread collar can't be selected; choose spread collar";
  assert.equal(styleDirectorCandidateOrdinaryCollar(variant), "spread");
  assert.deepEqual(styleDirectorCandidateCollarIssues(variant, { collar: "spread_collar" }), []);
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(variant, { collar: "english_spread_collar" })
      .map(issue => issue.code), ["candidate_collar_mismatch"],
  );
});

test("positive can-be construction is not confused with a prohibition", () => {
  const positive = "Camp collar can be used";
  assert.deepEqual(styleDirectorCandidateCollar(positive, []),
    { legacy: null, versioned: "cuban_camp_collar" });
  assert.deepEqual(styleDirectorCandidateCollarIssues(positive, { collar: "cuban_camp_collar" }), []);
});
