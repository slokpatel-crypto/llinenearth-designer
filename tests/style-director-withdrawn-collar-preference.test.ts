import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateOrdinaryCollar,
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";

const photographed = optionsFor("shirt.collar")
  .filter(option => option.legacySelectable !== false)
  .map(option => option.legacyLabel || option.label);

test("withdrawn collar preferences are exclusions, not construction requests", () => {
  for (const [wording, prohibited, alternative] of [
    ["Camp Collar is no longer desired", "cuban_camp_collar", "spread_collar"],
    ["Band Collar no longer wanted", "mandarin_band_collar", "spread_collar"],
    ["Cutaway Collar is no longer preferred", "cutaway_collar", "spread_collar"],
    ["Club Collar no longer advisable", "club_collar", "spread_collar"],
    ["Wing Collar is no longer ideal", "wing_collar", "spread_collar"],
  ] as const) {
    const saved = { collar: prohibited };
    const original = JSON.stringify(saved);
    assert.equal(styleDirectorCandidateCollar(wording, photographed), null, wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, saved).map(x => x.code),
      ["candidate_collar_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, { collar: alternative }), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), [], wording);
    assert.equal(JSON.stringify(saved), original, "locked collar ID must remain unchanged");
  }
});

test("withdrawn preference does not suppress separately requested collar", () => {
  const wording = "Camp Collar no longer desired; Spread Collar Shirt";
  assert.equal(styleDirectorCandidateOrdinaryCollar(wording), "spread");
  assert.equal(styleDirectorCandidateCollar(wording, photographed), null,
    "advanced-collar resolver must not claim an ordinary spread collar");
  assert.deepEqual(styleDirectorCandidateCollarIssues(wording, { collar: "spread_collar" }), []);
  assert.deepEqual(styleDirectorCandidateCollarIssues(wording, { collar: "cuban_camp_collar" })
    .map(x => x.code), ["candidate_collar_mismatch"]);
});
