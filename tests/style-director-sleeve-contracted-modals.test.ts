import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateSleeve,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("contracted modal sleeve bans reject forbidden locked lengths without rewriting selection", () => {
  const cases = [
    ["Short sleeves shouldn't be selected", "half_sleeve", "full_sleeve"],
    ["Half sleeves mustn't be used", "half_sleeve", "full_sleeve"],
    ["Short sleeves shouldn’t be chosen", "half_sleeve", "full_sleeve"],
    ["Long sleeves mustn’t be worn", "full_sleeve", "half_sleeve"],
    ["Full sleeves should not be selected", "full_sleeve", "half_sleeve"],
  ] as const;
  for (const [wording, forbidden, allowed] of cases) {
    assert.equal(styleDirectorCandidateSleeve(wording), null, wording);
    assert.deepEqual(
      styleDirectorCandidateWordingIssues(wording).filter(issue => issue.code === "ambiguous_candidate_sleeve"),
      [], wording,
    );
    for (const [lockedSleeve, expected] of [
      [forbidden, ["candidate_sleeve_mismatch"]],
      [allowed, []],
    ] as const) {
      const locked = Object.freeze({ sleeve: lockedSleeve });
      const before = JSON.stringify(locked);
      const first = styleDirectorCandidateSleeveIssues(wording, locked).map(issue => issue.code);
      assert.deepEqual(first, expected, wording);
      assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, locked).map(issue => issue.code), first);
      assert.equal(JSON.stringify(locked), before, "locked canonical ID must remain unchanged");
    }
  }
});

test("modal sleeve bans preserve independent positives, optional wording and contradictions", () => {
  assert.equal(styleDirectorCandidateSleeve("Short sleeves should be selected")?.sleeve, "half_sleeve");
  assert.equal(styleDirectorCandidateSleeve("Half sleeves aren't required"), null);
  assert.deepEqual(styleDirectorCandidateSleeveIssues("Half sleeves aren't required", { sleeve: "half_sleeve" }), []);
  assert.deepEqual(styleDirectorCandidateSleeveIssues("Short sleeves shouldn't be selected; full sleeves", {
    sleeve: "full_sleeve",
  }), []);
  assert.deepEqual(
    styleDirectorCandidateWordingIssues("Short sleeves shouldn't be selected; short sleeves required")
      .filter(issue => issue.code === "ambiguous_candidate_sleeve")
      .map(issue => issue.code),
    ["ambiguous_candidate_sleeve"],
  );
  assert.equal(styleDirectorCandidateSleeve("Short sleeves shouldn't be selected; short sleeves required"), null);
});
