import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateSleeve,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidateRollUpSleeveIntent,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
  styleDirectorCandidateCollarFinishIntent,
  styleDirectorCandidateCollarFinishIssues,
  styleDirectorCandidateButtonIntent,
  styleDirectorCandidateButtonIssues,
  styleDirectorCandidateCuffIntent,
  styleDirectorCandidateCuffIssues,
  styleDirectorCandidateShirtFitIntent,
  styleDirectorCandidateShirtFitIssues,
  styleDirectorCandidateTrouserFitIntent,
  styleDirectorCandidateTrouserFitIssues,
  styleDirectorCandidateWideLegIntent,
  styleDirectorCandidateWideLegIssues,
  styleDirectorCandidateDrawstringWaistband,
  styleDirectorCandidateWaistbandIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("do not select and don't select are real exclusions for named shirt options", () => {
  const cases = [
    {
      name: "pocket", wording: "Do not select flap pocket",
      intent: () => styleDirectorCandidatePocketIntent("Do not select flap pocket"),
      prohibited: "flap_pocket", alternative: "no_pocket",
      issues: (pocket: string) => styleDirectorCandidatePocketIssues("Do not select flap pocket", { pocket }).map(x => x.code),
      code: "candidate_pocket_mismatch",
    },
    {
      name: "collar finish", wording: "Don't select white contrast collar",
      intent: () => styleDirectorCandidateCollarFinishIntent("Don't select white contrast collar"),
      prohibited: "White contrast collar", alternative: "Self-fabric",
      issues: (collarFinish: string) => styleDirectorCandidateCollarFinishIssues("Don't select white contrast collar", { collarFinish }).map(x => x.code),
      code: "candidate_collar_finish_mismatch",
    },
    {
      name: "button", wording: "Do not select horn buttons",
      intent: () => styleDirectorCandidateButtonIntent("Do not select horn buttons"),
      prohibited: "horn", alternative: "corozo",
      issues: (button: string) => styleDirectorCandidateButtonIssues("Do not select horn buttons", { button }).map(x => x.code),
      code: "candidate_button_mismatch",
    },
    {
      name: "cuff", wording: "Don’t select French cuffs",
      intent: () => styleDirectorCandidateCuffIntent("Don’t select French cuffs"),
      prohibited: "french_double_cuff", alternative: "barrel_cuff_1_button",
      issues: (cuff: string) => styleDirectorCandidateCuffIssues("Don’t select French cuffs", { cuff }).map(x => x.code),
      code: "candidate_cuff_mismatch",
    },
    {
      name: "shirt fit", wording: "Do not select slim fit",
      intent: () => styleDirectorCandidateShirtFitIntent("Do not select slim fit"),
      prohibited: "slim_fit", alternative: "regular_classic_fit",
      issues: (fit: string) => styleDirectorCandidateShirtFitIssues("Do not select slim fit", { fit }).map(x => x.code),
      code: "candidate_shirt_fit_mismatch",
    },
    {
      name: "trouser fit", wording: "Don't select slim tapered fit",
      intent: () => styleDirectorCandidateTrouserFitIntent("Don't select slim tapered fit"),
      prohibited: "slim_tapered", alternative: "regular_tapered",
      issues: (fit: string) => styleDirectorCandidateTrouserFitIssues("Don't select slim tapered fit", { fit }).map(x => x.code),
      code: "candidate_trouser_fit_mismatch",
    },
  ] as const;
  for (const item of cases) {
    assert.deepEqual(item.intent(), {
      requested: null, prohibited: item.name === "collar finish"
        ? ["White contrast collar", "White contrast collar + cuffs"] : [item.prohibited],
      ambiguous: false,
    }, item.name);
    const prior = JSON.stringify(item.intent());
    assert.deepEqual(item.issues(item.prohibited), [item.code], item.name);
    assert.deepEqual(item.issues(item.prohibited), [item.code], "deterministic lock mismatch: " + item.name);
    assert.deepEqual(item.issues(item.alternative), [], item.name);
    assert.equal(JSON.stringify(item.intent()), prior, "reviews must not mutate parser results");
    assert.deepEqual(item.name === "trouser fit"
      ? styleDirectorCandidateWordingIssues("", item.wording)
      : styleDirectorCandidateWordingIssues(item.wording), [], item.name);
  }
});

test("do-not-select refusals also apply to sleeve lengths and roll-up construction", () => {
  const wording = "Do not select short sleeves";
  assert.equal(styleDirectorCandidateSleeve(wording), null);
  assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, Object.freeze({ sleeve: "half_sleeve" }))
    .map(x => x.code), ["candidate_sleeve_mismatch"]);
  assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, { sleeve: "full_sleeve" }), []);
  const rollUp = "Don't select roll-up styled";
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(rollUp), {
    requested: false, prohibited: true, ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateSleeveIssues(rollUp, Object.freeze({ sleeve: "roll_up_styled" }))
    .map(x => x.code), ["candidate_sleeve_mismatch"]);
  assert.deepEqual(styleDirectorCandidateSleeveIssues(rollUp, { sleeve: "full_sleeve" }), []);
  assert.deepEqual(styleDirectorCandidateWordingIssues(wording), []);
  assert.deepEqual(styleDirectorCandidateWordingIssues(rollUp), []);
});

test("do-not-select refusals fail closed on wide-leg silhouette and drawstring waistband", () => {
  const wide = "Do not select wide-leg trousers";
  assert.equal(styleDirectorCandidateWideLegIntent(wide), "prohibited");
  assert.deepEqual(styleDirectorCandidateWideLegIssues(wide, Object.freeze({ type: "wide_leg_relaxed_drape" }))
    .map(x => x.code), ["candidate_wide_leg_mismatch"]);
  assert.deepEqual(styleDirectorCandidateWideLegIssues(wide, { type: "formal_flat_front" }), []);
  const draw = "Don’t select drawstring";
  assert.equal(styleDirectorCandidateDrawstringWaistband(draw), "prohibited");
  assert.deepEqual(styleDirectorCandidateWaistbandIssues(draw, Object.freeze({ waistband: "drawstring_elastic" }))
    .map(x => x.code), ["candidate_waistband_mismatch"]);
  assert.deepEqual(styleDirectorCandidateWaistbandIssues(draw, { waistband: "belt_loops" }), []);
  assert.deepEqual(styleDirectorCandidateWordingIssues("", wide), []);
  assert.deepEqual(styleDirectorCandidateWordingIssues("", draw), []);
});

test("positive and explicitly optional instructions are not turned into bans", () => {
  assert.deepEqual(styleDirectorCandidatePocketIntent("Select flap pocket"), {
    requested: "flap_pocket", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCuffIntent("Select French cuffs"), {
    requested: "french_double_cuff", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateShirtFitIntent("Optional slim fit"), {
    requested: null, prohibited: [], ambiguous: false,
  });
  assert.equal(styleDirectorCandidateWideLegIntent("Select wide-leg trousers"), "requested");
  assert.equal(styleDirectorCandidateDrawstringWaistband("Select drawstring"), "requested");
  const contradiction = "Do not select flap pocket; flap pocket required";
  assert.equal(styleDirectorCandidatePocketIntent(contradiction).ambiguous, true);
  assert.deepEqual(styleDirectorCandidateWordingIssues(contradiction).map(x => x.code),
    ["ambiguous_candidate_pocket"]);
});
