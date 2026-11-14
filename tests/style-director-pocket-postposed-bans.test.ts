import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidatePocket,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("postposed unwanted and modal bans do not select a forbidden pocket", () => {
  for (const label of [
    "Flap pocket is not wanted",
    "Flap pocket isn't wanted",
    "Flap pocket isn’t wanted",
    "Flap pocket unwanted",
    "Flap pocket should not be selected",
    "Flap pocket must not be used",
    "Flap pocket must not be worn",
    "Flap pocket should not be included",
    "Flap pocket shouldn’t be selected",
    "Flap pocket can’t be used",
    "Flap pocket cannot be chosen",
  ]) {
    assert.deepEqual(styleDirectorCandidatePocketIntent(label), {
      requested: null, prohibited: ["flap_pocket"], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidatePocket(label), null, label);
    const locked = Object.freeze({ pocket: "flap_pocket" });
    const issues = styleDirectorCandidatePocketIssues(label, locked);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_pocket_mismatch"], label);
    assert.deepEqual(styleDirectorCandidatePocketIssues(label, { pocket: "no_pocket" }), [], label);
    assert.deepEqual(styleDirectorCandidatePocketIssues(label, locked), issues);
    assert.equal(locked.pocket, "flap_pocket", "never rewrite a locked pocket");
  }
});

test("optional contracted pocket phrasing stays neutral", () => {
  for (const label of [
    "Flap pocket isn't required", "Flap pocket isn’t needed",
    "Flap pocket isn't mandatory", "Flap pocket is optional",
  ]) {
    assert.deepEqual(styleDirectorCandidatePocketIntent(label), {
      requested: null, prohibited: [], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidatePocket(label), null, label);
    assert.deepEqual(styleDirectorCandidatePocketIssues(label, { pocket: "flap_pocket" }), []);
  }
});

test("independent pocket request survives a different pocket prohibition", () => {
  const phrase = "Flap pocket isn't wanted; patch pocket required";
  assert.deepEqual(styleDirectorCandidatePocketIntent(phrase), {
    requested: "single_patch_pocket", prohibited: ["flap_pocket"], ambiguous: false,
  });
  assert.equal(styleDirectorCandidatePocket(phrase), "single_patch_pocket");
  assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "single_patch_pocket" }), []);
  assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, { pocket: "flap_pocket" })
    .map(issue => issue.code), ["candidate_pocket_mismatch"]);
  assert.deepEqual(styleDirectorCandidateWordingIssues(phrase), []);
});

test("contradictory pocket instructions trigger wording review", () => {
  const phrase = "Flap pocket isn't wanted; flap pocket required";
  assert.equal(styleDirectorCandidatePocketIntent(phrase).ambiguous, true);
  assert.equal(styleDirectorCandidatePocket(phrase), null);
  assert.ok(styleDirectorCandidateWordingIssues(phrase).some(issue =>
    issue.code === "ambiguous_candidate_pocket"));
  // The original no-pocket vocabulary is not a ban of its own canonical ID.
  assert.deepEqual(styleDirectorCandidatePocketIntent("No Pocket"), {
    requested: "no_pocket", prohibited: [], ambiguous: false,
  });
});

test("explicit pocket restrictions reject unreadable locked option IDs without rewriting them", () => {
  for (const wording of [
    "Flap pocket is not wanted",
    "Flap pocket should not be selected",
    "Patch pocket required",
  ]) {
    for (const pocket of [undefined, "retired_pocket_id", "wing_collar"]) {
      const locked = Object.freeze({ pocket }) as unknown as Parameters<typeof styleDirectorCandidatePocketIssues>[1];
      const snapshot = JSON.stringify(locked);
      const first = styleDirectorCandidatePocketIssues(wording, locked);
      assert.deepEqual(first.map(issue => issue.code), ["candidate_pocket_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidatePocketIssues(wording, locked), first);
      assert.equal(JSON.stringify(locked), snapshot, "saved pocket option must remain unchanged");
    }
  }
  assert.deepEqual(styleDirectorCandidatePocketIssues(
    "Flap pocket is not wanted", { pocket: "single_patch_pocket" }), []);
});
