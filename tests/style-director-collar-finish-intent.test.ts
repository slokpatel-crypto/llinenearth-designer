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

test("postposed collar finish refusals are exclusions, not selected finishes", () => {
  for (const name of [
    "White contrast collar isn't wanted",
    "White contrast collar is not wanted",
    "White contrast collar unwanted",
    "White contrast collar should not be selected",
    "White contrast collar must not be used",
  ]) {
    assert.deepEqual(styleDirectorCandidateCollarFinishIntent(name), {
      requested: null,
      prohibited: ["White contrast collar", "White contrast collar + cuffs"],
      ambiguous: false,
    }, name);
    assert.equal(styleDirectorCandidateCollarFinish(name), null, name);
    assert.deepEqual(issues(name, "Self-fabric"), [], name);
    for (const finish of ["White contrast collar", "White contrast collar + cuffs"])
      assert.deepEqual(issues(name, finish), ["candidate_collar_finish_mismatch"], name);
  }
  for (const name of [
    "White contrast collar + cuffs isn't wanted",
    "White contrast collar + cuffs should not be selected",
  ]) {
    assert.deepEqual(styleDirectorCandidateCollarFinishIntent(name), {
      requested: null, prohibited: ["White contrast collar + cuffs"], ambiguous: false,
    }, name);
    assert.deepEqual(issues(name, "White contrast collar"), [], name);
    assert.deepEqual(issues(name, "White contrast collar + cuffs"),
      ["candidate_collar_finish_mismatch"], name);
  }
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent("Self-fabric isn't wanted"), {
    requested: null, prohibited: ["Self-fabric"], ambiguous: false,
  });
  assert.deepEqual(issues("Self-fabric isn't wanted", "Self-fabric"),
    ["candidate_collar_finish_mismatch"]);
});

test("postposed collar finish optional statements preserve frozen saved IDs", () => {
  const saved = Object.freeze({ collarFinish: "White contrast collar" });
  const original = JSON.stringify(saved);
  for (const name of [
    "White contrast collar isn't required",
    "White contrast collar isn't needed",
    "White contrast collar isn't mandatory",
    "White contrast collar is not required",
    "White contrast collar + cuffs aren't required",
  ]) {
    assert.deepEqual(styleDirectorCandidateCollarFinishIntent(name), {
      requested: null, prohibited: [], ambiguous: false,
    }, name);
    assert.deepEqual(styleDirectorCandidateCollarFinishIssues(name, saved), [], name);
    assert.equal(styleDirectorCandidateCollarFinish(name), null, name);
  }
  const conflict = "White contrast collar and White contrast collar isn't wanted";
  assert.equal(styleDirectorCandidateCollarFinishIntent(conflict).ambiguous, true);
  assert.equal(styleDirectorCandidateCollarFinish(conflict), null);
  assert.deepEqual(wording(conflict), ["ambiguous_candidate_collar_finish"]);
  assert.deepEqual(styleDirectorCandidateCollarFinishIssues(conflict, saved), []);
  assert.equal(JSON.stringify(saved), original, "versioned collar finish must not change");
});

test("undecided with-or-without collar finishes are review-only, never a ban", () => {
  for (const phrase of [
    "with or without white contrast collar",
    "with or without a white contrast collar",
    "with or without white contrast collar + cuffs",
    "with or without white contrast collar and cuffs",
    "with or without self-fabric",
    "with without self-fabric",
  ]) {
    assert.deepEqual(styleDirectorCandidateCollarFinishIntent(phrase), {
      requested: null, prohibited: [], ambiguous: true,
    }, phrase);
    assert.equal(styleDirectorCandidateCollarFinish(phrase), null, phrase);
    assert.deepEqual(wording(phrase), ["ambiguous_candidate_collar_finish"], phrase);
    for (const collarFinish of [
      "Self-fabric", "White contrast collar", "White contrast collar + cuffs",
    ]) {
      const saved = Object.freeze({ collarFinish });
      const original = JSON.stringify(saved);
      assert.deepEqual(styleDirectorCandidateCollarFinishIssues(phrase, saved), [], phrase);
      assert.equal(JSON.stringify(saved), original, "no mutation to locked collar finish");
    }
  }
});

test("undecided collar finish leaves other explicit restrictions for review", () => {
  const banned = "with or without white contrast collar + cuffs; no self-fabric";
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent(banned), {
    requested: null, prohibited: ["Self-fabric"], ambiguous: true,
  });
  assert.deepEqual(wording(banned), ["ambiguous_candidate_collar_finish"]);
  const requested = "with or without self-fabric; white contrast collar required";
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent(requested), {
    requested: "White contrast collar", prohibited: [], ambiguous: true,
  });
  assert.deepEqual(wording(requested), ["ambiguous_candidate_collar_finish"]);
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent("No White contrast collar"), {
    requested: null, prohibited: ["White contrast collar", "White contrast collar + cuffs"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCollarFinishIntent("White contrast collar + cuffs"), {
    requested: "White contrast collar + cuffs", prohibited: [], ambiguous: false,
  });
});
