import assert from "node:assert/strict";
import test from "node:test";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidatePlacketIntent,
  styleDirectorCandidatePlacketIssues,
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

test("preposed contracted modal collar, placket and sleeve exclusions are not affirmative selections", () => {
  for (const wording of ["Shouldn't select camp collar", "Shouldn’t select camp collar"]) {
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
    const locked = Object.freeze({ collar: "cuban_camp_collar" as const });
    const first = styleDirectorCandidateCollarIssues(wording, locked);
    assert.deepEqual(first.map(x => x.code), ["candidate_collar_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, locked), first);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, { collar: "spread_collar" }), []);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), []);
  }
  for (const wording of ["Mustn't select French placket", "Mustn’t select French placket"]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: ["french_placket"], ambiguous: false,
    }, wording);
    const locked = Object.freeze({ placket: "french_placket" as const });
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, locked).map(x => x.code),
      ["candidate_placket_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, { placket: "hidden_fly_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), []);
  }
  for (const wording of ["Shouldn't select short sleeves", "Shouldn’t select short sleeves"]) {
    assert.equal(styleDirectorCandidateSleeve(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(wording,
      Object.freeze({ sleeve: "half_sleeve" })).map(x => x.code), ["candidate_sleeve_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, { sleeve: "full_sleeve" }), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), []);
  }
  for (const wording of ["Mustn't select roll-up styled", "Mustn’t select roll-up styled"]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(wording), {
      requested: false, prohibited: true, ambiguous: false,
    }, wording);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(wording,
      Object.freeze({ sleeve: "roll_up_styled" })).map(x => x.code), ["candidate_sleeve_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(wording, { sleeve: "full_sleeve" }), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), []);
  }
});

test("preposed contracted pocket, contrast, button and cuff bans protect frozen options", () => {
  for (const [wording, intent, issue, forbidden, allowed, code] of [
    [
      "Shouldn't select flap pocket",
      () => styleDirectorCandidatePocketIntent("Shouldn't select flap pocket"),
      (id: string) => styleDirectorCandidatePocketIssues("Shouldn't select flap pocket", { pocket: id }).map(x => x.code),
      "flap_pocket", "no_pocket", "candidate_pocket_mismatch",
    ],
    [
      "Mustn’t select white contrast collar",
      () => styleDirectorCandidateCollarFinishIntent("Mustn’t select white contrast collar"),
      (id: string) => styleDirectorCandidateCollarFinishIssues("Mustn’t select white contrast collar", { collarFinish: id }).map(x => x.code),
      "White contrast collar", "Self-fabric", "candidate_collar_finish_mismatch",
    ],
    [
      "Shouldn’t select horn buttons",
      () => styleDirectorCandidateButtonIntent("Shouldn’t select horn buttons"),
      (id: string) => styleDirectorCandidateButtonIssues("Shouldn’t select horn buttons", { button: id }).map(x => x.code),
      "horn", "corozo", "candidate_button_mismatch",
    ],
    [
      "Mustn't select French cuffs",
      () => styleDirectorCandidateCuffIntent("Mustn't select French cuffs"),
      (id: string) => styleDirectorCandidateCuffIssues("Mustn't select French cuffs", { cuff: id }).map(x => x.code),
      "french_double_cuff", "barrel_cuff_1_button", "candidate_cuff_mismatch",
    ],
  ] as const) {
    const r = intent();
    assert.equal(r.requested, null, wording);
    assert.equal(r.ambiguous, false, wording);
    assert.ok(r.prohibited.includes(forbidden as never), wording);
    assert.deepEqual(issue(forbidden), [code], wording);
    assert.deepEqual(issue(forbidden), [code], "deterministic locked rejection: " + wording);
    assert.deepEqual(issue(allowed), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), [], wording);
  }
});

test("preposed contracted fit, wide-leg and drawstring bans reject the prohibited locked IDs", () => {
  for (const wording of ["Shouldn't select slim fit", "Shouldn’t select slim fit"]) {
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(wording), {
      requested: null, prohibited: ["slim_fit"], ambiguous: false,
    }, wording);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(wording,
      Object.freeze({ fit: "slim_fit" })).map(x => x.code), ["candidate_shirt_fit_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(wording, { fit: "regular_classic_fit" }), []);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), []);
  }
  for (const wording of ["Mustn't select slim tapered fit", "Mustn’t select slim tapered fit"]) {
    assert.deepEqual(styleDirectorCandidateTrouserFitIntent(wording), {
      requested: null, prohibited: ["slim_tapered"], ambiguous: false,
    }, wording);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(wording,
      Object.freeze({ fit: "slim_tapered" })).map(x => x.code), ["candidate_trouser_fit_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(wording, { fit: "regular_tapered" }), []);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", wording), []);
  }
  for (const wording of ["Shouldn't select wide-leg trousers", "Shouldn’t select wide-leg trousers"]) {
    assert.equal(styleDirectorCandidateWideLegIntent(wording), "prohibited", wording);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(wording,
      Object.freeze({ type: "wide_leg_relaxed_drape" })).map(x => x.code), ["candidate_wide_leg_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(wording, { type: "formal_flat_front" }), []);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", wording), []);
  }
  for (const wording of ["Mustn't select drawstring", "Mustn’t select drawstring"]) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(wording), "prohibited", wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording,
      Object.freeze({ waistband: "drawstring_elastic" })).map(x => x.code), ["candidate_waistband_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(wording, { waistband: "belt_loops" }), []);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", wording), []);
  }
});

test("positive and optional choices remain positive or neutral, not contracted refusals", () => {
  assert.deepEqual(styleDirectorCandidatePocketIntent("Select flap pocket"), {
    requested: "flap_pocket", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCuffIntent("Select French cuffs"), {
    requested: "french_double_cuff", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateShirtFitIntent("Slim fit is optional"), {
    requested: null, prohibited: [], ambiguous: false,
  });
  assert.equal(styleDirectorCandidateWideLegIntent("Select wide-leg trousers"), "requested");
  assert.equal(styleDirectorCandidateDrawstringWaistband("Drawstring is optional"), null);
  const contradiction = "Shouldn't select flap pocket; flap pocket is required";
  assert.equal(styleDirectorCandidatePocketIntent(contradiction).ambiguous, true);
  assert.deepEqual(styleDirectorCandidateWordingIssues(contradiction).map(x => x.code),
    ["ambiguous_candidate_pocket"]);
});
