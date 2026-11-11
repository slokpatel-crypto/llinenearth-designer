import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidatePocketIssues,
  styleDirectorCandidateCollarFinishIssues,
  styleDirectorCandidateButtonIssues,
  styleDirectorCandidateCuffIssues,
  styleDirectorCandidateShirtFitIssues,
  styleDirectorCandidateTrouserFitIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("must never / should never suffix bans reject forbidden locked construction IDs", () => {
  const cases: Array<{
    name: string;
    wording: string;
    forbidden: string;
    allowed: string;
    code: string;
    issues: (id: string) => string[];
    trouser?: boolean;
  }> = [
    {
      name: "collar", wording: "Camp collar must never be selected",
      forbidden: "cuban_camp_collar", allowed: "spread_collar",
      code: "candidate_collar_mismatch",
      issues: id => styleDirectorCandidateCollarIssues("Camp collar must never be selected", { collar: id }).map(x => x.code),
    },
    {
      name: "sleeve", wording: "Short sleeves should never be worn",
      forbidden: "half_sleeve", allowed: "full_sleeve",
      code: "candidate_sleeve_mismatch",
      issues: id => styleDirectorCandidateSleeveIssues("Short sleeves should never be worn", { sleeve: id }).map(x => x.code),
    },
    {
      name: "pocket", wording: "Flap pocket must never be selected",
      forbidden: "flap_pocket", allowed: "no_pocket",
      code: "candidate_pocket_mismatch",
      issues: id => styleDirectorCandidatePocketIssues("Flap pocket must never be selected", { pocket: id }).map(x => x.code),
    },
    {
      name: "contrast", wording: "White contrast collar must never be used",
      forbidden: "White contrast collar", allowed: "Self-fabric",
      code: "candidate_collar_finish_mismatch",
      issues: id => styleDirectorCandidateCollarFinishIssues("White contrast collar must never be used", { collarFinish: id }).map(x => x.code),
    },
    {
      name: "buttons", wording: "Horn buttons should never be selected",
      forbidden: "horn", allowed: "corozo",
      code: "candidate_button_mismatch",
      issues: id => styleDirectorCandidateButtonIssues("Horn buttons should never be selected", { button: id }).map(x => x.code),
    },
    {
      name: "cuffs", wording: "French cuffs must never be selected",
      forbidden: "french_double_cuff", allowed: "barrel_cuff_1_button",
      code: "candidate_cuff_mismatch",
      issues: id => styleDirectorCandidateCuffIssues("French cuffs must never be selected", { cuff: id }).map(x => x.code),
    },
    {
      name: "shirt fit", wording: "Slim fit should never be selected",
      forbidden: "slim_fit", allowed: "regular_classic_fit",
      code: "candidate_shirt_fit_mismatch",
      issues: id => styleDirectorCandidateShirtFitIssues("Slim fit should never be selected", { fit: id }).map(x => x.code),
    },
    {
      name: "trouser fit", wording: "Slim tapered fit must never be selected",
      forbidden: "slim_tapered", allowed: "regular_tapered",
      code: "candidate_trouser_fit_mismatch",
      issues: id => styleDirectorCandidateTrouserFitIssues("Slim tapered fit must never be selected", { fit: id }).map(x => x.code),
      trouser: true,
    },
  ];
  for (const item of cases) {
    assert.deepEqual(item.issues(item.forbidden), [item.code], item.name);
    assert.deepEqual(item.issues(item.forbidden), [item.code], "deterministic: " + item.name);
    assert.deepEqual(item.issues(item.allowed), [], "safe independent choice: " + item.name);
    assert.deepEqual(item.issues("retired_invalid_id"), [item.code], "unknown locked ID: " + item.name);
    assert.deepEqual(item.trouser
      ? styleDirectorCandidateWordingIssues("", item.wording)
      : styleDirectorCandidateWordingIssues(item.wording), [], "valid exclusion is not ambiguous: " + item.name);
  }
});

test("positive, optional and contradictory suffix wording remains separate from bans", () => {
  assert.deepEqual(styleDirectorCandidateCuffIssues("French cuffs must be selected", {
    cuff: "french_double_cuff",
  }), []);
  assert.deepEqual(styleDirectorCandidateCuffIssues("French cuffs must be selected", {
    cuff: "barrel_cuff_1_button",
  }).map(x => x.code), ["candidate_cuff_mismatch"]);
  for (const phrase of ["French cuffs are optional", "Horn buttons aren't required"]) {
    assert.deepEqual(styleDirectorCandidateWordingIssues(phrase), []);
  }
  assert.deepEqual(styleDirectorCandidateCuffIssues("French cuffs are optional", {
    cuff: "french_double_cuff",
  }), []);
  assert.deepEqual(styleDirectorCandidateCuffIssues("French cuffs are optional", {
    cuff: "barrel_cuff_1_button",
  }), []);
  assert.deepEqual(styleDirectorCandidateWordingIssues(
    "French cuffs must never be selected; French cuffs required",
  ).map(x => x.code), ["ambiguous_candidate_cuff"]);
  assert.deepEqual(styleDirectorCandidateCuffIssues(
    "French cuffs must never be selected; French cuffs required",
    { cuff: "french_double_cuff" },
  ), [], "contradictory instructions remain review-only in the wording gate");
});
