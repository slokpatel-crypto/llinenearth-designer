import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorCandidateVariantCollar,
} from "../src/lib/designer/style-director-compatibility.ts";

// A banned variant must not forbid its still-available ordinary sibling.
// Preserve the saved canonical ID and require review only for the forbidden ID.
test("variant-specific collar prohibitions preserve permitted locked sibling", () => {
  for (const [instruction, forbidden, permitted] of [
    ["No English Spread Collar", "english_spread_collar", "spread_collar"],
    ["No Soft Button-Down Collar", "soft_button_down", "button_down_collar"],
  ] as const) {
    const locked = { collar: permitted };
    const snapshot = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateCollarIssues(instruction, locked), []);
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(instruction, { collar: forbidden }).map(issue => issue.code),
      ["candidate_collar_mismatch"],
    );
    assert.deepEqual(styleDirectorCandidateWordingIssues(instruction), []);
    assert.equal(styleDirectorCandidateVariantCollar(instruction), null);
    assert.equal(JSON.stringify(locked), snapshot);
  }
});

test("a permitted ordinary collar remains selectable beside an explicit variant ban", () => {
  const cases = [
    ["No English Spread Collar; Spread Collar Shirt", "spread_collar", "english_spread_collar"],
    ["No Soft Button-Down Collar; Button-Down Collar Shirt", "button_down_collar", "soft_button_down"],
  ] as const;
  for (const [instruction, permitted, forbidden] of cases) {
    const locked = { collar: permitted };
    const snapshot = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateCollarIssues(instruction, locked), []);
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(instruction, { collar: forbidden }).map(issue => issue.code),
      ["candidate_collar_mismatch"],
    );
    assert.deepEqual(styleDirectorCandidateWordingIssues(instruction), []);
    assert.equal(JSON.stringify(locked), snapshot);
  }
});

test("modal collar bans reject only the named variant and retain allowed siblings", () => {
  for (const [instruction, forbidden, permitted] of [
    ["Must not use English Spread Collar", "english_spread_collar", "spread_collar"],
    ["Should not select Soft Button-Down Collar", "soft_button_down", "button_down_collar"],
    ["Cannot wear English Spread Collar", "english_spread_collar", "spread_collar"],
    ["Can't choose Soft Button-Down Collar", "soft_button_down", "button_down_collar"],
    ["Mustn't include English Spread Collar", "english_spread_collar", "spread_collar"],
    ["Shouldn't have Soft Button-Down Collar", "soft_button_down", "button_down_collar"],
  ] as const) {
    const locked = { collar: permitted };
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateCollarIssues(instruction, locked), []);
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(instruction, { collar: forbidden }).map(issue => issue.code),
      ["candidate_collar_mismatch"],
    );
    assert.deepEqual(styleDirectorCandidateWordingIssues(instruction), []);
    assert.equal(styleDirectorCandidateVariantCollar(instruction), null);
    assert.equal(JSON.stringify(locked), before);
  }
});
