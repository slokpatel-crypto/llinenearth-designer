import test from "node:test";
import assert from "node:assert/strict";
import {
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidateOrdinaryCollar,
  styleDirectorCandidateVariantCollar,
  styleDirectorCandidateSleeve,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidateRollUpSleeveIntent,
  styleDirectorCandidatePlacketIntent,
  styleDirectorCandidatePlacketIssues,
  styleDirectorCandidateCuffIntent,
  styleDirectorCandidateCuffIssues,
  styleDirectorCandidateButtonIntent,
  styleDirectorCandidateButtonIssues,
  styleDirectorCandidatePocketIntent,
  styleDirectorCandidatePocketIssues,
  styleDirectorCandidateCollarFinishIntent,
  styleDirectorCandidateCollarFinishIssues,
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
} from "../src/lib/designer/style-director-compatibility.ts";

const codes = (issues: readonly { code: string }[]) => issues.map(issue => issue.code);

test("do not select is a prohibition for collars, sleeves, and roll-up construction", () => {
  for (const negative of ["Do not select", "Don't select"]) {
    const camp = `${negative} Camp Collar`;
    assert.equal(styleDirectorCandidateOrdinaryCollar(camp), null, camp);
    assert.deepEqual(codes(styleDirectorCandidateCollarIssues(camp, { collar: "cuban_camp_collar" })),
      ["candidate_collar_mismatch"]);
    assert.deepEqual(styleDirectorCandidateCollarIssues(camp, { collar: "spread_collar" }), []);
    const variant = `${negative} English Spread Collar`;
    assert.equal(styleDirectorCandidateVariantCollar(variant), null);
    assert.deepEqual(codes(styleDirectorCandidateCollarIssues(variant, { collar: "english_spread_collar" })),
      ["candidate_collar_mismatch"]);
    assert.deepEqual(styleDirectorCandidateCollarIssues(variant, { collar: "spread_collar" }), []);

    const short = `${negative} Short Sleeves`;
    assert.equal(styleDirectorCandidateSleeve(short), null, short);
    assert.deepEqual(codes(styleDirectorCandidateSleeveIssues(short, { sleeve: "half_sleeve" })),
      ["candidate_sleeve_mismatch"]);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(short, { sleeve: "full_sleeve" }), []);
    const rolled = `${negative} Roll-up Styled`;
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(rolled), {
      requested: false, prohibited: true, ambiguous: false,
    }, rolled);
  }
});

test("do not select blocks named shirt details without rewriting canonical locked choices", () => {
  for (const negative of ["Do not select", "Don't select"]) {
    const cases = [
      [`${negative} French Placket`, styleDirectorCandidatePlacketIntent, styleDirectorCandidatePlacketIssues,
        "placket", "french_placket", "standard_visible_placket", "candidate_placket_mismatch"],
      [`${negative} French Cuffs`, styleDirectorCandidateCuffIntent, styleDirectorCandidateCuffIssues,
        "cuff", "french_double_cuff", "barrel_cuff_1_button", "candidate_cuff_mismatch"],
      [`${negative} Horn Buttons`, styleDirectorCandidateButtonIntent, styleDirectorCandidateButtonIssues,
        "button", "horn", "corozo", "candidate_button_mismatch"],
      [`${negative} Patch Pocket`, styleDirectorCandidatePocketIntent, styleDirectorCandidatePocketIssues,
        "pocket", "single_patch_pocket", "no_pocket", "candidate_pocket_mismatch"],
      [`${negative} White contrast collar`, styleDirectorCandidateCollarFinishIntent, styleDirectorCandidateCollarFinishIssues,
        "collarFinish", "White contrast collar", "Self-fabric", "candidate_collar_finish_mismatch"],
    ] as const;
    for (const [label, intentFn, issueFn, key, forbidden, allowed, issueCode] of cases) {
      const intent = intentFn(label) as { requested: unknown; prohibited: readonly string[]; ambiguous: boolean };
      assert.equal(intent.requested, null, label);
      assert.ok(intent.prohibited.includes(forbidden), label);
      assert.equal(intent.ambiguous, false, label);
      const locked = Object.freeze({ [key]: forbidden });
      assert.deepEqual(codes(issueFn(label, locked as never)), [issueCode], label);
      assert.deepEqual(issueFn(label, Object.freeze({ [key]: allowed }) as never), [], label);
      assert.deepEqual(codes(issueFn(label, locked as never)), [issueCode], "stable result");
      assert.equal(locked[key], forbidden, "locked versioned option must remain unchanged");
    }
  }
});

test("do not select respects independent shirt and trouser fit, silhouette, waistband", () => {
  for (const negative of ["Do not select", "Don't select"]) {
    const shirt = `${negative} Slim Fit`;
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(shirt), {
      requested: null, prohibited: ["slim_fit"], ambiguous: false,
    });
    assert.deepEqual(codes(styleDirectorCandidateShirtFitIssues(shirt, { fit: "slim_fit" })),
      ["candidate_shirt_fit_mismatch"]);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(shirt, { fit: "relaxed_fit" }), []);

    const trouser = `${negative} Korean Tapered Fit`;
    assert.deepEqual(styleDirectorCandidateTrouserFitIntent(trouser), {
      requested: null, prohibited: ["korean_tapered"], ambiguous: false,
    });
    assert.deepEqual(codes(styleDirectorCandidateTrouserFitIssues(trouser, { fit: "korean_tapered" })),
      ["candidate_trouser_fit_mismatch"]);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(trouser, { fit: "straight_classic" }), []);

    const wide = `${negative} Wide-leg trousers`;
    assert.equal(styleDirectorCandidateWideLegIntent(wide), "prohibited");
    assert.deepEqual(codes(styleDirectorCandidateWideLegIssues(wide, { type: "wide_leg_relaxed_drape" })),
      ["candidate_wide_leg_mismatch"]);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(wide, { type: "formal_flat_front" }), []);

    const draw = `${negative} Drawstring`;
    assert.equal(styleDirectorCandidateDrawstringWaistband(draw), "prohibited");
    assert.deepEqual(codes(styleDirectorCandidateWaistbandIssues(draw, { waistband: "drawstring_elastic" })),
      ["candidate_waistband_mismatch"]);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(draw, { waistband: "belt_loops" }), []);
  }
});

test("do not select differentiates generic pleat bans, count bans, and direction bans", () => {
  for (const negative of ["Do not select", "Don't select"]) {
    const generic = `${negative} any pleats`;
    assert.equal(styleDirectorCandidateTrouserFront(generic), "flat_front", generic);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(generic, { pleat: "flat_front" }), []);
    assert.deepEqual(codes(styleDirectorCandidateFrontConstructionIssues(generic, { pleat: "single_pleat_forward" })),
      ["candidate_trouser_pleat_mismatch"]);

    const count = `${negative} double pleats`;
    assert.equal(styleDirectorCandidateTrouserFront(count), null, count);
    assert.deepEqual(codes(styleDirectorCandidateFrontConstructionIssues(count, { pleat: "double_pleat_forward" })),
      ["candidate_trouser_pleat_mismatch"], count);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(count, { pleat: "single_pleat_reverse" }), []);
    const direction = `${negative} forward pleats`;
    assert.equal(styleDirectorCandidateTrouserFront(direction), null, direction);
    assert.deepEqual(codes(styleDirectorCandidateFrontConstructionIssues(direction, { pleat: "single_pleat_forward" })),
      ["candidate_trouser_pleat_mismatch"], direction);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(direction, { pleat: "single_pleat_reverse" }), []);
  }
});
