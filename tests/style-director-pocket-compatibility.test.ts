import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  styleDirectorCandidatePocket,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorPresentationIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

const codes = (name: string, saved: string) =>
  styleDirectorCandidatePocketIssues(name, { pocket: saved }).map(issue => issue.code);
const wording = (name: string) =>
  styleDirectorCandidateWordingIssues(name).map(issue => issue.code);

test("real pocket catalogue IDs are selected only for explicit construction names", () => {
  const cases = [
    ["No Pocket", "no_pocket"],
    ["Pocketless Shirt", "no_pocket"],
    ["Without any pockets", "no_pocket"],
    ["Single Patch Pocket Shirt", "single_patch_pocket"],
    ["Patch Pocket Shirt", "single_patch_pocket"],
    ["Flap Pocket Shirt", "flap_pocket"],
  ] as const;
  for (const [label, id] of cases) {
    assert.ok(optionsFor("shirt.pocket").some(option => option.id === id), label);
    assert.deepEqual(styleDirectorCandidatePocketIntent(label), {
      requested: id, prohibited: [], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidatePocket(label), id, label);
    assert.deepEqual(codes(label, id), [], label);
    assert.deepEqual(wording(label), [], label);
  }
  for (const label of ["Pocket shirt", "One pocket", "Pocket printing", "Pocketable travel shirt"]) {
    assert.equal(styleDirectorCandidatePocket(label), null, label);
    assert.deepEqual(wording(label), [], label);
  }
});

test("forbidden pocket construction does not become a positive construction", () => {
  for (const label of [
    "No Flap Pocket",
    "Avoid Flap Pocket",
    "Without a Flap Pocket",
    "Flap Pocket is forbidden",
  ]) {
    assert.deepEqual(styleDirectorCandidatePocketIntent(label), {
      requested: null, prohibited: ["flap_pocket"], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidatePocket(label), null, label);
    const locked = { pocket: "single_patch_pocket" };
    const snapshot = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidatePocketIssues(label, locked), [], label);
    assert.deepEqual(codes(label, "flap_pocket"), ["candidate_pocket_mismatch"], label);
    assert.deepEqual(wording(label), [], label);
    assert.equal(JSON.stringify(locked), snapshot);
  }
});

test("optional pockets do not force a new cut, while a separate negative remains active", () => {
  for (const label of [
    "Optional Flap Pocket",
    "Flap Pocket is optional",
    "Maybe Patch Pocket",
    "Optional No Pocket",
  ]) {
    assert.deepEqual(styleDirectorCandidatePocketIntent(label), {
      requested: null, prohibited: [], ambiguous: false,
    }, label);
    assert.equal(styleDirectorCandidatePocket(label), null, label);
    assert.deepEqual(codes(label, "no_pocket"), [], label);
  }
  const label = "Avoid Flap Pocket; Optional Patch Pocket";
  assert.deepEqual(styleDirectorCandidatePocketIntent(label), {
    requested: null, prohibited: ["flap_pocket"], ambiguous: false,
  });
  assert.deepEqual(codes(label, "single_patch_pocket"), []);
  assert.deepEqual(codes(label, "flap_pocket"), ["candidate_pocket_mismatch"]);
});

test("explicit no-pocket and positive pocket contradictions require wording review", () => {
  for (const label of [
    "No Pocket; Flap Pocket Shirt",
    "Flap Pocket; Patch Pocket Shirt",
    "Avoid Flap Pocket; Flap Pocket Shirt",
  ]) {
    assert.deepEqual(wording(label), ["ambiguous_candidate_pocket"], label);
    assert.equal(styleDirectorCandidatePocket(label), null, label);
    assert.deepEqual(codes(label, "no_pocket"), [], label);
  }
  const compatible = "No Flap Pocket; Single Patch Pocket Shirt";
  assert.deepEqual(styleDirectorCandidatePocketIntent(compatible), {
    requested: "single_patch_pocket", prohibited: ["flap_pocket"], ambiguous: false,
  });
  assert.equal(styleDirectorCandidatePocket(compatible), "single_patch_pocket");
  assert.deepEqual(wording(compatible), []);
});

test("pocket construction survives new proposals without false photographic parity", () => {
  const source = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(source.includes("const namedPocket=styleDirectorCandidatePocket(shirt)"));
  assert.ok(source.includes("if (namedPocket) spec.shirt.pocket=namedPocket"));
  assert.ok(source.includes("...styleDirectorCandidatePocketIssues(candidate.garments.shirt, styleSpec.shirt)"));
  const shirt = { collar: "spread_collar", wear: "tucked", pocket: "flap_pocket" };
  const spec = { shirt } as unknown as Pick<StyleSpecV2, "shirt">;
  const before = JSON.stringify(spec);
  assert.deepEqual(styleDirectorPresentationIssues(
    { collar: "Spread Collar", shirtWear: "Tucked" }, spec,
  ).map(issue => issue.code), ["unverified_pocket_photo"]);
  assert.equal(JSON.stringify(spec), before, "photographic review must not rewrite the locked ID");
  const noPocket = { shirt: { ...shirt, pocket: "no_pocket" } } as unknown as Pick<StyleSpecV2, "shirt">;
  assert.deepEqual(styleDirectorPresentationIssues(
    { collar: "Spread Collar", shirtWear: "Tucked" }, noPocket,
  ).map(issue => issue.code), []);
});

test("with-or-without pocket alternatives require review without choosing a saved construction", () => {
  for (const phrase of [
    "with or without a pocket",
    "with or without pockets",
    "with or without any pockets",
    "with or without patch pocket",
    "with or without a flap pocket",
    "with or without single patch pocket",
    "with without a pocket",
  ]) {
    assert.deepEqual(styleDirectorCandidatePocketIntent(phrase), {
      requested: null, prohibited: [], ambiguous: true,
    }, phrase);
    assert.equal(styleDirectorCandidatePocket(phrase), null, phrase);
    assert.deepEqual(wording(phrase), ["ambiguous_candidate_pocket"], phrase);
    for (const id of ["no_pocket", "single_patch_pocket", "flap_pocket"]) {
      const locked = Object.freeze({ pocket: id });
      const snapshot = JSON.stringify(locked);
      assert.deepEqual(styleDirectorCandidatePocketIssues(phrase, locked), [], phrase);
      assert.equal(JSON.stringify(locked), snapshot, "locked pocket cannot be rewritten");
    }
  }
});

test("undecided pockets keep independent constraints and ordinary firm negations", () => {
  const phrase = "with or without flap pocket; no patch pocket";
  assert.deepEqual(styleDirectorCandidatePocketIntent(phrase), {
    requested: null, prohibited: ["single_patch_pocket"], ambiguous: true,
  });
  assert.equal(styleDirectorCandidatePocket(phrase), null);
  assert.deepEqual(wording(phrase), ["ambiguous_candidate_pocket"]);
  for (const [label, id] of [
    ["No Pocket", "no_pocket"],
    ["Without any pockets", "no_pocket"],
    ["Patch Pocket Shirt", "single_patch_pocket"],
    ["Flap Pocket Shirt", "flap_pocket"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidatePocketIntent(label), {
      requested: id, prohibited: [], ambiguous: false,
    }, label);
  }
  assert.deepEqual(styleDirectorCandidatePocketIntent("No Flap Pocket"), {
    requested: null, prohibited: ["flap_pocket"], ambiguous: false,
  });
});
