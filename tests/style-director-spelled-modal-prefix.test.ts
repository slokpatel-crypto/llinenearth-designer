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
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateFrontConstructionIssues,
  styleDirectorCandidateWordingIssues,
} from "../src/lib/designer/style-director-compatibility.ts";

test("spelled should not and must not are exclusions for shirt constructions", () => {
  const collar = "Should not select camp collar";
  assert.equal(styleDirectorCandidateCollar(collar, []), null);
  assert.deepEqual(styleDirectorCandidateCollarIssues(collar, Object.freeze({ collar: "cuban_camp_collar" }))
    .map(x => x.code), ["candidate_collar_mismatch"]);
  assert.deepEqual(styleDirectorCandidateCollarIssues(collar, { collar: "spread_collar" }), []);

  const placket = "Must not select French placket";
  assert.deepEqual(styleDirectorCandidatePlacketIntent(placket), {
    requested: null, prohibited: ["french_placket"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidatePlacketIssues(placket, Object.freeze({ placket: "french_placket" }))
    .map(x => x.code), ["candidate_placket_mismatch"]);
  assert.deepEqual(styleDirectorCandidatePlacketIssues(placket, { placket: "hidden_fly_front" }), []);

  const sleeve = "Should not select short sleeves";
  assert.equal(styleDirectorCandidateSleeve(sleeve), null);
  assert.deepEqual(styleDirectorCandidateSleeveIssues(sleeve, Object.freeze({ sleeve: "half_sleeve" }))
    .map(x => x.code), ["candidate_sleeve_mismatch"]);
  assert.deepEqual(styleDirectorCandidateSleeveIssues(sleeve, { sleeve: "full_sleeve" }), []);

  const roll = "Must not select roll-up styled";
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(roll), {
    requested: false, prohibited: true, ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateSleeveIssues(roll, Object.freeze({ sleeve: "roll_up_styled" }))
    .map(x => x.code), ["candidate_sleeve_mismatch"]);
  assert.deepEqual(styleDirectorCandidateSleeveIssues(roll, { sleeve: "full_sleeve" }), []);

  for (const wording of [collar, placket, sleeve, roll]) {
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), [], wording);
  }
});

test("spelled modal refusals enforce pocket, collar-finish, button and cuff IDs", () => {
  for (const [wording, intent, issues, forbidden, allowed, code] of [
    [
      "Should not select flap pocket",
      () => styleDirectorCandidatePocketIntent("Should not select flap pocket"),
      (id: string) => styleDirectorCandidatePocketIssues("Should not select flap pocket", { pocket: id }).map(x => x.code),
      "flap_pocket", "no_pocket", "candidate_pocket_mismatch",
    ],
    [
      "Must not select white contrast collar",
      () => styleDirectorCandidateCollarFinishIntent("Must not select white contrast collar"),
      (id: string) => styleDirectorCandidateCollarFinishIssues("Must not select white contrast collar", { collarFinish: id }).map(x => x.code),
      "White contrast collar", "Self-fabric", "candidate_collar_finish_mismatch",
    ],
    [
      "Should not select horn buttons",
      () => styleDirectorCandidateButtonIntent("Should not select horn buttons"),
      (id: string) => styleDirectorCandidateButtonIssues("Should not select horn buttons", { button: id }).map(x => x.code),
      "horn", "corozo", "candidate_button_mismatch",
    ],
    [
      "Must not select French cuffs",
      () => styleDirectorCandidateCuffIntent("Must not select French cuffs"),
      (id: string) => styleDirectorCandidateCuffIssues("Must not select French cuffs", { cuff: id }).map(x => x.code),
      "french_double_cuff", "barrel_cuff_1_button", "candidate_cuff_mismatch",
    ],
  ] as const) {
    const parsed = intent();
    assert.equal(parsed.requested, null, wording);
    assert.equal(parsed.ambiguous, false, wording);
    assert.ok(parsed.prohibited.includes(forbidden as never), wording);
    assert.deepEqual(issues(forbidden), [code], wording);
    assert.deepEqual(issues(forbidden), [code], "deterministic mismatches: " + wording);
    assert.deepEqual(issues(allowed), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues(wording), [], wording);
  }
});

test("spelled modal refusals enforce shirt/trouser fit, silhouette and waistband IDs", () => {
  const shirt = "Should not select slim fit";
  assert.deepEqual(styleDirectorCandidateShirtFitIntent(shirt), {
    requested: null, prohibited: ["slim_fit"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateShirtFitIssues(shirt, Object.freeze({ fit: "slim_fit" }))
    .map(x => x.code), ["candidate_shirt_fit_mismatch"]);
  assert.deepEqual(styleDirectorCandidateShirtFitIssues(shirt, { fit: "regular_classic_fit" }), []);

  const trouser = "Must not select slim tapered fit";
  assert.deepEqual(styleDirectorCandidateTrouserFitIntent(trouser), {
    requested: null, prohibited: ["slim_tapered"], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateTrouserFitIssues(trouser, Object.freeze({ fit: "slim_tapered" }))
    .map(x => x.code), ["candidate_trouser_fit_mismatch"]);
  assert.deepEqual(styleDirectorCandidateTrouserFitIssues(trouser, { fit: "regular_tapered" }), []);

  const wide = "Should not select wide-leg trousers";
  assert.equal(styleDirectorCandidateWideLegIntent(wide), "prohibited");
  assert.deepEqual(styleDirectorCandidateWideLegIssues(wide, Object.freeze({ type: "wide_leg_relaxed_drape" }))
    .map(x => x.code), ["candidate_wide_leg_mismatch"]);
  assert.deepEqual(styleDirectorCandidateWideLegIssues(wide, { type: "formal_flat_front" }), []);

  const draw = "Must not select drawstring";
  assert.equal(styleDirectorCandidateDrawstringWaistband(draw), "prohibited");
  assert.deepEqual(styleDirectorCandidateWaistbandIssues(draw, Object.freeze({ waistband: "drawstring_elastic" }))
    .map(x => x.code), ["candidate_waistband_mismatch"]);
  assert.deepEqual(styleDirectorCandidateWaistbandIssues(draw, { waistband: "belt_loops" }), []);

  assert.deepEqual(styleDirectorCandidateWordingIssues(shirt), []);
  for (const wording of [trouser, wide, draw]) {
    assert.deepEqual(styleDirectorCandidateWordingIssues("", wording), [], wording);
  }
});

test("spelled modal pleat bans preserve count and direction without guessing an alternative", () => {
  for (const [wording, safe, forbidden] of [
    ["Should not select double pleats", "single_pleat_forward", "double_pleat_forward"],
    ["Must not select single pleats", "double_pleat_reverse", "single_pleat_reverse"],
    ["Should not select reverse pleats", "single_pleat_forward", "single_pleat_reverse"],
    ["Must not select forward pleats", "double_pleat_reverse", "double_pleat_forward"],
  ] as const) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    const check = (pleat: string) => styleDirectorCandidateFrontConstructionIssues(wording, { pleat })
      .map(x => x.code);
    assert.deepEqual(check(safe), [], wording);
    assert.deepEqual(check(forbidden), ["candidate_trouser_pleat_mismatch"], wording);
    assert.deepEqual(check("unknown_pleat_id"), ["candidate_trouser_pleat_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording), [], wording);
  }
  for (const wording of ["Should not select pleats", "Must not use pleats"]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), []);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "single_pleat_forward" })
      .map(x => x.code), ["candidate_trouser_pleat_mismatch"], wording);
  }
});

test("positive, optional and contradictory instructions are not silently converted", () => {
  assert.deepEqual(styleDirectorCandidatePocketIntent("Should select flap pocket"), {
    requested: "flap_pocket", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateCuffIntent("Must select French cuffs"), {
    requested: "french_double_cuff", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidateShirtFitIntent("Slim fit is optional"), {
    requested: null, prohibited: [], ambiguous: false,
  });
  assert.equal(styleDirectorCandidateWideLegIntent("Should select wide-leg trousers"), "requested");
  assert.equal(styleDirectorCandidateDrawstringWaistband("Drawstring is optional"), null);
  const contradiction = "Should not select flap pocket; flap pocket required";
  assert.equal(styleDirectorCandidatePocketIntent(contradiction).ambiguous, true);
  assert.deepEqual(styleDirectorCandidateWordingIssues(contradiction).map(x => x.code),
    ["ambiguous_candidate_pocket"]);
});
