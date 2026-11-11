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

test("contracted modal pocket bans fail closed for locked flap and patch pockets", () => {
  for (const [label, forbidden, allowed] of [
    ["Flap pocket shouldn't be selected", "flap_pocket", "single_patch_pocket"],
    ["Flap pocket mustn't be used", "flap_pocket", "no_pocket"],
    ["Flap pocket shouldn’t be chosen", "flap_pocket", "no_pocket"],
    ["Patch pocket mustn’t be worn", "single_patch_pocket", "flap_pocket"],
    ["Patch pocket should not be selected", "single_patch_pocket", "no_pocket"],
  ] as const) {
    const intent = { requested: null, prohibited: [forbidden], ambiguous: false };
    assert.deepEqual(styleDirectorCandidatePocketIntent(label), intent, label);
    assert.equal(styleDirectorCandidatePocket(label), null, label);
    const locked = Object.freeze({ pocket: forbidden });
    const before = JSON.stringify(locked);
    const issues = styleDirectorCandidatePocketIssues(label, locked);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_pocket_mismatch"], label);
    assert.deepEqual(styleDirectorCandidatePocketIssues(label, locked), issues, label);
    assert.equal(JSON.stringify(locked), before, "never rewrite the frozen canonical pocket ID");
    assert.deepEqual(styleDirectorCandidatePocketIssues(label, { pocket: allowed }), [], label);
    assert.deepEqual(styleDirectorCandidateWordingIssues(label), [], label);
  }
});

test("contracted pocket exclusions do not swallow positive alternatives or neutrality", () => {
  const wording = "Flap pocket shouldn't be selected; patch pocket required";
  assert.deepEqual(styleDirectorCandidatePocketIntent(wording), {
    requested: "single_patch_pocket", prohibited: ["flap_pocket"], ambiguous: false,
  });
  assert.equal(styleDirectorCandidatePocket(wording), "single_patch_pocket");
  assert.deepEqual(styleDirectorCandidatePocketIssues(wording, { pocket: "single_patch_pocket" }), []);
  assert.deepEqual(styleDirectorCandidateWordingIssues(wording), []);
  assert.deepEqual(styleDirectorCandidatePocketIntent("Flap pocket should be selected"), {
    requested: "flap_pocket", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidatePocketIntent("Flap pocket isn't required"), {
    requested: null, prohibited: [], ambiguous: false,
  });
  const contradictory = "Flap pocket shouldn't be selected; flap pocket required";
  assert.equal(styleDirectorCandidatePocketIntent(contradictory).ambiguous, true);
  assert.equal(styleDirectorCandidatePocket(contradictory), null);
  assert.ok(styleDirectorCandidateWordingIssues(contradictory)
    .some(issue => issue.code === "ambiguous_candidate_pocket"));
});
