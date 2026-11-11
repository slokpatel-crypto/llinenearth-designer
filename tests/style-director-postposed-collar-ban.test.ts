import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateCollarIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("postposed is-not-to-be collar bans cannot select or approve a forbidden locked collar", () => {
  const prohibited = [
    "Camp collar is not to be used",
    "Camp collar is not to be selected",
    "Camp collar is not to be worn",
    "Camp collar is not to be chosen",
    "Camp collar is not to be used; choose spread collar",
  ];
  for (const phrase of prohibited) {
    const locked = Object.freeze({ collar: "cuban_camp_collar" });
    const before = JSON.stringify(locked);
    assert.equal(styleDirectorCandidateCollar(phrase, []), null, phrase);
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(phrase, locked).map(issue => issue.code),
      ["candidate_collar_mismatch"],
      phrase,
    );
    assert.equal(JSON.stringify(locked), before, "locked construction must remain immutable");
    assert.deepEqual(
      styleDirectorCandidateCollarIssues(phrase, { collar: "spread_collar" }),
      [],
      phrase,
    );
  }
});
