import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePocket,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("unnecessary and not-necessary pockets do not authorize construction changes", () => {
  for (const phrase of [
    "flap pocket unnecessary",
    "patch pocket is unnecessary",
    "flap pocket not necessary",
    "patch pocket isn't necessary",
    "flap pocket not required",
  ]) {
    const intent = styleDirectorCandidatePocketIntent(phrase);
    assert.deepEqual(intent, { requested: null, prohibited: [], ambiguous: false }, phrase);
    assert.equal(styleDirectorCandidatePocket(phrase), null, phrase);
    const locked = Object.freeze({ pocket: "no_pocket" });
    const before = Object.getOwnPropertyDescriptors(locked);
    assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, locked), [], phrase);
    assert.deepEqual(Object.getOwnPropertyDescriptors(locked), before, phrase);
  }
});

test("optional pocket wording cannot suppress an independent explicit prohibition", () => {
  const phrase = "flap pocket is unnecessary, patch pocket must not be used";
  const intent = styleDirectorCandidatePocketIntent(phrase);
  assert.deepEqual(intent, {
    requested: null, prohibited: ["single_patch_pocket"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "single_patch_pocket" })
    .map(issue => issue.code), ["candidate_pocket_mismatch"]);
  assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "flap_pocket" }), []);
});
