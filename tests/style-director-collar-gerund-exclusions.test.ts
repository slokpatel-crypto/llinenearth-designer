import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateOrdinaryCollar,
  styleDirectorCandidateVariantCollar,
} from "../src/lib/designer/style-director-compatibility.ts";

test("gerund-form collar exclusions cannot be converted to a positive locked option", () => {
  const forbidden = [
    ["Avoid using a camp collar", "cuban_camp_collar"],
    ["Avoid wearing the Cuban collar", "cuban_camp_collar"],
    ["Avoid choosing the band collar", "mandarin_band_collar"],
    ["Avoid selecting cutaway collar", "cutaway_collar"],
    ["Avoid including the English Spread collar", "english_spread_collar"],
    ["Avoid adding the Soft Button-Down collar", "soft_button_down"],
    ["Don't include the camp collar", "cuban_camp_collar"],
    ["Do not use the band collar", "mandarin_band_collar"],
  ] as const;
  for (const [wording, id] of forbidden) {
    const locked = Object.freeze({ collar: id });
    const before = JSON.stringify(locked);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
    assert.equal(styleDirectorCandidateOrdinaryCollar(wording), null, wording);
    assert.equal(styleDirectorCandidateVariantCollar(wording), null, wording);
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(wording, locked).map(x => x.code),
      ["candidate_collar_mismatch"], wording,
    );
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(wording, { collar: "spread_collar" }),
      [], wording,
    );
    assert.equal(JSON.stringify(locked), before, "locked design must remain immutable");
  }
});

test("affirmative choices survive separate gerund prohibitions", () => {
  const mixed = "Avoid using a camp collar; select spread collar";
  assert.equal(styleDirectorCandidateOrdinaryCollar(mixed), "spread");
  assert.deepEqual(styleDirectorCandidateCollarIssues(mixed, { collar: "spread_collar" }), []);
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(mixed, { collar: "cuban_camp_collar" })
      .map(x => x.code), ["candidate_collar_mismatch"],
  );

  const specificVariant = "Avoid choosing English Spread collar; select spread collar";
  assert.equal(styleDirectorCandidateOrdinaryCollar(specificVariant), "spread");
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(specificVariant, { collar: "spread_collar" }), [],
  );
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(specificVariant, { collar: "english_spread_collar" })
      .map(x => x.code), ["candidate_collar_mismatch"],
  );
});

test("unprohibited affirmative gerund descriptions remain recognizable", () => {
  assert.equal(styleDirectorCandidateOrdinaryCollar("Wearing a spread collar"), "spread");
  assert.equal(styleDirectorCandidateCollar("Choosing a camp collar", []), null,
    "the exact advanced resolver requires its normal legacy choice contract");
  assert.deepEqual(
    styleDirectorCandidateCollarIssues("Choosing a camp collar", { collar: "cuban_camp_collar" }), [],
  );
});
