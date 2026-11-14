import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidatePlacket,
  styleDirectorCandidatePlacketIntent,
  styleDirectorCandidatePlacketIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";

const photographed = optionsFor("shirt.placket")
  .filter(option => option.legacySelectable !== false)
  .map(option => option.legacyLabel || option.label);
const issues = (label: string, savedId: string) =>
  styleDirectorCandidatePlacketIssues(label, { placket: savedId }).map(issue => issue.code);

test("canonical Standard (visible stitch) label selects the exact placket ID", () => {
  const option = optionsFor("shirt.placket").find(value => value.id === "standard_visible_placket");
  assert.equal(option?.label, "Standard (visible stitch)");
  for (const label of ["Standard (visible stitch)", "Standard (visible stitch) Placket Shirt"]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(label), {
      requested: "standard_visible_placket", prohibited: [], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidatePlacket(label, photographed)?.versioned, "standard_visible_placket");
    assert.deepEqual(issues(label, "standard_visible_placket"), [], label);
    assert.deepEqual(issues(label, "hidden_fly_front"), ["candidate_placket_mismatch"], label);
  }
});

test("canonical Hidden / Fly-front is parsed atomically under prohibition", () => {
  const option = optionsFor("shirt.placket").find(value => value.id === "hidden_fly_front");
  assert.equal(option?.label, "Hidden / Fly-front");
  for (const label of ["Hidden / Fly-front", "Hidden / Fly-front Placket Shirt"]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(label), {
      requested: "hidden_fly_front", prohibited: [], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidatePlacket(label, photographed)?.versioned, "hidden_fly_front");
    assert.deepEqual(issues(label, "hidden_fly_front"), [], label);
    assert.deepEqual(issues(label, "standard_visible_placket"), ["candidate_placket_mismatch"], label);
  }
  for (const label of ["No Hidden / Fly-front", "Without Hidden / Fly-front Placket"]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(label), {
      requested: null, prohibited: ["hidden_fly_front"], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidatePlacket(label, photographed), null);
    const locked = { placket: "standard_visible_placket" };
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(label, locked), [], label);
    assert.deepEqual(issues(label, "hidden_fly_front"), ["candidate_placket_mismatch"], label);
    assert.deepEqual(styleDirectorCandidateWordingIssues(label), [], label);
    assert.equal(JSON.stringify(locked), before);
  }
});

test("canonical placket optional phrases do not create mandatory constraints", () => {
  for (const label of [
    "Optional Standard (visible stitch)",
    "Standard (visible stitch) is optional",
    "Optional Hidden / Fly-front",
    "Hidden / Fly-front is optional",
  ]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(label), {
      requested: null, prohibited: [], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidatePlacket(label, photographed), null);
    assert.deepEqual(issues(label, "contrast_placket"), [], label);
  }
});

test("full canonical placket bans and contradictions cannot silently choose a lock", () => {
  const ban = "No Standard (visible stitch)";
  assert.deepEqual(styleDirectorCandidatePlacketIntent(ban), {
    requested: null, prohibited: ["standard_visible_placket"], ambiguous: false,
  });
  assert.deepEqual(issues(ban, "standard_visible_placket"), ["candidate_placket_mismatch"]);
  assert.deepEqual(issues(ban, "hidden_fly_front"), []);
  for (const label of [
    "No Standard (visible stitch); Standard (visible stitch)",
    "No Hidden / Fly-front; Hidden / Fly-front",
  ]) {
    assert.equal(styleDirectorCandidatePlacketIntent(label).ambiguous, true, label);
    assert.equal(styleDirectorCandidatePlacket(label, photographed), null, label);
    assert.ok(styleDirectorCandidateWordingIssues(label).some(issue =>
      issue.code === "ambiguous_candidate_placket"), label);
  }
});

test("generic hidden wording alone is not proof of a placket construction", () => {
  for (const label of ["Hidden buttons", "Hidden stitching", "Visible collar stitching"]) {
    assert.equal(styleDirectorCandidatePlacketIntent(label).requested, null, label);
    assert.equal(styleDirectorCandidatePlacket(label, photographed), null, label);
  }
});

test("with-or-without plackets are unresolved, never a ban or selected construction", () => {
  for (const wording of [
    "with or without hidden placket",
    "with or without a hidden placket",
    "with or without a Hidden / Fly-front",
    "with or without standard (visible stitch)",
    "with or without a contrast placket",
    "with or without french placket",
    "with without covered placket",
  ]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: [], ambiguous: true,
    }, wording);
    assert.equal(styleDirectorCandidatePlacket(wording, photographed), null, wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording)
      .map(issue => issue.code), ["ambiguous_candidate_placket"], wording);
    for (const id of [
      "standard_visible_placket", "hidden_fly_front", "french_placket",
      "covered_placket", "contrast_placket",
    ]) {
      const saved = Object.freeze({ placket: id });
      const original = JSON.stringify(saved);
      assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, saved), [], wording);
      assert.equal(JSON.stringify(saved), original, "locked placket must not change");
    }
  }
});

test("undecided plackets keep independent prohibitions and ordinary firm instructions", () => {
  const mixed = "with or without hidden placket; no french placket";
  assert.deepEqual(styleDirectorCandidatePlacketIntent(mixed), {
    requested: null, prohibited: ["french_placket"], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidateWordingIssues(mixed)
    .map(issue => issue.code), ["ambiguous_candidate_placket"]);
  const affirmative = "with or without contrast placket; hidden placket required";
  assert.deepEqual(styleDirectorCandidatePlacketIntent(affirmative), {
    requested: "hidden_fly_front", prohibited: [], ambiguous: true,
  });
  assert.deepEqual(styleDirectorCandidateWordingIssues(affirmative)
    .map(issue => issue.code), ["ambiguous_candidate_placket"]);
  assert.deepEqual(styleDirectorCandidatePlacketIntent("No Hidden / Fly-front"), {
    requested: null, prohibited: ["hidden_fly_front"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidatePlacketIntent("Hidden / Fly-front"), {
    requested: "hidden_fly_front", prohibited: [], ambiguous: false,
  });
});
