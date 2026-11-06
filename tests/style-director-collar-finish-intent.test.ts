import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  styleDirectorCandidateCollarFinish,
  styleDirectorCandidateCollarFinishIntent,
  styleDirectorCandidateCollarFinishIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorPresentationIssues,
} from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

const issues = (candidate: string, collarFinish: string) =>
  styleDirectorCandidateCollarFinishIssues(candidate, { collarFinish }).map(issue => issue.code);
const wording = (candidate: string) =>
  styleDirectorCandidateWordingIssues(candidate).map(issue => issue.code);

test("canonical named collar finishes preserve existing option labels without inventing cloth", () => {
  const engineSource = readFileSync("src/lib/designer/engine.ts", "utf8");
  assert.ok(engineSource.includes('collarFinish: ["Self-fabric", "White contrast collar", "White contrast collar + cuffs"]'),
    "candidate construction choices must match the engine's existing closed vocabulary");
  for (const [candidate, expected] of [
    ["Self-fabric Collar Shirt", "Self-fabric"],
    ["White contrast collar Shirt", "White contrast collar"],
    ["White contrast collar + cuffs Shirt", "White contrast collar + cuffs"],
    ["White contrast collar and cuffs Shirt", "White contrast collar + cuffs"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateCollarFinishIntent(candidate), {
      requested: expected, prohibited: [], ambiguous: false,
    }, candidate);
    assert.equal(styleDirectorCandidateCollarFinish(candidate), expected, candidate);
    assert.deepEqual(issues(candidate, expected), [], candidate);
    assert.deepEqual(issues(candidate, expected === "Self-fabric" ? "White contrast collar" : "Self-fabric"),
      ["candidate_collar_finish_mismatch"], candidate);
    assert.deepEqual(wording(candidate), [], candidate);
  }
});

test("negative contrast finish never becomes a positive selection", () => {
  for (const candidate of [
    "No White contrast collar",
    "Avoid White contrast collar",
    "White contrast collar is forbidden",
  ]) {
    const intent = styleDirectorCandidateCollarFinishIntent(candidate);
    assert.equal(intent.requested, null, candidate);
    assert.deepEqual(intent.prohibited, ["White contrast collar", "White contrast collar + cuffs"]);
    assert.equal(intent.ambiguous, false);
    assert.equal(styleDirectorCandidateCollarFinish(candidate), null);
    assert.deepEqual(issues(candidate, "Self-fabric"), []);
    for (const forbidden of intent.prohibited)
      assert.deepEqual(issues(candidate, forbidden), ["candidate_collar_finish_mismatch"], candidate);
  }
  const onlyCombo = "No White contrast collar + cuffs";
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent(onlyCombo), {
    requested: null, prohibited: ["White contrast collar + cuffs"], ambiguous: false,
  });
  assert.deepEqual(issues(onlyCombo, "White contrast collar"), []);
  assert.deepEqual(issues(onlyCombo, "White contrast collar + cuffs"), ["candidate_collar_finish_mismatch"]);
});

test("optional collar finishes do not override a saved finish", () => {
  for (const name of [
    "Optional White contrast collar", "Maybe Self-fabric",
    "White contrast collar + cuffs is optional", "Self-fabric not required",
  ]) {
    assert.deepEqual(styleDirectorCandidateCollarFinishIntent(name), {
      requested: null, prohibited: [], ambiguous: false,
    }, name);
    assert.equal(styleDirectorCandidateCollarFinish(name), null, name);
    assert.deepEqual(issues(name, "Self-fabric"), [], name);
    assert.deepEqual(wording(name), [], name);
  }
});

test("contradictory collar finishes require wording review, never rewrite locked ID", () => {
  for (const name of [
    "White contrast collar; Self-fabric collar",
    "No White contrast collar; White contrast collar + cuffs",
    "No Self-fabric; Self-fabric",
  ]) {
    assert.equal(styleDirectorCandidateCollarFinishIntent(name).ambiguous, true, name);
    assert.equal(styleDirectorCandidateCollarFinish(name), null, name);
    assert.deepEqual(wording(name), ["ambiguous_candidate_collar_finish"], name);
    const saved = { collarFinish: "Self-fabric" };
    const before = JSON.stringify(saved);
    assert.deepEqual(styleDirectorCandidateCollarFinishIssues(name, saved), [], name);
    assert.equal(JSON.stringify(saved), before);
  }
});

test("named collar finish reaches proposed legacy and versioned specs, contrast photo stays unverified", () => {
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const namedFinish = styleDirectorCandidateCollarFinish(shirt)"));
  assert.ok(agent.includes("if (namedFinish) style.collarFinish = namedFinish"));
  assert.ok(agent.includes("const namedFinish=styleDirectorCandidateCollarFinish(shirt)"));
  assert.ok(agent.includes("if (namedFinish) spec.shirt.collarFinish=namedFinish"));
  assert.ok(agent.includes("...styleDirectorCandidateCollarFinishIssues(candidate.garments.shirt, styleSpec.shirt)"));
  for (const collarFinish of ["White contrast collar", "White contrast collar + cuffs"] as const) {
    const locked = { shirt: { collar: "spread_collar", wear: "tucked", collarFinish } } as unknown as Pick<StyleSpecV2, "shirt">;
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorPresentationIssues(
      { collar: "Spread Collar", shirtWear: "Tucked", collarFinish }, locked,
    ).map(issue => issue.code), ["unverified_contrast_finish_photo"]);
    assert.equal(JSON.stringify(locked), before, "review must not rewrite locked design");
  }
});
