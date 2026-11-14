import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePocket,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

// Modal prohibitions must not be misread as an affirmative flap-pocket request.
test("modal pocket exclusions retain existing non-flap construction", () => {
  for (const phrase of [
    "must not use flap pocket",
    "should not add flap pocket",
    "cannot have flap pocket",
    "can't wear flap pocket",
    "mustn't choose flap pocket",
    "may not include flap pocket",
  ]) {
    const intent = styleDirectorCandidatePocketIntent(phrase);
    assert.equal(intent.requested, null, phrase);
    assert.deepEqual(intent.prohibited, ["flap_pocket"], phrase);
    assert.equal(intent.ambiguous, false, phrase);
    assert.equal(styleDirectorCandidatePocket(phrase), null, phrase);
    const permitted = Object.freeze({ pocket: "single_patch_pocket" });
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, permitted), [], phrase);
    const banned = Object.freeze({ pocket: "flap_pocket" });
    const issues = styleDirectorCandidatePocketIssues(phrase, banned);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_pocket_mismatch"], phrase);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, banned), issues, phrase);
    assert.equal(banned.pocket, "flap_pocket");
  }
});

test("modal pocket bans do not trust inherited or accessor-backed saved choices", () => {
  let calls = 0;
  const inherited = Object.create({ pocket: "single_patch_pocket" });
  const accessor = Object.create(null);
  Object.defineProperty(accessor, "pocket", {
    enumerable: true,
    get() { calls++; throw new Error("untrusted pocket getter"); },
  });
  for (const saved of [inherited, accessor, { pocket: "retired_pocket" }]) {
    assert.deepEqual(styleDirectorCandidatePocketIssues("must not use flap pocket", saved)
      .map(issue => issue.code), ["candidate_pocket_mismatch"]);
  }
  assert.equal(calls, 0);
});
