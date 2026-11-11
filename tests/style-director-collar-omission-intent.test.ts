import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateOrdinaryCollar,
  styleDirectorCandidateVariantCollar,
} from "../src/lib/designer/style-director-compatibility.ts";

test("omit exclude and skip are prohibitions, never positive collar choices", () => {
  const cases = [
    [
        "Omit camp collar",
        "cuban_camp_collar",
        "spread_collar"
    ],
    [
        "Please omit the Cuban collar",
        "cuban_camp_collar",
        "spread_collar"
    ],
    [
        "Exclude band collar",
        "mandarin_band_collar",
        "spread_collar"
    ],
    [
        "Skip cutaway collar",
        "cutaway_collar",
        "spread_collar"
    ],
    [
        "Exclude English Spread collar",
        "english_spread_collar",
        "spread_collar"
    ],
    [
        "Omit Soft Button-Down collar",
        "soft_button_down",
        "spread_collar"
    ]
] as const;
  for (const [wording, forbidden, allowed] of cases) {
    const locked = Object.freeze({ collar: forbidden });
    const original = JSON.stringify(locked);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
    assert.equal(styleDirectorCandidateOrdinaryCollar(wording), null, wording);
    assert.equal(styleDirectorCandidateVariantCollar(wording), null, wording);
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(wording, locked).map(x => x.code),
      ["candidate_collar_mismatch"], wording,
    );
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, { collar: allowed }), [], wording);
    assert.equal(JSON.stringify(locked), original, "locked selections must remain unchanged");
  }
});

test("omit is independent of a valid affirmative and preserves option IDs", () => {
  const requested = "Omit camp collar; choose spread collar";
  assert.equal(styleDirectorCandidateOrdinaryCollar(requested), "spread");
  assert.deepEqual(styleDirectorCandidateCollarIssues(requested, { collar: "spread_collar" }), []);
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(requested, { collar: "cuban_camp_collar" }).map(x => x.code),
    ["candidate_collar_mismatch"],
  );
  const variant = "Exclude English Spread collar; choose spread collar";
  assert.equal(styleDirectorCandidateOrdinaryCollar(variant), "spread");
  assert.deepEqual(styleDirectorCandidateCollarIssues(variant, { collar: "spread_collar" }), []);
  assert.deepEqual(
    styleDirectorCandidateCollarIssues(variant, { collar: "english_spread_collar" }).map(x => x.code),
    ["candidate_collar_mismatch"],
  );
});
