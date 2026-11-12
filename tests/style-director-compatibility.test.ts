import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateSpecialCollar,
  styleDirectorCandidateCollarIssues,
  styleDirectorCandidatePlacketIntent,
  styleDirectorCandidatePlacket,
  styleDirectorCandidatePlacketIssues,
  styleDirectorCandidateCuffIntent,
  styleDirectorCandidateCuff,
  styleDirectorCandidateCuffIssues,
  styleDirectorCandidateShirtFitIntent,
  styleDirectorCandidateShirtFit,
  styleDirectorCandidateShirtFitIssues,
  styleDirectorCandidateTrouserFitIntent,
  styleDirectorCandidateTrouserFit,
  styleDirectorCandidateTrouserFitIssues,
  styleDirectorCandidateOrdinaryCollar,
  styleDirectorCandidateSleeve,
  styleDirectorCandidateRollUpSleeveIntent,
  styleDirectorCandidateSleeveIssues,
  styleDirectorCandidateFrontConstructionIssues,
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateWideLeg,
  styleDirectorCandidateWideLegIntent,
  styleDirectorCandidateWideLegIssues,
  styleDirectorCandidateDrawstringWaistband,
  styleDirectorCandidateWaistbandIssues,
  styleDirectorCandidateWordingIssues,
  styleDirectorCandidateWearIssues,
  styleDirectorConstructionIssues,
  styleDirectorSilhouetteFitIssues,
  styleDirectorProposedCroppedHem,
  styleDirectorIntelligenceTrustWeight,
  styleDirectorPresentationIssues,
  styleDirectorWearForCandidate,
} from "../src/lib/designer/style-director-compatibility.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";
import type { DesignerStyle } from "../src/lib/designer/engine.ts";
import { optionsFor } from "../src/lib/designer/options/library.ts";

// Mirror engine.ts optionLabels("shirt.collar") from the real selectable library.
// Do not runtime-import engine.ts: its unannotated JSON import is incompatible
// with bare Node --experimental-strip-types, unlike the options library.
const selectableCollars = optionsFor("shirt.collar")
  .filter((option) => option.legacySelectable !== false)
  .map((option) => option.legacyLabel || option.label);

const trust = (reviewStatus: "unreviewed" | "approved" | "corrected" | "rejected",
  level: "reviewed" | "high-confidence" | "provisional") =>
  styleDirectorIntelligenceTrustWeight({ reviewStatus, trust: level });

function spec(shirt: Record<string,string> = {}, pant: Record<string,string> = {}): StyleSpecV2 {
  return {
    shirt: {
      type: "dress_shirt", collar: "spread_collar", wear: "tucked",
      sleeve: "full_sleeve", cuff: "barrel_cuff_1_button", ...shirt,
    },
    pant: {
      type: "formal_flat_front", pleat: "flat_front", hem: "plain_hem",
      break: "slight_break", ...pant,
    },
  } as unknown as StyleSpecV2;
}

test("rejected or unreviewed intelligence cannot masquerade as physically reviewed", () => {
  assert.equal(trust("approved", "reviewed"), 1);
  assert.equal(trust("corrected", "reviewed"), 1);
  assert.equal(trust("rejected", "reviewed"), 0);
  assert.equal(trust("unreviewed", "reviewed"), 0.28);
  assert.equal(trust("rejected", "high-confidence"), 0);
  assert.equal(trust("unreviewed", "high-confidence"), 0.72);
  assert.equal(trust("approved", "provisional"), 0.28);
  assert.equal(styleDirectorIntelligenceTrustWeight(undefined), 0);
  // Stale or forged closed-vocabulary values must have zero scoring influence.
  for (const corrupted of [
    { reviewStatus: "approved", trust: "unknown" },
    { reviewStatus: "unknown", trust: "reviewed" },
    { reviewStatus: "approved" },
    { trust: "reviewed" },
    {},
  ]) {
    assert.equal(styleDirectorIntelligenceTrustWeight(
      corrupted as Parameters<typeof styleDirectorIntelligenceTrustWeight>[0]), 0);
  }
});

test("camp-collar type requires matching open collar and untucked wear", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type: "camp_collar_resort", collar: "cuban_camp_collar", wear: "untucked",
  })), []);
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type: "camp_collar_resort", collar: "point_standard_collar", wear: "tucked",
  })).map(x=>x.code), ["camp_collar_construction"]);
});

test("optional sleeve necessity wording does not become a locked sleeve instruction", () => {
  for (const phrase of [
    "Short sleeves are not necessary",
    "Half sleeves aren't necessary",
    "Full sleeves aren’t necessary",
    "Long sleeves are not necessary",
  ]) {
    assert.deepEqual(styleDirectorCandidateSleeveIssues(phrase, spec().shirt), [], phrase);
  }
});

test("short sleeves cannot be recommended with French double cuffs", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    sleeve: "half_sleeve", cuff: "french_double_cuff",
  })).map(x=>x.code), ["short_sleeve_double_cuff", "short_sleeve_cuff_review"]);
});


test("partial trouser fixtures do not invent a missing pleat while stale IDs fail closed", () => {
  const partial = spec({}, { pleat: undefined as unknown as string });
  const before = JSON.stringify(partial);
  assert.deepEqual(styleDirectorConstructionIssues(partial), [],
    "partial pure fixtures omit pleat; full locked-spec parsing checks required fields");
  assert.equal(JSON.stringify(partial), before);
  const stale = spec({}, { pleat: "retired_pleat" });
  assert.deepEqual(styleDirectorConstructionIssues(stale).map(issue => issue.code),
    ["unknown_trouser_pleat_option"]);
  assert.deepEqual(styleDirectorConstructionIssues(stale), styleDirectorConstructionIssues(stale));
});

test("pleated and flat-front trouser construction must match selected type", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "pleated_trouser", pleat: "flat_front",
  })).map(x=>x.code), ["pleated_front_missing_pleat"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "formal_flat_front", pleat: "single_pleat_forward",
  })).map(x=>x.code), ["flat_front_has_pleat"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "pleated_trouser", pleat: "single_pleat_forward",
  })), []);
});

test("wide-leg silhouettes cannot silently keep explicitly tapered fit IDs", () => {
  const tapered = ["slim_tapered", "regular_tapered", "korean_tapered"] as const;
  for (const fit of tapered) {
    assert.ok(optionsFor("pant.fit").some(option => option.id === fit), fit);
    const locked = spec({}, { type: "wide_leg_relaxed_drape", fit, pleat: "flat_front" });
    const original = JSON.stringify(locked);
    const result = styleDirectorSilhouetteFitIssues(locked.pant);
    assert.deepEqual(result.map(issue => issue.code),
      ["wide_leg_tapered_fit_mismatch"], fit);
    assert.deepEqual(styleDirectorConstructionIssues(locked), result,
      "locked design must pass the same pure compatibility review");
    assert.deepEqual(styleDirectorSilhouetteFitIssues(locked.pant), result,
      "review must be deterministic");
    assert.equal(JSON.stringify(locked), original, "cannot silently rewrite locked leg shape");
  }
  for (const fit of ["wide_leg_drape", "baggy_wide", "korean_straight_wide"] as const) {
    assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
      type: "wide_leg_relaxed_drape", fit, pleat: "flat_front",
    })), [], "valid wide-leg fit cannot be rejected: " + fit);
  }
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "wide_leg_relaxed_drape", fit: "wide_leg_drape", pleat: "single_pleat_reverse",
  })), [], "wide-leg trousers may legitimately have front pleats");
  for (const fit of tapered) {
    assert.deepEqual(styleDirectorSilhouetteFitIssues(spec({}, {
      type: "cropped_ankle", fit, pleat: "flat_front",
    }).pant), [], "cropped length does not imply a wide fit: " + fit);
  }
});

test("Pleated Straight fit needs an actual front-pleat ID, not an assumed one", () => {
  for (const type of ["formal_flat_front", "wide_leg_relaxed_drape", "pleated_trouser"] as const) {
    const locked = spec({}, { type, fit: "pleated_straight", pleat: "flat_front" });
    const before = JSON.stringify(locked);
    const issues = styleDirectorSilhouetteFitIssues(locked.pant);
    assert.deepEqual(issues.map(x => x.code),
      ["pleated_fit_flat_front_mismatch"], type);
    assert.ok(styleDirectorConstructionIssues(locked).some(x =>
      x.code === "pleated_fit_flat_front_mismatch"), type);
    assert.equal(JSON.stringify(locked), before, "review cannot write a fabricated front pleat");
  }
  for (const pleat of [
    "single_pleat_forward", "single_pleat_reverse",
    "double_pleat_forward", "double_pleat_reverse",
  ] as const) {
    assert.ok(optionsFor("pant.pleat").some(option => option.id === pleat));
    assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
      type: "pleated_trouser", fit: "pleated_straight", pleat,
    })), [], "existing pleat counts and directions remain compatible: " + pleat);
  }
  assert.deepEqual(styleDirectorSilhouetteFitIssues(spec({}, {
    type: "formal_flat_front", fit: "straight_classic", pleat: "flat_front",
  }).pant), [], "ordinary flat-front fit remains valid");
  assert.deepEqual(styleDirectorSilhouetteFitIssues(spec({}, {
    type: "unrecognised_type", fit: "unrecognised_fit", pleat: "flat_front",
  }).pant), [], "unknown IDs are reviewed by the existing catalog gate, not guessed");
});

test("new cropped legacy proposals retain consistent canonical type break and hem IDs", () => {
  const proposed = spec({}, {type: "cropped_ankle", break: "cropped_above_ankle"});
  const before = JSON.stringify(proposed);
  assert.deepEqual(styleDirectorConstructionIssues(proposed).map(issue => issue.code),
    ["cropped_type_hem_mismatch", "cropped_break_hem_mismatch"],
    "the existing legacy conversion has a plain hem despite matching cropped selectors");
  const selectedHem = styleDirectorProposedCroppedHem(proposed.pant);
  assert.equal(selectedHem, "cropped_above_ankle_hem");
  assert.equal(JSON.stringify(proposed), before, "pure resolution must not edit a locked design");
  assert.ok(selectedHem, "matching cropped selectors provide a non-null hem ID");
  const newlyProposed = spec({}, { ...proposed.pant, hem: selectedHem });
  assert.deepEqual(styleDirectorConstructionIssues(newlyProposed), [],
    "a newly proposed cropped type and above-ankle break must reconstruct a consistent hem");
  assert.equal(JSON.stringify(proposed), before, "existing locked ID remains unchanged");
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const proposedCroppedHem=styleDirectorProposedCroppedHem(spec.pant)"));
  assert.ok(agent.includes("if(proposedCroppedHem) spec.pant.hem=proposedCroppedHem"));
});

test("cropped proposal hem inference never conceals contradictory length selections", () => {
  const cases = [
    {type: "cropped_ankle", break: "no_break"},
    {type: "cropped_ankle", break: "full_break"},
    {type: "cropped_ankle", break: "slight_break"},
    {type: "formal_flat_front", break: "cropped_above_ankle"},
    {type: "pleated_trouser", break: "cropped_above_ankle"},
    {type: "wide_leg_relaxed_drape", break: "full_break"},
    {type: "unknown_type", break: "cropped_above_ankle"},
    {type: "cropped_ankle", break: "unknown_break"},
  ] as const;
  for (const fields of cases) {
    const locked = spec({}, fields);
    const snapshot = JSON.stringify(locked);
    assert.equal(styleDirectorProposedCroppedHem(locked.pant), null, JSON.stringify(fields));
    assert.equal(JSON.stringify(locked), snapshot, "unverified combinations must not be rewritten");
  }
  assert.equal(styleDirectorProposedCroppedHem({
    type: "cropped_ankle", break: "cropped_above_ankle",
  }), "cropped_above_ankle_hem", "canonical parity is deterministic");
});

test("cropped hem cannot simultaneously claim a full shoe break", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "cropped_ankle", break: "full_break",
  })).map(x=>x.code), ["cropped_type_hem_mismatch", "cropped_full_break"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    hem: "cropped_above_ankle_hem", break: "full_break",
  })).map(x=>x.code), ["cropped_full_break"]);
});

test("cropped ankle construction cannot claim half shoe break", () => {
  for (const pant of [
    { type: "cropped_ankle", hem: "cropped_above_ankle_hem", break: "half_break" },
    { type: "formal_flat_front", hem: "cropped_above_ankle_hem", break: "half_break" },
    { type: "cropped_ankle", hem: "plain_hem", break: "half_break" },
  ]) {
    const selected = spec({}, pant);
    const before = JSON.stringify(selected);
    const issues = styleDirectorConstructionIssues(selected).map(issue => issue.code);
    assert.ok(issues.includes("cropped_half_break"), JSON.stringify(pant));
    assert.equal(JSON.stringify(selected), before, "review must not rewrite selected IDs");
  }
  // Half-break is physically compatible with a full-length trouser but is
  // NOT an approved canonical pant.break ID. Preserve both facts: no cropped
  // construction conflict, and fail closed on the stale saved selection.
  const ordinaryHalfBreak = spec({}, {
    type: "formal_flat_front", hem: "plain_hem", break: "half_break",
  });
  const original = JSON.stringify(ordinaryHalfBreak);
  assert.deepEqual(styleDirectorConstructionIssues(ordinaryHalfBreak).map(issue => issue.code),
    ["unknown_versioned_option"],
    "ordinary full-length half break needs ID review, not a false cropped-hem conflict");
  assert.equal(JSON.stringify(ordinaryHalfBreak), original);
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "formal_flat_front", hem: "plain_hem", break: "slight_break",
  })), [], "canonical slight break remains buildable for full-length trousers");
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "cropped_ankle", hem: "cropped_above_ankle_hem", break: "no_break",
  })), [], "compatible cropped trousers remain valid");
});

test("cropped trouser construction cannot claim stacked footwear break", () => {
  const cases = [
    [{ type: "cropped_ankle", hem: "cropped_above_ankle_hem", break: "stacked_break" },
      ["cropped_stacked_break"]],
    [{ type: "formal_flat_front", hem: "cropped_above_ankle_hem", break: "stacked_break" },
      ["cropped_stacked_break"]],
    [{ type: "cropped_ankle", hem: "plain_hem", break: "stacked_break" },
      ["cropped_type_hem_mismatch", "cropped_stacked_break"]],
  ] as const;
  for (const [pant, expected] of cases) {
    const locked = spec({}, pant);
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorConstructionIssues(locked).map(issue => issue.code),
      expected, JSON.stringify(pant));
    assert.deepEqual(styleDirectorConstructionIssues(locked).map(issue => issue.code),
      expected, "review signals must remain deterministic");
    assert.equal(JSON.stringify(locked), before, "no automatic rewrite of locked trouser breaks");
  }
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "formal_flat_front", hem: "plain_hem", break: "stacked_break",
  })), [], "a full-length silhouette may request stacking without invented length measurements");
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "cropped_ankle", hem: "cropped_above_ankle_hem", break: "no_break",
  })), [], "a genuinely cropped option remains valid with no footwear break");
});

test("cropped above-ankle break must agree with its saved hem construction", () => {
  for (const pant of [
    { type: "formal_flat_front", hem: "plain_hem", break: "cropped_above_ankle" },
    { type: "formal_flat_front", hem: "cuffed_turn_up", break: "cropped_above_ankle" },
    { type: "cropped_ankle", hem: "plain_hem", break: "cropped_above_ankle" },
  ]) {
    const locked = spec({}, pant);
    const before = JSON.stringify(locked);
    const codes = styleDirectorConstructionIssues(locked).map(issue => issue.code);
    const expected = pant.type === "cropped_ankle"
      ? ["cropped_type_hem_mismatch", "cropped_break_hem_mismatch"]
      : ["cropped_break_hem_mismatch"];
    assert.deepEqual(codes, expected, JSON.stringify(pant));
    assert.equal(JSON.stringify(locked), before, "hem/break review cannot mutate canonical IDs");
  }
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "formal_flat_front", hem: "cropped_above_ankle_hem", break: "cropped_above_ankle",
  })), [], "other trouser types can be hemmed above the ankle when the two IDs agree");
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "cropped_ankle", hem: "cropped_above_ankle_hem", break: "cropped_above_ankle",
  })), [], "complete cropped type/hem/break ID agreement must not require false review");
});

test("cropped trouser type must agree with its hem without rewriting locked IDs", () => {
  const mismatch = spec({}, {type:"cropped_ankle",hem:"plain_hem",break:"slight_break"});
  const original = JSON.stringify(mismatch);
  assert.deepEqual(styleDirectorConstructionIssues(mismatch).map(issue=>issue.code),
    ["cropped_type_hem_mismatch", "cropped_slight_break"]);
  assert.equal(JSON.stringify(mismatch),original);
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type:"cropped_ankle",hem:"cropped_above_ankle_hem",break:"no_break",
  })),[]);
});

test("construction review is deterministic and never mutates locked style IDs", () => {
  const selected=spec({
    type: "camp_collar_resort", collar: "point_standard_collar", wear: "tucked",
    sleeve: "half_sleeve", cuff: "french_double_cuff",
  }, {type:"pleated_trouser",pleat:"flat_front"});
  const before=JSON.stringify(selected);
  const a=styleDirectorConstructionIssues(selected);
  assert.deepEqual(a,styleDirectorConstructionIssues(selected));
  assert.equal(JSON.stringify(selected),before);
  assert.deepEqual(a.map(issue => issue.code), [
    "camp_collar_construction", "short_sleeve_double_cuff",
    "short_sleeve_cuff_review", "pleated_front_missing_pleat",
  ]);
});

test("every canonical locked Style Director option ID is recognised in its own group", () => {
  const groups = [
    ["shirt", "type", "shirt.type"], ["shirt", "collar", "shirt.collar"],
    ["shirt", "cuff", "shirt.cuff"], ["shirt", "placket", "shirt.placket"],
    ["shirt", "pocket", "shirt.pocket"], ["shirt", "sleeve", "shirt.sleeve"],
    ["shirt", "fit", "shirt.fit"], ["shirt", "length", "shirt.length"],
    ["shirt", "hem", "shirt.hem"], ["shirt", "back", "shirt.back"],
    ["shirt", "wear", "shirt.wear"], ["shirt", "button", "shirt.button"],
    ["pant", "type", "pant.type"], ["pant", "fit", "pant.fit"],
    ["pant", "rise", "pant.rise"], ["pant", "waistband", "pant.waistband"],
    ["pant", "hem", "pant.hem"], ["pant", "break", "pant.break"],
  ] as const;
  for (const [garment, field, group] of groups) {
    const options = optionsFor(group);
    assert.ok(options.length > 0, group + " must have a canonical option list");
    for (const option of options) {
      const selected = garment === "shirt"
        ? spec({ [field]: option.id })
        : spec({}, { [field]: option.id });
      const original = JSON.stringify(selected);
      assert.ok(!styleDirectorConstructionIssues(selected).some(issue =>
        issue.code === "unknown_versioned_option"), group + "/" + option.id);
      assert.equal(JSON.stringify(selected), original, "validation must preserve locked IDs");
    }
  }
});

test("stale and cross-group locked option IDs require review without silent substitutions", () => {
  const cases = [
    ["shirt", "type", "obsolete_shirt_type"],
    ["shirt", "collar", "unknown_collar"],
    ["shirt", "cuff", "standard_visible_placket"],
    ["shirt", "placket", "french_double_cuff"],
    ["shirt", "sleeve", "retired_sleeve"],
    ["shirt", "wear", "shirt_length_regular"],
    ["shirt", "fit", "obsolete_shirt_fit"],
    ["pant", "type", "spread_collar"],
    ["pant", "rise", "shirt_length_regular"],
    ["pant", "waistband", "obsolete_waistband"],
    ["pant", "break", "barrel_cuff_1_button"],
  ] as const;
  for (const [garment, field, invalid] of cases) {
    const selected = garment === "shirt"
      ? spec({ [field]: invalid })
      : spec({}, { [field]: invalid });
    const original = JSON.stringify(selected);
    const issues = styleDirectorConstructionIssues(selected);
    assert.equal(issues.filter(issue => issue.code === "unknown_versioned_option").length, 1,
      garment + "/" + field + "/" + invalid);
    assert.deepEqual(issues, styleDirectorConstructionIssues(selected),
      "review signals must be deterministic");
    assert.equal(JSON.stringify(selected), original, "a saved recipe must never be silently rewritten");
  }
});

test("Style Director applies review gates and preserves real versioned camp/band collar IDs", () => {
  const agent=readFileSync("src/lib/style-director-agent.ts","utf8");
  assert.ok(agent.includes("styleDirectorIntelligenceTrustWeight(intel)"));
  assert.ok(agent.includes("styleDirectorConstructionIssues(styleSpec,occasion)"));
  assert.ok(agent.includes('status: constructionIssues.length ? "needs_review" : best.status'));
  for (const token of [
    'spec.shirt.type="camp_collar_resort"',
    'spec.shirt.collar="cuban_camp_collar"',
    'spec.shirt.wear="untucked"',
    'spec.shirt.type="band_collar_shirt"',
    'spec.shirt.collar="mandarin_band_collar"',
  ]) assert.ok(agent.includes(token),token);
});

const photo = (collar: string, shirtWear: string) =>
  ({ collar, shirtWear }) as Pick<DesignerStyle, "collar" | "shirtWear">;

test("formal and semi-formal camp proposals keep photo and locked spec aligned but require review", () => {
  const camp = spec({
    type: "camp_collar_resort", collar: "cuban_camp_collar", wear: "untucked",
  });
  const before = JSON.stringify(camp);
  assert.deepEqual(styleDirectorPresentationIssues(photo("Cuban / Camp Collar", "Untucked"), camp).map(x => x.code),
    ["unverified_camp_photo"], "selectable Cuban label does not prove the live photograph renders it");
  for (const occasion of ["Formal", "Semi-Formal"] as const) {
    assert.deepEqual(styleDirectorConstructionIssues(camp, occasion).map(x => x.code), ["formal_camp_collar"]);
  }
  assert.deepEqual(styleDirectorConstructionIssues(camp, "Casual"), []);
  assert.equal(JSON.stringify(camp), before, "review must not rewrite locked construction");
});

test("band-collar formal proposal preserves compatible photo and versioned collar", () => {
  const band = spec({type: "band_collar_shirt", collar: "mandarin_band_collar", wear: "tucked"});
  assert.deepEqual(styleDirectorPresentationIssues(photo("Mandarin / Band Collar", "Tucked"), band), []);
  assert.deepEqual(styleDirectorConstructionIssues(band, "Formal"), []);
  assert.deepEqual(styleDirectorPresentationIssues(photo("Point (Standard) Collar", "Tucked"), band).map(x => x.code),
    ["legacy_collar_mismatch"]);
});

test("photographic and versioned wear/collar disagreements are both explicit review flags", () => {
  const camp = spec({type: "camp_collar_resort", collar: "cuban_camp_collar", wear: "untucked"});
  assert.deepEqual(styleDirectorPresentationIssues(photo("Point (Standard) Collar", "Tucked"), camp).map(x => x.code),
    ["legacy_wear_mismatch", "legacy_collar_mismatch", "unverified_camp_photo"]);
  const band = spec({type: "band_collar_shirt", collar: "mandarin_band_collar", wear: "tucked"});
  assert.deepEqual(styleDirectorPresentationIssues(photo("Cuban / Camp Collar", "Untucked"), band).map(x => x.code),
    ["legacy_wear_mismatch", "legacy_collar_mismatch"]);
  assert.deepEqual(styleDirectorPresentationIssues(photo("Spread Collar", "Tucked"), spec()), []);
});

test("real-model recommendation wires occasion and presentation review before exposing a status", () => {
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("styleDirectorWearForCandidate(occasion,shirt,style.shirtWear)"));
  assert.ok(agent.includes("styleDirectorConstructionIssues(styleSpec,occasion)"));
  assert.ok(agent.includes("styleDirectorPresentationIssues(best.style,styleSpec)"));
  assert.ok(agent.includes('status: constructionIssues.length ? "needs_review" : best.status'));
});

test("pure proposed-wear rule keeps formal camp untucked without changing other formality presets", () => {
  for (const occasion of ["Formal", "Semi-Formal"] as const) {
    assert.equal(styleDirectorWearForCandidate(occasion, "Camp-Collar Shirt", "Tucked"), "Untucked");
    assert.equal(styleDirectorWearForCandidate(occasion, "Cuban Resort Shirt", "Tucked"), "Untucked");
    assert.equal(styleDirectorWearForCandidate(occasion, "Band-Collar Shirt", "Untucked"), "Tucked");
    assert.equal(styleDirectorWearForCandidate(occasion, "Spread-Collar Dress Shirt", "Untucked"), "Tucked");
  }
  assert.equal(styleDirectorWearForCandidate("Casual", "Camp-Collar Shirt", "Tucked"), "Untucked");
  assert.equal(styleDirectorWearForCandidate("Smart-Casual", "Oxford Button-Down Shirt", "Untucked"), "Untucked");
  assert.equal(styleDirectorWearForCandidate("Casual", "Spread-Collar Dress Shirt", "Tucked"), "Tucked");
});

test("Cuban-only and camp aliases share canonical collar construction without inventing a photo option", () => {
  const choices=selectableCollars;
  const camp=styleDirectorCandidateCollar("Camp-Collar Shirt",choices);
  const cuban=styleDirectorCandidateCollar("Cuban Resort Shirt",choices);
  assert.deepEqual(cuban,camp,"Cuban-only candidate must not use a different legacy mapping");
  assert.equal(camp?.versioned,"cuban_camp_collar");
  // The real selectable vocabulary *does* include the advanced Cuban label,
  // but its option metadata says livePreview:none: label parity is not visual proof.
  const cubanOption=optionsFor("shirt.collar").find(option=>option.id==="cuban_camp_collar");
  assert.equal(cubanOption?.renderSupport.livePreview,"none");
  assert.equal(camp?.legacy,cubanOption?.label);
  assert.ok(choices.includes("Cuban / Camp Collar"));
  const band=styleDirectorCandidateCollar("Band-Collar Shirt",choices);
  assert.deepEqual(band,{legacy:"Mandarin / Band Collar",versioned:"mandarin_band_collar"});
  assert.equal(styleDirectorCandidateCollar("Spread-Collar Dress Shirt",choices),null);
});

test("named Cuban and camp candidate paths remain review-only across formal and casual wear", () => {
  for(const candidate of ["Camp-Collar Shirt","Cuban Resort Shirt"]){
    const named=styleDirectorCandidateCollar(candidate,selectableCollars);
    assert.equal(named?.versioned,"cuban_camp_collar");
    const versioned=spec({
      type:"camp_collar_resort",collar:named!.versioned,
      wear:"untucked",
    });
    for(const occasion of ["Formal","Casual"] as const){
      const wear=styleDirectorWearForCandidate(occasion,candidate,"Tucked");
      assert.equal(wear,"Untucked");
      assert.equal(named?.legacy,"Cuban / Camp Collar");
      const photoStyle=photo(named.legacy??"Point (Standard) Collar",wear);
      const presentation=styleDirectorPresentationIssues(photoStyle,versioned);
      assert.deepEqual(presentation.map(issue=>issue.code),["unverified_camp_photo"],
        "selectable Cuban label cannot imply verified live photographic rendering");
      const construction=styleDirectorConstructionIssues(versioned,occasion);
      assert.deepEqual(construction.map(issue=>issue.code),
        occasion==="Formal"?["formal_camp_collar"]:[]);
      assert.ok([...presentation,...construction].length>0,
        "the real-model decision must remain needs_review without verified photo support");
    }
  }
  const agent=readFileSync("src/lib/style-director-agent.ts","utf8");
  assert.equal(agent.split("styleDirectorCandidateCollar(shirt,").length-1,2,
    "photo selection and versioned spec must use the same named-collar resolver");
  assert.ok(agent.includes('status: constructionIssues.length ? "needs_review" : best.status'));
});


test("named short/half sleeves use existing construction IDs without inventing physical measurements", () => {
  const names=["Short-Sleeve Shirt","Short Sleeve Camp-Collar Shirt","Half-Sleeve Band-Collar Shirt",
    "Short-Sleeved Resort Shirt","Half Sleeved Band-Collar Shirt"];
  for(const name of names){
    assert.deepEqual(styleDirectorCandidateSleeve(name),{
      sleeve:"half_sleeve",cuff:"open_short_hem_cuff",
    });
  }
  assert.equal(styleDirectorCandidateSleeve("Spread-Collar Dress Shirt"),null);
  assert.equal(styleDirectorCandidateSleeve("Sleeveless Layer"),null);
  assert.equal(styleDirectorCandidateSleeve("Short Sleevelet Print"),null);
  assert.equal(styleDirectorCandidateSleeve("Half Sleevewear Shirt"),null);
  assert.ok(optionsFor("shirt.sleeve").some(option=>option.id==="half_sleeve"));
  assert.ok(optionsFor("shirt.cuff").some(option=>option.id==="open_short_hem_cuff"));
  const named=styleDirectorCandidateSleeve(names[0])!;
  const short=spec({type:"short_sleeve_shirt",sleeve:named.sleeve,cuff:named.cuff});
  const before=JSON.stringify(short);
  assert.deepEqual(styleDirectorConstructionIssues(short),[]);
  assert.deepEqual(styleDirectorPresentationIssues(photo("Spread Collar","Tucked"),short)
    .map(issue=>issue.code),["unverified_short_sleeve_photo"],
    "the legacy photographic style cannot represent sleeve length");
  assert.equal(JSON.stringify(short),before,"review must never rewrite construction");
});

test("short-sleeve type, sleeve and cuff disagreements require explicit review", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type:"short_sleeve_shirt",sleeve:"full_sleeve",cuff:"barrel_cuff_1_button",
  })).map(issue=>issue.code),["short_sleeve_type_mismatch"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type:"short_sleeve_shirt",sleeve:"half_sleeve",cuff:"barrel_cuff_1_button",
  })).map(issue=>issue.code),["short_sleeve_cuff_review"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    sleeve:"half_sleeve",cuff:"french_double_cuff",
  })).map(issue=>issue.code),["short_sleeve_double_cuff", "short_sleeve_cuff_review"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    sleeve:"full_sleeve",cuff:"open_short_hem_cuff",
  })).map(issue=>issue.code),["full_sleeve_open_hem_cuff"]);
});

test("combined camp and short sleeve proposals retain both review gates and canonical IDs", () => {
  const collar=styleDirectorCandidateCollar("Short-Sleeve Camp-Collar Shirt",selectableCollars);
  const sleeve=styleDirectorCandidateSleeve("Short-Sleeve Camp-Collar Shirt");
  assert.equal(collar?.versioned,"cuban_camp_collar");
  assert.deepEqual(sleeve,{sleeve:"half_sleeve",cuff:"open_short_hem_cuff"});
  const combined=spec({type:"camp_collar_resort",collar:collar!.versioned,
    wear:"untucked",sleeve:sleeve!.sleeve,cuff:sleeve!.cuff});
  assert.deepEqual(styleDirectorConstructionIssues(combined,"Formal").map(issue=>issue.code),
    ["formal_camp_collar"]);
  assert.deepEqual(styleDirectorPresentationIssues(photo("Cuban / Camp Collar","Untucked"),combined)
    .map(issue=>issue.code),["unverified_camp_photo","unverified_short_sleeve_photo"]);
  const agent=readFileSync("src/lib/style-director-agent.ts","utf8");
  assert.ok(agent.includes("styleDirectorCandidateSleeve(shirt)"));
  assert.ok(agent.includes("spec.shirt.sleeve=namedSleeve.sleeve"));
  assert.ok(agent.includes("spec.shirt.cuff=namedSleeve.cuff"));
  assert.ok(agent.includes('status: constructionIssues.length ? "needs_review" : best.status'));
});

test("generated cutaway dress shirt preserves exact legacy and versioned collar IDs", () => {
  // generateDesignerDirections emits Cutaway-Collar Dress Shirt for formal
  // statement outfits; a default spread photo must not silently stand in.
  const cutaway = styleDirectorCandidateCollar("Cutaway-Collar Dress Shirt",selectableCollars);
  assert.deepEqual(cutaway,{legacy:"Cutaway Collar",versioned:"cutaway_collar"});
  assert.ok(optionsFor("shirt.collar").some(option=>
    option.id==="cutaway_collar" && option.renderSupport.livePreview==="approximate"));
  const named=spec({type:"dress_shirt",collar:cutaway!.versioned,wear:"tucked"});
  assert.deepEqual(styleDirectorConstructionIssues(named,"Formal"),[]);
  assert.deepEqual(styleDirectorPresentationIssues(photo(cutaway!.legacy!,"Tucked"),named)
    .map(issue=>issue.code),["unverified_cutaway_photo"],
    "an approximate photographic cutaway is not approved construction evidence");
  assert.deepEqual(styleDirectorPresentationIssues(photo("Spread Collar","Tucked"),named)
    .map(issue=>issue.code),["legacy_collar_mismatch","unverified_cutaway_photo"]);
  assert.deepEqual(styleDirectorPresentationIssues(photo("Cutaway Collar","Tucked"),spec())
    .map(issue=>issue.code),["legacy_collar_mismatch"]);
  const agent=readFileSync("src/lib/style-director-agent.ts","utf8");
  assert.ok(agent.includes('namedCollar?.versioned === "cutaway_collar"'),
    "candidate photographic mapping must select the real cutaway label");
  assert.ok(agent.includes('spec.shirt.collar="cutaway_collar"'),
    "candidate construction must retain the canonical cutaway ID");
  assert.ok(agent.includes("styleDirectorPresentationIssues(best.style,styleSpec)"),
    "unverified cutaway photo must affect the exposed recommendation status");
});

test("incidental collar substrings never rewrite a named candidate or photographic choice", () => {
  for (const candidate of ["Campus Work Shirt", "Bandwidth Travel Shirt", "Mandarinette Print Shirt", "Cutawayish Dress Shirt"]) {
    assert.equal(styleDirectorCandidateCollar(candidate, selectableCollars), null, candidate);
    assert.equal(styleDirectorWearForCandidate("Casual", candidate, "Tucked"), "Tucked", candidate);
  }
  for (const collar of ["Campus Collar", "Bandwidth Collar", "Mandarinette Collar", "Cutawayish Collar"]) {
    assert.deepEqual(styleDirectorPresentationIssues(photo(collar, "Tucked"), spec()).map(issue => issue.code),
      ["legacy_collar_mismatch"], collar);
  }
  assert.equal(styleDirectorCandidateCollar("Cuban-Collar Shirt", selectableCollars)?.versioned, "cuban_camp_collar");
  assert.equal(styleDirectorCandidateCollar("Band Collar Shirt", selectableCollars)?.versioned, "mandarin_band_collar");
  assert.equal(styleDirectorCandidateCollar("Cutaway Collar Shirt", selectableCollars)?.versioned, "cutaway_collar");
});

test("band-collar shirt type cannot silently use a spread or camp collar", () => {
  const mismatched=spec({type:"band_collar_shirt",collar:"spread_collar",wear:"tucked"});
  const before=JSON.stringify(mismatched);
  assert.deepEqual(styleDirectorConstructionIssues(mismatched,"Formal").map(issue=>issue.code),
    ["band_collar_construction"]);
  assert.equal(JSON.stringify(mismatched),before,"review must not rewrite locked style IDs");
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type:"band_collar_shirt",collar:"cuban_camp_collar",wear:"tucked",
  }),"Casual").map(issue=>issue.code),["camp_collar_type_mismatch","band_collar_construction"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type:"band_collar_shirt",collar:"mandarin_band_collar",wear:"tucked",
  }),"Formal"),[]);
});

test("Cuban camp collar on another shirt type requires review without changing IDs", () => {
  for (const type of ["dress_shirt", "band_collar_shirt"] as const) {
    const mismatched=spec({type,collar:"cuban_camp_collar",wear:"untucked"});
    const before=JSON.stringify(mismatched);
    const issues=styleDirectorConstructionIssues(mismatched,"Casual").map(issue=>issue.code);
    assert.ok(issues.includes("camp_collar_type_mismatch"));
    assert.equal(JSON.stringify(mismatched),before,"review must not rewrite the proposed construction");
  }
  const valid=spec({type:"camp_collar_resort",collar:"cuban_camp_collar",wear:"untucked"});
  assert.deepEqual(styleDirectorConstructionIssues(valid,"Casual"),[]);
  assert.deepEqual(styleDirectorConstructionIssues(valid,"Formal").map(issue=>issue.code),
    ["formal_camp_collar"]);
});


test("Mandarin/Band collar on an unrelated shirt type requires review without rewriting IDs", () => {
  const mismatched = spec({ type: "dress_shirt", collar: "mandarin_band_collar" });
  const before = JSON.stringify(mismatched);
  assert.deepEqual(styleDirectorConstructionIssues(mismatched).map(issue => issue.code),
    ["band_collar_type_mismatch"]);
  assert.equal(JSON.stringify(mismatched), before);
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type: "band_collar_shirt", collar: "mandarin_band_collar",
  })), []);
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type: "dress_shirt", collar: "spread_collar",
  })), []);
});

test("cropped ankle construction cannot claim slight shoe break", () => {
  for (const pant of [
    { type: "cropped_ankle", hem: "cropped_above_ankle_hem", break: "slight_break" },
    { type: "formal_flat_front", hem: "cropped_above_ankle_hem", break: "slight_break" },
  ]) {
    const selected = spec({}, pant);
    const before = JSON.stringify(selected);
    assert.deepEqual(styleDirectorConstructionIssues(selected).map(issue => issue.code),
      ["cropped_slight_break"]);
    assert.equal(JSON.stringify(selected), before);
  }
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "formal_flat_front", hem: "plain_hem", break: "slight_break",
  })), [], "ordinary full-length trousers can have a slight break");
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "cropped_ankle", hem: "cropped_above_ankle_hem", break: "no_break",
  })), [], "cropped trousers with no break remain compatible");
});


test("photographic collar label matching ignores incidental substrings", () => {
  const choices = ["Campus Collar", "Bandwidth Collar", "Cutawayish Collar",
    "Cuban / Camp Collar", "Mandarin / Band Collar", "Cutaway Collar"];
  assert.deepEqual(styleDirectorCandidateCollar("Camp-Collar Shirt", choices),
    { legacy: "Cuban / Camp Collar", versioned: "cuban_camp_collar" });
  assert.deepEqual(styleDirectorCandidateCollar("Band-Collar Shirt", choices),
    { legacy: "Mandarin / Band Collar", versioned: "mandarin_band_collar" });
  assert.deepEqual(styleDirectorCandidateCollar("Cutaway-Collar Shirt", choices),
    { legacy: "Cutaway Collar", versioned: "cutaway_collar" });
  assert.deepEqual(styleDirectorCandidateCollar("Camp-Collar Shirt", ["Campus Collar"]),
    { legacy: null, versioned: "cuban_camp_collar" },
    "missing supported photo label must fail closed rather than select a lookalike");
});


test("candidate sleeve type and construction share one strict resolver", () => {
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes('else if(namedSleeve) spec.shirt.type="short_sleeve_shirt"'));
  assert.ok(agent.includes("const namedSleeve=styleDirectorCandidateSleeve(shirt)"));
  assert.ok(!agent.includes('/(?:short|half)[- ]?sleeve/.test(shirt)'),
    "shirt type must not use a looser substring matcher than sleeve construction");
  for (const label of ["Short Sleeve Shirt", "Half-Sleeved Shirt", "Short-Sleeved Shirt"]) {
    assert.deepEqual(styleDirectorCandidateSleeve(label),
      { sleeve: "half_sleeve", cuff: "open_short_hem_cuff" });
  }
  for (const label of ["Short Sleevelet Shirt", "Half Sleevewear Shirt", "Short Sleeveless Shirt"]) {
    assert.equal(styleDirectorCandidateSleeve(label), null,
      "partial sleeve words must not create an incompatible versioned shirt type");
  }
});


test("special named collars select canonical IDs but do not invent photographic support", () => {
  const cases = [
    ["Point (Standard) Collar Shirt", "point_standard_collar", "Point (Standard) Collar"],
    ["Club Collar Shirt", "club_collar", "Club Collar"],
    ["Wing Collar Dress Shirt", "wing_collar", null],
    ["Tab Collar Shirt", "tab_collar", null],
    ["Pin Collar Shirt", "pin_collar", null],
  ] as const;
  for (const [name, versioned, legacy] of cases) {
    assert.ok(optionsFor("shirt.collar").some((option) => option.id === versioned), versioned);
    assert.deepEqual(styleDirectorCandidateSpecialCollar(name, selectableCollars),
      { versioned, legacy }, name);
    assert.deepEqual(styleDirectorCandidateCollarIssues(name, { collar: versioned }), [],
      "the matching locked construction must not be falsely flagged: " + name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
    const photoLabel = legacy || "Point (Standard) Collar";
    const locked = spec({ collar: versioned });
    const before = JSON.stringify(locked);
    const issues = styleDirectorPresentationIssues(photo(photoLabel, "Tucked"), locked)
      .map((issue) => issue.code);
    if (legacy) {
      assert.deepEqual(issues, [], "an existing selectable photo ID must agree with the locked ID");
    } else {
      assert.ok(issues.includes("unverified_special_collar_photo"),
        "a missing approved photo must be flagged even with correct construction: " + name);
      assert.ok(issues.includes("legacy_collar_mismatch"),
        "fallback photos must not certify another locked collar: " + name);
    }
    assert.equal(JSON.stringify(locked), before, "presentation review must not rewrite locked ID");
  }
  for (const noUniqueFamily of [
    "Dress Shirt", "Oxford Shirt", "Campus Collar Shirt",
    "Point Collar Club Collar Shirt", "Wing Collar Band-Collar Shirt",
  ]) {
    assert.equal(styleDirectorCandidateSpecialCollar(noUniqueFamily, selectableCollars), null,
      "no inference on unknown or contradictory names: " + noUniqueFamily);
  }
  assert.deepEqual(styleDirectorCandidateSpecialCollar("Club Collar Shirt", []),
    { versioned: "club_collar", legacy: null },
    "a missing photo choice must not block canonical construction or invent a photographic label");
  assert.deepEqual(styleDirectorCandidateSpecialCollar("Tab Collar Shirt", ["Tab Collar"]),
    { versioned: "tab_collar", legacy: null },
    "a text-only legacy choice is not proof of the missing real photographic shape");
});

test("matching labels without live preview cannot certify tab or pin collar accuracy", () => {
  for (const id of ["tab_collar", "pin_collar"] as const) {
    const label = optionsFor("shirt.collar").find((option) => option.id === id)?.label;
    assert.ok(label);
    const locked = spec({ collar: id });
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorPresentationIssues(photo(label, "Tucked"), locked)
      .map((issue) => issue.code), ["unverified_special_collar_photo"],
      "matching a label is not evidence of a photographed garment shape: " + id);
    assert.equal(JSON.stringify(locked), before);
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const specialCollar = styleDirectorCandidateSpecialCollar(shirt, DESIGNER_STYLE_CHOICES.collar)"));
  assert.ok(agent.includes("if (specialCollar) spec.shirt.collar=specialCollar.versioned;"));
  assert.ok(agent.includes("else if (specialCollar?.legacy)"),
    "photo selection must be guarded by an actual compatible legacy choice");
});

test("single named collar family must match the locked versioned construction", () => {
  const cases: Array<[string, string[]]> = [
    ["Cuban Camp Collar Shirt", ["cuban_camp_collar"]],
    ["Mandarin Band-Collar Shirt", ["mandarin_band_collar"]],
    ["Cutaway-Collar Dress Shirt", ["cutaway_collar"]],
    ["Spread-Collar Dress Shirt", ["spread_collar", "english_spread_collar"]],
    ["Oxford Button-Down Shirt", ["button_down_collar", "soft_button_down"]],
    ["Point (Standard) Collar Shirt", ["point_standard_collar"]],
    ["Club Collar Shirt", ["club_collar"]],
    ["Wing Collar Shirt", ["wing_collar"]],
    ["Tab Collar Shirt", ["tab_collar"]],
    ["Pin Collar Shirt", ["pin_collar"]],
  ];
  for (const [name, matching] of cases) {
    for (const id of matching) {
      assert.ok(optionsFor("shirt.collar").some(option => option.id === id), id);
      const locked = spec({ collar: id });
      const before = JSON.stringify(locked);
      assert.deepEqual(styleDirectorCandidateCollarIssues(name, locked.shirt), [], name + "/" + id);
      assert.equal(JSON.stringify(locked), before, "collar parity may not mutate the locked option");
    }
    const differentId = optionsFor("shirt.collar").find(option => !matching.includes(option.id))?.id;
    assert.ok(differentId);
    const locked = spec({ collar: differentId });
    const before = JSON.stringify(locked);
    const issues = styleDirectorCandidateCollarIssues(name, locked.shirt);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_collar_mismatch"], name);
    assert.deepEqual(issues, styleDirectorCandidateCollarIssues(name, locked.shirt),
      "mismatch review must be deterministic");
    assert.equal(JSON.stringify(locked), before, "mismatch must not rewrite a saved construction");
  }
});

test("unknown or contradictory collar wording must not infer a single locked collar", () => {
  for (const label of [
    "Oxford Shirt", "Campus Shirt", "Widespread Print Shirt",
    "Button-Downish Shirt", "Dress Shirt",
    "Point Collar Club Collar Shirt", "Camp-Collar Spread-Collar Shirt",
  ]) {
    assert.deepEqual(styleDirectorCandidateCollarIssues(label, { collar: "spread_collar" }),
      [], "unknown or mixed collar wording must not guess an expected ID: " + label);
  }
  assert.deepEqual(styleDirectorCandidateWordingIssues("Point Collar Club Collar Shirt")
    .map(issue => issue.code), ["ambiguous_candidate_collar"]);
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("...styleDirectorCandidateCollarIssues(candidate.garments.shirt, styleSpec.shirt)"),
    "collar parity must affect real-model construction review and status");
});

test("drawstring waistband instructions remain independent of trouser silhouette and pleat count", () => {
  const cases = [
    ["Tailored Drawstring Trouser", "requested"],
    ["Single-Pleat Drawstring Trouser", "requested"],
    ["Flat-Front Draw-String Trouser", "requested"],
    ["Wide-Leg Drawstring Pants", "requested"],
    ["Drawstring Waistband", "requested"],
    ["No Drawstring Trouser", "prohibited"],
    ["Without Draw-string Pants", "prohibited"],
    ["Do Not Use Drawstring", "prohibited"],
    ["Avoid Drawstring", "prohibited"],
    ["Drawstring Is Forbidden", "prohibited"],
    ["Drawstring-Free Trouser", "prohibited"],
    ["Drawstringless Pants", "prohibited"],
    ["Drawstring Is Optional", null],
    ["Optional Drawstring Trouser", null],
    ["Drawstring Not Necessary", null],
    ["Pleated Trouser", null],
    ["Drawstringlike Stripe Trouser", null],
    ["No Drawstring; Drawstring Waistband", "ambiguous"],
    ["Drawstring Forbidden; Drawstring Requested", "ambiguous"],
    ["With or Without Drawstring", "ambiguous"],
  ] as const;
  for (const [label, expected] of cases) {
    assert.equal(styleDirectorCandidateDrawstringWaistband(label), expected, label);
    const issues = styleDirectorCandidateWordingIssues("Dress Shirt", label).map(issue => issue.code);
    assert.deepEqual(issues, expected === "ambiguous" ? ["ambiguous_candidate_waistband"] : [],
      "do not approve contradictory waistband instructions: " + label);
  }
});

test("drawstring intent is checked against immutable canonical waistband selections", () => {
  assert.ok(optionsFor("pant.waistband").some(option => option.id === "drawstring_elastic"));
  assert.ok(optionsFor("pant.waistband").some(option => option.id === "belt_loops"));
  for (const [label, goodId, wrongId] of [
    ["Drawstring Pleated Trouser", "drawstring_elastic", "belt_loops"],
    ["Flat-Front Drawstring Trouser", "drawstring_elastic", "side_adjuster_tabs"],
    ["No Drawstring Trouser", "belt_loops", "drawstring_elastic"],
    ["Without Drawstring Pleated Trouser", "side_adjuster_tabs", "drawstring_elastic"],
  ] as const) {
    const saved = spec({}, { waistband: goodId });
    const before = JSON.stringify(saved);
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(label, saved.pant), [], label);
    const bad = styleDirectorCandidateWaistbandIssues(label, { waistband: wrongId });
    assert.deepEqual(bad.map(issue => issue.code), ["candidate_waistband_mismatch"], label);
    assert.deepEqual(bad, styleDirectorCandidateWaistbandIssues(label, { waistband: wrongId }),
      "issue order and explanations must be deterministic");
    assert.equal(JSON.stringify(saved), before, "review cannot rewrite saved waistband IDs");
  }
  for (const label of [
    "Drawstring Optional", "Optional Drawstring", "No Drawstring; Drawstring Waistband",
  ]) {
    assert.deepEqual(styleDirectorCandidateWaistbandIssues(label, { waistband: "belt_loops" }), [],
      "uncommitted or contradictory labels must not invent a single waistband intent");
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes('if (styleDirectorCandidateDrawstringWaistband(trouser) === "requested")'),
    "actual Style Director candidate resolver must use shared waistband intent");
  assert.ok(agent.includes("...styleDirectorCandidateWaistbandIssues(candidate.garments.trouser, styleSpec.pant)"),
    "real-model needs_review status must include locked drawstring parity");
  assert.ok(!agent.includes('trouser.includes("drawstring")'),
    "substring-only drawstring selection bypasses negative wording");
});

test("negated and optional wide-leg labels cannot select an unwanted silhouette", () => {
  const cases = [
    ["Wide-Leg Trouser", "requested"],
    ["Wide-Leg / Relaxed Drape Trouser", "requested"],
    ["Wide Fit Trousers", "requested"],
    ["Wide Pants", "requested"],
    ["No Wide-Leg Trouser", "prohibited"],
    ["Without Wide-Leg Pants", "prohibited"],
    ["Do Not Wear Wide-Leg Trousers", "prohibited"],
    ["Avoid Wide Fit Trousers", "prohibited"],
    ["Wide-Leg Pants Are Not Allowed", "prohibited"],
    ["Wide-leg Is Forbidden", "prohibited"],
    ["Optional Wide-Leg Trouser", null],
    ["Wide-Leg Pants Optional", null],
    ["Widespread Print Trouser", null],
    ["Wide Waistband Tailored Trouser", null],
    ["Wide-wale Corduroy Trouser", null],
    ["No Wide-Leg; Wide-Leg Trouser", "ambiguous"],
    ["No Wide-Leg Pants; Wide Fit Trousers", "ambiguous"],
    ["Wide-Leg Not Allowed; Wide-Leg Requested", "ambiguous"],
  ] as const;
  for (const [name, expected] of cases) {
    assert.equal(styleDirectorCandidateWideLegIntent(name), expected, name);
    assert.equal(styleDirectorCandidateWideLeg(name), expected === "requested", name);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", name).map(i => i.code),
      expected === "ambiguous" ? ["ambiguous_candidate_wide_leg"] : [], name);
  }
});

test("wide-leg candidate intent is checked against immutable saved trouser types", () => {
  const cases = [
    ["Wide Leg Trousers", "wide_leg_relaxed_drape", "formal_flat_front"],
    ["No Wide-Leg Pants", "formal_flat_front", "wide_leg_relaxed_drape"],
    ["Wide-Leg Trousers Not Allowed", "pleated_trouser", "wide_leg_relaxed_drape"],
  ] as const;
  for (const [candidate, valid, invalid] of cases) {
    const locked = spec({}, { type: valid });
    const snapshot = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(candidate, locked.pant), []);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(candidate, { type: invalid })
      .map(i => i.code), ["candidate_wide_leg_mismatch"], candidate);
    assert.deepEqual(styleDirectorCandidateWideLegIssues(candidate, { type: invalid }),
      styleDirectorCandidateWideLegIssues(candidate, { type: invalid }),
      "validation must be deterministic");
    assert.equal(JSON.stringify(locked), snapshot, "review cannot change saved IDs");
  }
  for (const candidate of ["Wide-Leg Optional", "No Wide-Leg; Wide-Leg"]) {
    assert.deepEqual(styleDirectorCandidateWideLegIssues(candidate,
      { type: "wide_leg_relaxed_drape" }), [], "optional or contradictory wording does not choose a locked ID");
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("...styleDirectorCandidateWideLegIssues(candidate.garments.trouser, styleSpec.pant)"),
    "final real-model recommendation status must include proposed wide-leg parity");
  assert.ok(agent.includes('styleDirectorCandidateWideLegIntent(trouser) === "prohibited"'),
    "legacy wide-leg default must be replaced when the candidate forbids it");
});

test("explicit trouser fits retain their real IDs while photo truth requires review", () => {
  const cases = [
    ["Slim Tapered Trouser", "slim_tapered"],
    ["Straight Classic Trouser", "straight_classic"],
    ["Regular Tapered Pants", "regular_tapered"],
    ["Korean Straight Wide Trouser", "korean_straight_wide"],
    ["Korean Tapered Pants", "korean_tapered"],
    ["Baggy Wide Trouser", "baggy_wide"],
    ["Wide-Leg Drape Trouser", "wide_leg_drape"],
    ["Pleated Straight Trouser", "pleated_straight"],
    ["Cargo Utility Pants", "cargo_utility"],
    ["Jean-Cut Suiting Fit Trouser", "jean_cut_suiting_fit"],
  ] as const;
  for (const [name, id] of cases) {
    const option = optionsFor("pant.fit").find(item => item.id === id);
    assert.ok(option, id);
    assert.equal(option.renderSupport.livePreview, "none",
      "new fit geometry must not be mistaken for a verified live photo");
    assert.equal(styleDirectorCandidateTrouserFit(name), id, name);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", name), [], name);
    const saved = spec({}, { fit: id });
    const before = JSON.stringify(saved);
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(name, saved.pant)
      .map(issue => issue.code), ["unverified_trouser_fit_photo"], name);
    const other = id === "slim_tapered" ? "straight_classic" : "slim_tapered";
    assert.deepEqual(styleDirectorCandidateTrouserFitIssues(name, { fit: other })
      .map(issue => issue.code), ["candidate_trouser_fit_mismatch"], name);
    assert.equal(JSON.stringify(saved), before, "fit review must not rewrite locked IDs");
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const namedTrouserFit=styleDirectorCandidateTrouserFit(trouser)"));
  assert.ok(agent.includes("if(namedTrouserFit) spec.pant.fit=namedTrouserFit"));
  assert.ok(agent.includes("...styleDirectorCandidateTrouserFitIssues(candidate.garments.trouser, styleSpec.pant)"),
    "all named fit requests must reach real-model review status");
});

test("negated optional and conflicting trouser fits cannot silently select a cut", () => {
  const cases = [
    ["No Slim Tapered Trouser", null, ["slim_tapered"], false],
    ["Without Korean Tapered Pants", null, ["korean_tapered"], false],
    ["Do Not Wear Baggy Wide", null, ["baggy_wide"], false],
    ["Wide-Leg Drape Is Forbidden", null, ["wide_leg_drape"], false],
    ["Optional Straight Classic", null, [], false],
    ["Regular Tapered Is Optional", null, [], false],
    ["No Slim Tapered; Regular Tapered", "regular_tapered", ["slim_tapered"], false],
    ["No Korean Tapered; Korean Straight Wide", "korean_straight_wide", ["korean_tapered"], false],
    ["Slim Tapered; Baggy Wide", null, [], true],
    ["No Slim Tapered; Slim Tapered", "slim_tapered", ["slim_tapered"], true],
    ["Korean Tapered; Korean Straight Wide", null, [], true],
  ] as const;
  for (const [name, request, banned, ambiguous] of cases) {
    const intent = styleDirectorCandidateTrouserFitIntent(name);
    assert.equal(intent.requested, request, name);
    assert.deepEqual(intent.prohibited, [...banned], name);
    assert.equal(intent.ambiguous, ambiguous, name);
    assert.equal(styleDirectorCandidateTrouserFit(name), ambiguous ? null : request, name);
    const wording = styleDirectorCandidateWordingIssues("Dress Shirt", name).map(x => x.code);
    assert.deepEqual(wording,
      ambiguous ? ["ambiguous_candidate_trouser_fit"] : [], name);
    if (ambiguous) {
      assert.deepEqual(styleDirectorCandidateTrouserFitIssues(name, { fit: "slim_tapered" }), [],
        "mixed requirements must not be guessed");
    } else {
      for (const id of banned) {
        assert.deepEqual(styleDirectorCandidateTrouserFitIssues(name, { fit: id }).map(x => x.code),
          ["candidate_trouser_fit_mismatch"], name);
      }
    }
  }
  for (const name of [
    "Slim Stripe Trouser", "Wide Waistband Trouser", "Korean Print Trouser",
    "Cargo Pocket Trouser", "Jean-Cut Suiting Pattern Shirt", "Pleated Front Trouser",
    "Relaxed Drape Fabric", "Regular Trouser",
  ]) {
    assert.deepEqual(styleDirectorCandidateTrouserFitIntent(name),
      { requested: null, prohibited: [], ambiguous: false },
      "incidental words must not select a versioned pant.fit ID: " + name);
  }
  const unknown = styleDirectorCandidateTrouserFitIssues("Baggy Wide Trouser", { fit: "not_a_fit" });
  assert.deepEqual(unknown.map(issue => issue.code), ["candidate_trouser_fit_mismatch"]);
  assert.deepEqual(unknown, styleDirectorCandidateTrouserFitIssues("Baggy Wide Trouser", { fit: "not_a_fit" }),
    "mismatch reports must be deterministic");
});

test("only explicitly named wide-leg silhouettes select a wide trouser", () => {
  for (const label of [
    "Wide-Leg Trouser",
    "Wide-leg / Relaxed Drape Trouser",
    "Wide Legged Pants",
    "Wide Fit Trousers",
    "Wide-fit Pants",
    "Wide Trousers",
  ]) {
    assert.equal(styleDirectorCandidateWideLeg(label), true, label);
  }
  for (const label of [
    "Widespread Print Trouser",
    "Wide Waistband Tailored Trouser",
    "Wide Side Seam Trouser",
    "Wide Stripe Trouser",
    "Wider Leg Trouser",
    "Wide-wale Corduroy Trouser",
    "Standard Flat-Front Trouser",
    "Single-Pleat Tailored Trouser",
  ]) {
    assert.equal(styleDirectorCandidateWideLeg(label), false, label);
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.equal(agent.split("styleDirectorCandidateWideLeg(trouser)").length-1, 3,
    "photographic and versioned paths plus independent drawstring guard must share wide-leg intent");
  assert.ok(agent.includes('if (!styleDirectorCandidateWideLeg(trouser) && trouserFront === null)'),
    "drawstring should only supply a fallback silhouette without overriding named wide-leg or front intent");
  assert.ok(!agent.includes('trouser.includes("wide")'),
    "no substring-based photographic trouser silhouette selection");
  assert.ok(!agent.includes('/wide/.test(trouser)'),
    "no substring-based versioned trouser silhouette selection");
});

test("named shirt plackets resolve only canonical IDs and real selectable photos", () => {
  const choices = optionsFor("shirt.placket")
    .filter(option => option.legacySelectable !== false)
    .map(option => option.legacyLabel || option.label);
  const cases = [
    ["Standard Placket Shirt", "standard_visible_placket", "Standard (visible stitch)"],
    ["Visible-Stitch Placket Shirt", "standard_visible_placket", "Standard (visible stitch)"],
    ["Hidden Placket Dress Shirt", "hidden_fly_front", "Hidden / Fly-front"],
    ["Fly-Front Placket Shirt", "hidden_fly_front", "Hidden / Fly-front"],
    ["French Placket Shirt", "french_placket", null],
    ["Covered Placket Shirt", "covered_placket", null],
    ["Contrast Placket Shirt", "contrast_placket", null],
  ] as const;
  for (const [name, versioned, legacy] of cases) {
    assert.ok(optionsFor("shirt.placket").some(x => x.id === versioned), versioned);
    assert.deepEqual(styleDirectorCandidatePlacket(name, choices), { versioned, legacy }, name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
    const locked = spec({ placket: versioned });
    const prior = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(name, locked.shirt), [], name);
    const mismatchId = versioned === "standard_visible_placket" ? "hidden_fly_front" : "standard_visible_placket";
    assert.deepEqual(styleDirectorCandidatePlacketIssues(name, { placket: mismatchId })
      .map(issue => issue.code), ["candidate_placket_mismatch"], name);
    const photographic = { ...photo("Spread Collar", "Tucked"), ...(legacy ? { placket: legacy } : {}) };
    const issues = styleDirectorPresentationIssues(photographic, locked).map(issue => issue.code);
    if (legacy) assert.deepEqual(issues, [], "matching existing legacy plackets remain unchanged: " + name);
    else assert.ok(issues.includes("unverified_placket_photo"),
      "unavailable photographic constructions must remain review-only: " + name);
    assert.equal(JSON.stringify(locked), prior, "placket check must not mutate locked specs");
  }
  assert.equal(styleDirectorCandidatePlacket("French Placket Shirt", [] )?.legacy, null);
  assert.equal(styleDirectorCandidatePlacket("Hidden Placket Shirt", [] )?.legacy, null,
    "missing legacy photo choice must not invent an option");
  assert.deepEqual(styleDirectorCandidatePlacket("Invisible Button Front Shirt", choices), null,
    "unverified construction synonyms must not silently choose a real placket");
});

test("negated, optional and conflicting shirt plackets require truthful selection", () => {
  const cases = [
    ["No French Placket", null, ["french_placket"], false],
    ["Without Hidden Placket", null, ["hidden_fly_front"], false],
    ["Do Not Use Covered Placket", null, ["covered_placket"], false],
    ["Hidden Placket Not Allowed", null, ["hidden_fly_front"], false],
    ["Optional French Placket", null, [], false],
    ["French Placket Is Optional", null, [], false],
    ["No French Placket; Hidden Placket", "hidden_fly_front", ["french_placket"], false],
    ["French Placket; Covered Placket", null, [], true],
    ["No French Placket; French Placket", "french_placket", ["french_placket"], true],
    ["No Hidden Placket; Fly-Front Placket", "hidden_fly_front", ["hidden_fly_front"], true],
  ] as const;
  for (const [name, requested, prohibited, ambiguous] of cases) {
    const intent = styleDirectorCandidatePlacketIntent(name);
    assert.equal(intent.requested, requested, name);
    assert.deepEqual(intent.prohibited, [...prohibited], name);
    assert.equal(intent.ambiguous, ambiguous, name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name).map(issue => issue.code),
      ambiguous ? ["ambiguous_candidate_placket"] : [], name);
    const choices = optionsFor("shirt.placket").map(o => o.legacyLabel || o.label);
    assert.equal(styleDirectorCandidatePlacket(name, choices) === null, requested === null || ambiguous, name);
    if (ambiguous) {
      assert.deepEqual(styleDirectorCandidatePlacketIssues(name, { placket: "french_placket" }), [],
        "ambiguity gate must not guess a canonical construction");
    } else if (prohibited.length) {
      for (const forbidden of prohibited) {
        assert.deepEqual(styleDirectorCandidatePlacketIssues(name, { placket: forbidden })
          .map(issue => issue.code), ["candidate_placket_mismatch"], name);
      }
    }
  }
  for (const label of ["Standard Flat-Front Shirt", "French Cuff Shirt", "Covered Pocket Shirt"]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(label),
      { requested: null, prohibited: [], ambiguous: false }, label);
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const namedPlacket = styleDirectorCandidatePlacket(shirt, DESIGNER_STYLE_CHOICES.placket)"));
  assert.ok(agent.includes("const namedPlacket=styleDirectorCandidatePlacket(shirt,DESIGNER_STYLE_CHOICES.placket)"));
  assert.ok(agent.includes("if (namedPlacket) spec.shirt.placket=namedPlacket.versioned;"));
  assert.ok(agent.includes("...styleDirectorCandidatePlacketIssues(candidate.garments.shirt, styleSpec.shirt)"),
    "real recommendation review must validate intended placket against saved ID");
});

test("explicit cuff descriptions map to existing versioned construction and honest legacy photos", () => {
  const photoChoices = optionsFor("shirt.cuff")
    .filter(option => option.legacySelectable !== false)
    .map(option => option.legacyLabel || option.label);
  const cases = [
    ["French Cuff Shirt", "french_double_cuff", "French / Double Cuff"],
    ["French / Double Cuff Shirt", "french_double_cuff", "French / Double Cuff"],
    ["Double Cuff Shirt", "french_double_cuff", "French / Double Cuff"],
    ["Barrel Cuff (1-button) Shirt", "barrel_cuff_1_button", "Barrel Cuff (1-button)"],
    ["1-button Barrel Cuff Shirt", "barrel_cuff_1_button", "Barrel Cuff (1-button)"],
    ["Barrel Cuff (2-button) Shirt", "barrel_cuff_2_button", "Barrel Cuff (2-button)"],
    ["2-button Barrel Cuff Shirt", "barrel_cuff_2_button", "Barrel Cuff (2-button)"],
    ["Convertible Cuff Shirt", "convertible_cuff", "Convertible Cuff"],
    ["Rounded/Soft Cuff Shirt", "rounded_soft_cuff", "Rounded/Soft Cuff"],
    ["Cocktail Cuff Shirt", "cocktail_cuff", null],
    ["Angled Barrel Cuff Shirt", "angled_barrel_cuff", null],
    ["Open Short-Sleeve Hem Shirt", "open_short_hem_cuff", null],
  ] as const;
  for (const [candidate, id, legacy] of cases) {
    assert.ok(optionsFor("shirt.cuff").some(option => option.id === id), candidate);
    assert.deepEqual(styleDirectorCandidateCuff(candidate, photoChoices),
      { versioned: id, legacy }, candidate);
    assert.deepEqual(styleDirectorCandidateWordingIssues(candidate), [], candidate);
    const locked = spec({ cuff: id, ...(id === "open_short_hem_cuff" ? { sleeve: "half_sleeve" } : {}) });
    const snapshot = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateCuffIssues(candidate, locked.shirt), [], candidate);
    assert.deepEqual(styleDirectorCandidateCuffIssues(candidate, {
      cuff: id === "barrel_cuff_1_button" ? "french_double_cuff" : "barrel_cuff_1_button",
    }).map(issue => issue.code), ["candidate_cuff_mismatch"], candidate);
    const presented = {
      ...photo("Spread Collar", "Tucked"), ...(legacy ? { cuff: legacy } : {}),
    };
    const issues = styleDirectorPresentationIssues(presented, locked).map(issue => issue.code);
    if (legacy) assert.deepEqual(issues, [], "supported cuff photo matches its ID: " + candidate);
    else if (id === "open_short_hem_cuff") {
      assert.ok(issues.includes("unverified_short_sleeve_photo"),
        "open short-sleeve finish keeps its existing preview review: " + candidate);
      assert.ok(!issues.includes("unverified_cuff_photo"),
        "avoid duplicate short-sleeve photo warnings");
    } else assert.ok(issues.includes("unverified_cuff_photo"),
      "provisional cuff label cannot imply verified photographic shape: " + candidate);
    assert.equal(JSON.stringify(locked), snapshot, "cuff review must preserve saved construction");
  }
  assert.deepEqual(styleDirectorCandidateCuff("Cocktail Cuff Shirt", []),
    { versioned: "cocktail_cuff", legacy: null });
  assert.deepEqual(styleDirectorCandidateCuff("Barrel Cuff (1-button) Shirt", []),
    { versioned: "barrel_cuff_1_button", legacy: null },
    "an unavailable photo choice must not invent a legacy label");
});

test("forbidden and contradictory named cuffs cannot silently change the locked cuff", () => {
  const cases = [
    ["No French Cuff", null, ["french_double_cuff"], false],
    ["Without Cocktail Cuff", null, ["cocktail_cuff"], false],
    ["Do Not Wear Convertible Cuff", null, ["convertible_cuff"], false],
    ["Barrel Cuff (2-button) Forbidden", null, ["barrel_cuff_2_button"], false],
    ["French Cuff Not Allowed", null, ["french_double_cuff"], false],
    ["Optional French Cuff", null, [], false],
    ["French Cuff Is Optional", null, [], false],
    ["No French Cuff; Cocktail Cuff", "cocktail_cuff", ["french_double_cuff"], false],
    ["French Cuff; Cocktail Cuff", null, [], true],
    ["No French Cuff; French Cuff", "french_double_cuff", ["french_double_cuff"], true],
    ["Barrel Cuff (1-button); Barrel Cuff (2-button)", null, [], true],
  ] as const;
  for (const [candidate, request, prohibited, ambiguous] of cases) {
    const intent = styleDirectorCandidateCuffIntent(candidate);
    assert.equal(intent.requested, request, candidate);
    assert.deepEqual(intent.prohibited, [...prohibited], candidate);
    assert.equal(intent.ambiguous, ambiguous, candidate);
    assert.deepEqual(styleDirectorCandidateWordingIssues(candidate).map(issue => issue.code),
      ambiguous ? ["ambiguous_candidate_cuff"] : [], candidate);
    const named = styleDirectorCandidateCuff(candidate, optionsFor("shirt.cuff").map(x => x.legacyLabel || x.label));
    assert.equal(named === null, request === null || ambiguous, candidate);
    if (ambiguous) {
      assert.deepEqual(styleDirectorCandidateCuffIssues(candidate, { cuff: "french_double_cuff" }), [],
        "contradictory wording is owned by the ambiguity gate");
    } else {
      for (const id of prohibited) {
        assert.deepEqual(styleDirectorCandidateCuffIssues(candidate, { cuff: id })
          .map(issue => issue.code), ["candidate_cuff_mismatch"], candidate);
      }
    }
  }
  for (const label of [
    "French Placket Shirt", "Barrel Buttons Shirt", "Cocktail Evening Shirt",
    "Single Button Cuff Shirt", "Double Button Cuff Shirt",
  ]) {
    assert.deepEqual(styleDirectorCandidateCuffIntent(label),
      { requested: null, prohibited: [], ambiguous: false }, label);
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const namedCuff = styleDirectorCandidateCuff(shirt, DESIGNER_STYLE_CHOICES.cuff)"));
  assert.ok(agent.includes("const namedCuff=styleDirectorCandidateCuff(shirt,DESIGNER_STYLE_CHOICES.cuff)"));
  assert.ok(agent.includes("if (namedCuff?.legacy) style.cuff = namedCuff.legacy"));
  assert.ok(agent.includes("if (namedCuff) spec.shirt.cuff=namedCuff.versioned"));
  assert.ok(agent.includes("...styleDirectorCandidateCuffIssues(candidate.garments.shirt, styleSpec.shirt)"),
    "real-model recommendation must review named cuff against the locked ID");
});

test("named shirt fits resolve to real canonical IDs without fabric or body assumptions", () => {
  const photoChoices = optionsFor("shirt.fit")
    .filter(option => option.legacySelectable !== false)
    .map(option => option.legacyLabel || option.label);
  const cases = [
    ["Slim-Fit Dress Shirt", "slim_fit", "Slim Fit"],
    ["Regular Fit Shirt", "regular_classic_fit", "Regular / Classic Fit"],
    ["Classic-Fit Shirt", "regular_classic_fit", "Regular / Classic Fit"],
    ["Regular / Classic Fit Shirt", "regular_classic_fit", "Regular / Classic Fit"],
    ["Relaxed Fit Shirt", "relaxed_fit", "Relaxed Fit"],
    ["Boxy Fit Shirt", "boxy_oversized", null],
    ["Boxy Oversized Fit Shirt", "boxy_oversized", null],
    ["Oversized Fit Shirt", "boxy_oversized", null],
    ["Athletic Taper Fit Shirt", "athletic_taper", null],
  ] as const;
  for (const [label, id, legacy] of cases) {
    assert.ok(optionsFor("shirt.fit").some(option => option.id === id), id);
    assert.deepEqual(styleDirectorCandidateShirtFit(label, photoChoices),
      { versioned: id, legacy }, label);
    assert.deepEqual(styleDirectorCandidateWordingIssues(label), [], label);
    const locked = spec({ fit: id });
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(label, locked.shirt), [], label);
    assert.deepEqual(styleDirectorCandidateShirtFitIssues(label, {
      fit: id === "slim_fit" ? "regular_classic_fit" : "slim_fit",
    }).map(issue => issue.code), ["candidate_shirt_fit_mismatch"], label);
    const shown = { ...photo("Spread Collar", "Tucked"), ...(legacy ? { shirtFit: legacy } : {}) };
    const issues = styleDirectorPresentationIssues(shown, locked).map(issue => issue.code);
    if (legacy) assert.deepEqual(issues, [], "matching supported photo fit remains unchanged: " + label);
    else assert.ok(issues.includes("unverified_shirt_fit_photo"),
      "a provisional fit is not a photographic or physical fitting signoff: " + label);
    assert.equal(JSON.stringify(locked), before, "never rewrite a saved fit to match a photo");
  }
  assert.deepEqual(styleDirectorCandidateShirtFit("Boxy Fit Shirt", []),
    { versioned: "boxy_oversized", legacy: null });
  assert.deepEqual(styleDirectorCandidateShirtFit("Slim Fit Shirt", []),
    { versioned: "slim_fit", legacy: null }, "no invented selectable photo label");
});

test("negative optional and contradictory shirt-fit wording must fail closed", () => {
  const cases = [
    ["No Slim Fit", null, ["slim_fit"], false],
    ["Without Slim-Fit Shirt", null, ["slim_fit"], false],
    ["Avoid Athletic Taper Fit", null, ["athletic_taper"], false],
    ["Do Not Wear Relaxed Fit Shirt", null, ["relaxed_fit"], false],
    ["Boxy Fit Is Forbidden", null, ["boxy_oversized"], false],
    ["Optional Slim Fit", null, [], false],
    ["Relaxed Fit Is Optional", null, [], false],
    ["No Slim Fit; Regular Fit", "regular_classic_fit", ["slim_fit"], false],
    ["Slim Fit; Relaxed Fit", null, [], true],
    ["No Slim Fit; Slim Fit", "slim_fit", ["slim_fit"], true],
    ["Boxy Fit; Athletic Taper Fit", null, [], true],
  ] as const;
  for (const [label, requested, prohibited, ambiguous] of cases) {
    const intent = styleDirectorCandidateShirtFitIntent(label);
    assert.equal(intent.requested, requested, label);
    assert.deepEqual(intent.prohibited, [...prohibited], label);
    assert.equal(intent.ambiguous, ambiguous, label);
    assert.deepEqual(styleDirectorCandidateWordingIssues(label).map(issue => issue.code),
      ambiguous ? ["ambiguous_candidate_shirt_fit"] : [], label);
    const named = styleDirectorCandidateShirtFit(label,
      optionsFor("shirt.fit").map(option => option.legacyLabel || option.label));
    assert.equal(named === null, requested === null || ambiguous, label);
    if (ambiguous) assert.deepEqual(
      styleDirectorCandidateShirtFitIssues(label, { fit: "slim_fit" }), [],
      "ambiguous fit wording is a separate review; never infer one fit");
    else for (const id of prohibited) assert.deepEqual(
      styleDirectorCandidateShirtFitIssues(label, { fit: id }).map(issue => issue.code),
      ["candidate_shirt_fit_mismatch"], label);
  }
  for (const label of [
    "Regular Shirt", "Relaxed Linen Texture Shirt", "Slim Stripe Shirt",
    "Athletic Sleeve Shirt", "Oversized Print Shirt",
  ]) {
    assert.deepEqual(styleDirectorCandidateShirtFitIntent(label),
      { requested: null, prohibited: [], ambiguous: false }, label);
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const namedFit = styleDirectorCandidateShirtFit(shirt, DESIGNER_STYLE_CHOICES.shirtFit)"));
  assert.ok(agent.includes("const namedFit=styleDirectorCandidateShirtFit(shirt,DESIGNER_STYLE_CHOICES.shirtFit)"));
  assert.ok(agent.includes("if (namedFit?.legacy) style.shirtFit = namedFit.legacy"));
  assert.ok(agent.includes("if (namedFit) spec.shirt.fit=namedFit.versioned"));
  assert.ok(agent.includes("...styleDirectorCandidateShirtFitIssues(candidate.garments.shirt, styleSpec.shirt)"));
});

test("ordinary collar resolver rejects incidental words and contradictory constructions", () => {
  const yes = [
    ["Spread-Collar Dress Shirt", "spread"],
    ["Spread Collar Shirt", "spread"],
    ["Oxford Button-Down Shirt", "button_down"],
    ["Button Down Casual Shirt", "button_down"],
  ] as const;
  for (const [name, expected] of yes) {
    assert.equal(styleDirectorCandidateOrdinaryCollar(name), expected, name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
  }
  for (const name of [
    "Widespread Print Shirt", "Widespread Collar Shirt",
    "Button-Downish Shirt", "Oxford Shirt", "Buttoned Shirt",
    "Spread-Collar Button-Down Shirt", "Cuban Spread-Collar Shirt",
    "Point Collar Spread-Collar Shirt", "Button-Down Band-Collar Shirt",
    "Camp-Collar Resort Shirt", "Cutaway-Collar Dress Shirt",
  ]) {
    assert.equal(styleDirectorCandidateOrdinaryCollar(name), null, name);
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const ordinaryCollar = styleDirectorCandidateOrdinaryCollar(shirt)"));
  assert.ok(agent.includes('if (ordinaryCollar === "spread")'));
  assert.ok(agent.includes('else if (ordinaryCollar === "button_down")'));
  assert.ok(!agent.includes('shirt.includes("spread")'),
    "ordinary collars must never be inferred from substring matches");
  assert.ok(!agent.includes('shirt.includes("button-down")'),
    "button-down construction requires explicit whole-word intent");
});

test("conflicting named collar families fail closed rather than silently selecting a construction", () => {
  for (const name of [
    "Cuban Band-Collar Shirt", "Mandarin Cutaway Shirt", "Camp Cutaway Shirt",
    "Cuban Mandarin Cutaway Shirt", "Spread-Collar Camp-Collar Shirt",
    "Button-Down Band-Collar Shirt", "Spread-Collar Cutaway-Collar Shirt",
    "Button-Down Spread-Collar Shirt", "Point (Standard) Collar Camp-Collar Shirt",
    "Point Collar Band-Collar Shirt", "Club Collar Cutaway Collar Shirt",
    "Wing Collar Cuban Resort Shirt", "Tab Collar Mandarin Shirt",
    "Pin Collar Cuban Shirt", "Club Collar Wing Collar Shirt",
  ]) {
    assert.equal(styleDirectorCandidateCollar(name, selectableCollars), null, name);
  }
  assert.equal(styleDirectorCandidateCollar("Cuban Resort Shirt", selectableCollars)?.versioned, "cuban_camp_collar");
  assert.equal(styleDirectorCandidateCollar("Mandarin Band-Collar Shirt", selectableCollars)?.versioned, "mandarin_band_collar");
});


test("ambiguous collar names never force camp-collar wear without a resolved construction", () => {
  const source = readFileSync("src/lib/designer/style-director-compatibility.ts", "utf8");
  assert.ok(!source.includes("while the\\n  // versioned"), "escaped newline must not comment out the wear resolver");
  for (const name of ["Cuban Band-Collar Shirt", "Camp Cutaway Shirt", "Mandarin Cuban Shirt"]) {
    assert.equal(styleDirectorCandidateCollar(name, selectableCollars), null);
    assert.equal(styleDirectorWearForCandidate("Casual", name, "Tucked"), "Tucked");
    assert.equal(styleDirectorWearForCandidate("Formal", name, "Untucked"), "Tucked");
  }
  assert.equal(styleDirectorWearForCandidate("Casual", "Cuban Resort Shirt", "Tucked"), "Untucked");
  assert.equal(styleDirectorWearForCandidate("Formal", "Mandarin Band-Collar Shirt", "Untucked"), "Tucked");
});

test("conflicting photographic collar labels require review even when one matches locked ID", () => {
  for (const label of ["Cuban Band-Collar", "Camp Cutaway Collar", "Mandarin Cuban Collar"]) {
    for (const collar of ["spread_collar", "cuban_camp_collar", "mandarin_band_collar", "cutaway_collar"] as const) {
      const locked = spec({ collar, wear: "tucked" });
      const before = JSON.stringify(locked);
      const issues = styleDirectorPresentationIssues(photo(label, "Tucked"), locked);
      assert.ok(issues.some(issue => issue.code === "legacy_collar_mismatch"), label + " / " + collar);
      assert.equal(JSON.stringify(locked), before, "photographic ambiguity must not rewrite locked IDs");
    }
  }
  assert.deepEqual(styleDirectorPresentationIssues(
    photo("Mandarin / Band Collar", "Tucked"),
    spec({ type: "band_collar_shirt", collar: "mandarin_band_collar" }),
  ), [], "two aliases from the same collar family remain valid");
});


test("candidate photo selection skips ambiguous collar labels and preserves canonical IDs", () => {
  const choices = ["Cuban Band Collar", "Camp Cutaway Collar", "Mandarin Cutaway Collar",
    "Cuban / Camp Collar", "Mandarin / Band Collar", "Cutaway Collar"];
  assert.deepEqual(styleDirectorCandidateCollar("Cuban Resort Shirt", choices),
    { legacy: "Cuban / Camp Collar", versioned: "cuban_camp_collar" });
  assert.deepEqual(styleDirectorCandidateCollar("Band-Collar Shirt", choices),
    { legacy: "Mandarin / Band Collar", versioned: "mandarin_band_collar" });
  assert.deepEqual(styleDirectorCandidateCollar("Cutaway-Collar Shirt", choices),
    { legacy: "Cutaway Collar", versioned: "cutaway_collar" });
  assert.deepEqual(styleDirectorCandidateCollar("Cuban Resort Shirt", choices.slice(0, 3)),
    { legacy: null, versioned: "cuban_camp_collar" },
    "ambiguous photo choices must not masquerade as verified legacy options");
});


test("advanced collar photo matching excludes ordinary-collar conflicts without changing versioned IDs", () => {
  const ambiguousChoices = [
    "Cuban Point Collar", "Band Club Collar", "Cutaway Wing Collar",
    "Camp / Pin Collar", "Mandarin Tab Collar",
    "Cuban / Camp Collar", "Mandarin / Band Collar", "Cutaway Collar",
  ];
  assert.deepEqual(styleDirectorCandidateCollar("Cuban Resort Shirt", ambiguousChoices), {
    legacy: "Cuban / Camp Collar", versioned: "cuban_camp_collar",
  });
  assert.deepEqual(styleDirectorCandidateCollar("Band-Collar Shirt", ambiguousChoices), {
    legacy: "Mandarin / Band Collar", versioned: "mandarin_band_collar",
  });
  assert.deepEqual(styleDirectorCandidateCollar("Cutaway-Collar Shirt", ambiguousChoices), {
    legacy: "Cutaway Collar", versioned: "cutaway_collar",
  });
  const onlyAmbiguous = ambiguousChoices.slice(0, 5);
  for (const [candidate, versioned] of [
    ["Cuban Resort Shirt", "cuban_camp_collar"],
    ["Band-Collar Shirt", "mandarin_band_collar"],
    ["Cutaway-Collar Shirt", "cutaway_collar"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateCollar(candidate, onlyAmbiguous), {
      legacy: null, versioned,
    }, "unsupported combined photo labels must not certify a locked collar");
  }
});

test("negated sleeve descriptions never select a prohibited construction", () => {
  const negativeCases = [
    ["No Short Sleeves", "full_sleeve", "half_sleeve"],
    ["Without Half-Sleeved Shirt", "full_sleeve", "half_sleeve"],
    ["Do Not Wear Short Sleeves", "full_sleeve", "half_sleeve"],
    ["Avoid Short Sleeves", "full_sleeve", "half_sleeve"],
    ["Short Sleeves Are Forbidden", "full_sleeve", "half_sleeve"],
    ["Long Sleeves Not Allowed", "half_sleeve", "full_sleeve"],
    ["Full Sleeves Must Not Be Worn", "half_sleeve", "full_sleeve"],
    ["Never Full Sleeves", "half_sleeve", "full_sleeve"],
  ] as const;
  for (const [candidate, allowedSleeve, prohibitedSleeve] of negativeCases) {
    assert.equal(styleDirectorCandidateSleeve(candidate), null,
      "negative-only wording cannot create positive half-sleeve construction: " + candidate);
    assert.deepEqual(styleDirectorCandidateWordingIssues(candidate), [], candidate);
    const allowed = spec({ sleeve: allowedSleeve });
    const before = JSON.stringify(allowed);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, allowed.shirt), [], candidate);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(candidate, { sleeve: prohibitedSleeve })
      .map(issue => issue.code), ["candidate_sleeve_mismatch"], candidate);
    assert.equal(JSON.stringify(allowed), before, "sleeve review must not change locked options");
  }
  assert.deepEqual(styleDirectorCandidateSleeve("No Full Sleeves; Short Sleeves"),
    { sleeve: "half_sleeve", cuff: "open_short_hem_cuff" },
    "prohibiting long sleeves must not cancel an explicit short-sleeve request");
  assert.deepEqual(styleDirectorCandidateSleeveIssues("No Full Sleeves; Short Sleeves",
    { sleeve: "half_sleeve" }), []);
  assert.deepEqual(styleDirectorCandidateSleeveIssues("No Short Sleeves; Long Sleeves",
    { sleeve: "full_sleeve" }), []);
  for (const contradiction of [
    "No Short Sleeves; Short Sleeves Required",
    "Full Sleeves Forbidden; Full Sleeves Requested",
    "No Short Sleeves; No Long Sleeves",
    "Short Sleeves and Long Sleeves",
  ]) {
    assert.deepEqual(styleDirectorCandidateWordingIssues(contradiction).map(issue => issue.code),
      ["ambiguous_candidate_sleeve"], contradiction);
    assert.equal(styleDirectorCandidateSleeve(contradiction), null);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(contradiction, { sleeve: "full_sleeve" }), [],
      "contradictions must be handled by the ambiguity gate without silently choosing a sleeve");
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("...styleDirectorCandidateSleeveIssues(candidate.garments.shirt, styleSpec.shirt)"),
    "actual model recommendations must enforce sleeve prohibitions against versioned IDs");
});

test("contradictory sleeve length descriptions do not select a half-sleeve construction", () => {
  for (const label of [
    "Short-Sleeve Long-Sleeve Shirt",
    "Half Sleeve Full Sleeve Shirt",
    "Long Sleeved Short Sleeved Resort Shirt",
  ]) {
    assert.equal(styleDirectorCandidateSleeve(label), null, label);
  }
  assert.deepEqual(styleDirectorCandidateSleeve("Short-Sleeve Resort Shirt"),
    { sleeve: "half_sleeve", cuff: "open_short_hem_cuff" });
  assert.equal(styleDirectorCandidateSleeve("Full-Sleeve Shirt"), null);
});

test("explicit candidate tuck intent controls wear without silently rewriting a camp collar", () => {
  assert.equal(styleDirectorWearForCandidate("Formal", "Untucked Oxford Shirt", "Tucked"), "Untucked");
  assert.equal(styleDirectorWearForCandidate("Casual", "Tucked Dress Shirt", "Untucked"), "Tucked");
  assert.equal(styleDirectorWearForCandidate("Formal", "Tucked / Untucked Dress Shirt", "Untucked"), "Tucked",
    "ambiguous wear retains the established occasion default and triggers review");
  assert.equal(styleDirectorWearForCandidate("Casual", "Camp Collar Tucked Shirt", "Tucked"), "Untucked",
    "camp resort construction cannot be silently changed to tucked wear");
  assert.equal(styleDirectorWearForCandidate("Casual", "Untucked Oxford Shirt", "Tucked"), "Untucked",
    "an untucked word must not accidentally count as a tucked word");
});

test("proposed explicit tucked and untucked intent is validated against locked IDs", () => {
  for (const [candidate, lockedWear, expected] of [
    ["Untucked Dress Shirt", "untucked", []],
    ["Tucked Dress Shirt", "tucked", []],
    ["Dress Shirt", "tucked", []],
    ["Tuckable Dress Shirt", "untucked", []],
    ["Untucked Dress Shirt", "tucked", ["candidate_shirt_wear_mismatch"]],
    ["Tucked Dress Shirt", "untucked", ["candidate_shirt_wear_mismatch"]],
    ["Camp Collar Tucked Shirt", "untucked", ["candidate_shirt_wear_mismatch"]],
  ] as const) {
    const locked = spec({ wear: lockedWear });
    const before = JSON.stringify(locked);
    const issues = styleDirectorCandidateWearIssues(candidate, locked.shirt);
    assert.deepEqual(issues.map(x => x.code), expected, candidate);
    assert.deepEqual(issues, styleDirectorCandidateWearIssues(candidate, locked.shirt),
      "wear validation must be deterministic");
    assert.equal(JSON.stringify(locked), before, "candidate review may not rewrite locked wear");
  }
  for (const candidate of ["Tucked and Untucked Dress Shirt", "Untucked/Tucked Oxford Shirt"]) {
    assert.deepEqual(styleDirectorCandidateWordingIssues(candidate).map(x => x.code),
      ["ambiguous_candidate_wear"], candidate);
    assert.deepEqual(styleDirectorCandidateWearIssues(candidate, { wear: "tucked" }).map(x => x.code),
      ["candidate_shirt_wear_mismatch"],
      "conflicting construction instructions must block tailoring approval");
  }
  assert.deepEqual(styleDirectorCandidateWordingIssues("Untucked Oxford Shirt"), []);
  assert.deepEqual(styleDirectorCandidateWordingIssues("Tucked Dress Shirt"), []);
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("...styleDirectorCandidateWearIssues(candidate.garments.shirt, styleSpec.shirt)"),
    "worded tuck instructions must reach actual locked recommendation review");
});

test("negated shirt-tuck instructions cannot silently select the opposite wear", () => {
  const cases = [
    ["Not Tucked Shirt", "untucked"],
    ["Never Tucked Shirt", "untucked"],
    ["Avoid Tucked Shirt", "untucked"],
    ["Do Not Tuck Shirt", "untucked"],
    ["Don't Tuck Shirt", "untucked"],
    ["No Tuck Shirt", "untucked"],
    ["Not Untucked Shirt", "tucked"],
    ["Avoid Untucked Shirt", "tucked"],
    ["Not Tucked and Untucked Shirt", "untucked"],
  ] as const;
  for (const [name, desired] of cases) {
    const proposed = styleDirectorWearForCandidate("Smart-Casual", name,
      desired === "tucked" ? "Untucked" : "Tucked");
    assert.equal(proposed.toLowerCase(), desired, name);
    assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
    const selected = spec({ wear: desired });
    const snapshot = JSON.stringify(selected);
    assert.deepEqual(styleDirectorCandidateWearIssues(name, selected.shirt), [], name);
    const opposite = desired === "tucked" ? "untucked" : "tucked";
    assert.deepEqual(styleDirectorCandidateWearIssues(name, { wear: opposite })
      .map(issue => issue.code), ["candidate_shirt_wear_mismatch"], name);
    assert.equal(JSON.stringify(selected), snapshot, "negated wear parsing cannot rewrite saved IDs");
  }
  for (const phrase of [
    "Not Tucked but Tucked Shirt",
    "Do Not Tuck and Tucked Shirt",
    "Not Untucked and Untucked Shirt",
  ]) {
    assert.deepEqual(styleDirectorCandidateWordingIssues(phrase).map(issue => issue.code),
      ["ambiguous_candidate_wear"], phrase);
    assert.deepEqual(styleDirectorCandidateWearIssues(phrase, { wear: "tucked" }).map(x => x.code),
      ["candidate_shirt_wear_mismatch"],
      "mixed negated/affirmative requests must block tailoring approval");
  }
});

test("ambiguous candidate descriptions force an explicit recommendation review", () => {
  const cases: Array<[string, string[]]> = [
    ["Cuban Band-Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Mandarin Cutaway Shirt", ["ambiguous_candidate_collar"]],
    ["Spread-Collar Camp-Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Button-Down Band-Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Spread-Collar Cutaway-Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Button-Down Spread-Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Point (Standard) Collar Camp-Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Point Collar Band-Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Club Collar Cutaway Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Wing Collar Cuban Resort Shirt", ["ambiguous_candidate_collar"]],
    ["Tab Collar Mandarin Shirt", ["ambiguous_candidate_collar"]],
    ["Pin Collar Cuban Shirt", ["ambiguous_candidate_collar"]],
    ["Club Collar Wing Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Half Sleeve Full Sleeve Shirt", ["ambiguous_candidate_sleeve"]],
    ["Cuban Cutaway Short-Sleeve Full-Sleeve Shirt",
      ["ambiguous_candidate_collar", "ambiguous_candidate_sleeve"]],
  ];
  for (const [name, expected] of cases) {
    const first = styleDirectorCandidateWordingIssues(name);
    assert.deepEqual(first.map(issue => issue.code), expected, name);
    assert.deepEqual(first, styleDirectorCandidateWordingIssues(name), "review must be deterministic");
  }
  for (const name of [
    "Cuban Resort Shirt", "Mandarin Band-Collar Shirt", "Cutaway-Collar Dress Shirt",
    "Spread-Collar Dress Shirt", "Oxford Button-Down Shirt",
    "Point (Standard) Collar Shirt", "Club Collar Shirt",
    "Wing Collar Shirt", "Tab Collar Shirt", "Pin Collar Shirt",
    "Short-Sleeve Camp-Collar Shirt", "Full Sleeve Dress Shirt",
    "Campus Office Shirt", "Bandwidth Print Shirt", "Sleevelet Shirt",
  ]) assert.deepEqual(styleDirectorCandidateWordingIssues(name), [], name);
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("...styleDirectorCandidateWordingIssues(candidate.garments.shirt, candidate.garments.trouser)"),
    "ambiguous names must affect final recommendation review status");
  assert.ok(agent.includes('status: constructionIssues.length ? "needs_review" : best.status'));
});

test("exact photographic collar IDs match versioned construction for ordinary collars", () => {
  const ordinary = [
    ["Spread Collar", "spread_collar"],
    ["Point (Standard) Collar", "point_standard_collar"],
    ["Button-Down Collar", "button_down_collar"],
    ["Club Collar", "club_collar"],
  ] as const;
  for (const [label, id] of ordinary) {
    const correct = spec({ collar: id });
    assert.deepEqual(styleDirectorPresentationIssues(photo(label, "Tucked"), correct), [],
      label + " must not be falsely flagged when canonical IDs match");
    const mismatched = spec({ collar: id === "spread_collar"
      ? "point_standard_collar" : "spread_collar" });
    const previous = JSON.stringify(mismatched);
    assert.deepEqual(styleDirectorPresentationIssues(photo(label, "Tucked"), mismatched)
      .map(issue => issue.code), ["legacy_collar_mismatch"], label);
    assert.equal(JSON.stringify(mismatched), previous,
      "photo parity review must not rewrite saved construction IDs");
  }
  assert.deepEqual(styleDirectorPresentationIssues(
    photo("Spread Collar", "Tucked"), spec({collar:"cuban_camp_collar"}),
  ).map(issue => issue.code), ["legacy_collar_mismatch", "unverified_camp_photo"]);
  assert.deepEqual(styleDirectorPresentationIssues(
    photo("Point (Standard) Collar", "Tucked"), spec({collar:"cutaway_collar"}),
  ).map(issue => issue.code), ["legacy_collar_mismatch", "unverified_cutaway_photo"]);
});

test("photographic trouser selection and versioned trouser type must agree", () => {
  const examples = [
    ["Formal Trouser (Flat-front)", "formal_flat_front"],
    ["Pleated Trouser", "pleated_trouser"],
    ["Wide-leg / Relaxed Drape Trouser", "wide_leg_relaxed_drape"],
  ] as const;
  for (const [label, id] of examples) {
    assert.ok(optionsFor("pant.type").some(option => option.id === id &&
      option.legacySelectable !== false && option.legacyLabel === label),
      "use only actual selectable legacy trouser options");
    const photographic = { ...photo("Spread Collar", "Tucked"), trouser: label };
    const valid = spec({}, {type:id});
    assert.deepEqual(styleDirectorPresentationIssues(photographic, valid), [],
      label + " must match its canonical versioned trouser ID");
    const mismatched = spec({}, {type:id === "formal_flat_front"
      ? "pleated_trouser" : "formal_flat_front"});
    const original = JSON.stringify(mismatched);
    assert.deepEqual(styleDirectorPresentationIssues(photographic, mismatched)
      .map(issue => issue.code), ["legacy_trouser_mismatch"], label);
    assert.equal(JSON.stringify(mismatched), original,
      "review must not rewrite a saved trouser specification");
  }
  assert.deepEqual(styleDirectorPresentationIssues({
    ...photo("Spread Collar", "Tucked"), trouser: "Not a catalogue trouser",
  }, spec()).map(issue => issue.code), ["legacy_trouser_mismatch"],
  "unsupported photographic trouser labels cannot silently pass parity review");
  assert.deepEqual(styleDirectorPresentationIssues(photo("Spread Collar", "Tucked"), spec()), [],
    "older isolated shirt-only callers remain nonmutating and supported");
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("styleDirectorPresentationIssues(best.style,styleSpec)"),
    "full Style Director recommendation must run trouser/photo parity");
});

test("conflicting flat-front and pleat candidate descriptions force explicit review", () => {
  const candidates = [
    "Flat-Front Pleated Trouser",
    "Flat Front Single-Pleat Tailored Trouser",
    "Flat-Front Double Pleats",
  ];
  for (const candidate of candidates) {
    const first = styleDirectorCandidateWordingIssues("Spread-Collar Dress Shirt", candidate);
    assert.deepEqual(first.map(issue => issue.code), ["ambiguous_candidate_trouser_front"], candidate);
    assert.deepEqual(first,
      styleDirectorCandidateWordingIssues("Spread-Collar Dress Shirt", candidate),
      "candidate review must be deterministic");
  }
  for (const candidate of [
    "Flat-Front Tailored Trouser", "Single-Pleat Tailored Trouser",
    "Wide-Leg Pleated Trouser", "Flat Front Non-Pleated Trouser",
    "Flat-front no pleats", "Flat-front without pleats", "Pleatless Flat Front",
  ]) {
    assert.deepEqual(styleDirectorCandidateWordingIssues("Spread-Collar Dress Shirt", candidate), [],
      candidate + " must not be considered contradictory");
  }
  const both = styleDirectorCandidateWordingIssues(
    "Cuban Cutaway Short-Sleeve Full-Sleeve Shirt", "Flat-Front Pleated Trouser",
  );
  assert.deepEqual(both.map(issue => issue.code), [
    "ambiguous_candidate_collar",
    "ambiguous_candidate_sleeve",
    "ambiguous_candidate_trouser_front",
  ], "independent construction conflicts must accumulate without rewriting selected options");
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes(
    "...styleDirectorCandidateWordingIssues(candidate.garments.shirt, candidate.garments.trouser)",
  ), "shirt and trouser wording must both flow to the final recommendation review");
  assert.ok(agent.includes('status: constructionIssues.length ? "needs_review" : best.status'));
});

test("flat-front negated pleats with qualifiers do not create false construction conflicts", () => {
  for (const candidate of [
    "Flat-front without any pleats",
    "Flat Front without visible pleats",
    "Flat-front no visible pleats",
    "Flat-front without pleats",
  ]) {
    const before = candidate;
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", candidate), [], candidate);
    assert.equal(candidate, before, "wording review must not rewrite descriptions");
  }
  for (const candidate of [
    "Flat-front without any pleats but add single pleat",
    "Flat-front no visible pleats with double pleats",
  ]) {
    assert.deepEqual(
      styleDirectorCandidateWordingIssues("Dress Shirt", candidate).map(issue => issue.code),
      ["ambiguous_candidate_trouser_front"],
      "an explicit positive pleat request must still require review",
    );
  }
});

test("trouser-front intent is shared by photo and versioned selectors", () => {
  const examples: ReadonlyArray<readonly [string, ReturnType<typeof styleDirectorCandidateTrouserFront>]> = [
    ["Flat-Front Tailored Trouser", "flat_front"],
    ["Flat Front Non-Pleated Trouser", "flat_front"],
    ["Flat-front without any pleats", "flat_front"],
    ["Flat Front without visible pleats", "flat_front"],
    ["Flat-front no visible pleats", "flat_front"],
    ["Flat-front pleatless", "flat_front"],
    ["No Pleats Trouser", "flat_front"],
    ["Non-Pleated Trouser", "flat_front"],
    ["Unpleated Trouser", "flat_front"],
    ["Pleat-Free Trouser", "flat_front"],
    ["Pleatless Wide-Leg Trouser", "flat_front"],
    ["Without Any Pleats Trouser", "flat_front"],
    ["Zero Pleats Trouser", "flat_front"],
    ["No Pleats but Add a Single Pleat Trouser", "ambiguous"],
    ["Pleat-Free Trouser with Double Pleats", "ambiguous"],
    ["Single-Pleat Tailored Trouser", "pleated"],
    ["Tailored Pleated Trouser", "pleated"],
    ["Wide-Leg Double Pleats", "pleated"],
    ["Flat-Front Single-Pleat Trouser", "ambiguous"],
    ["Flat-front without pleats but add a pleat", "ambiguous"],
    ["Wide-Leg Trouser", null],
    ["Tailored Drawstring Trouser", null],
  ];
  for (const [label, expected] of examples) {
    assert.equal(styleDirectorCandidateTrouserFront(label), expected, label);
    const review = styleDirectorCandidateWordingIssues("Spread-Collar Dress Shirt", label)
      .map(issue => issue.code);
    assert.deepEqual(review, expected === "ambiguous" ? ["ambiguous_candidate_trouser_front"] : [], label);
    assert.equal(styleDirectorCandidateTrouserFront(label), expected,
      "wording classification must be stable for the same candidate");
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("const trouserFront = styleDirectorCandidateTrouserFront(trouser);"),
    "photographic recipe must use the same candidate front interpreter");
  assert.ok(agent.includes("const trouserFront=styleDirectorCandidateTrouserFront(trouser);"),
    "versioned recipe must use the same candidate front interpreter");
  assert.ok(agent.includes('trouserFront === "pleated"') &&
    agent.includes('trouserFront === "flat_front"') &&
    agent.includes('trouserFront==="pleated"') &&
    agent.includes('trouserFront==="flat_front"'),
    "neither recipe may regress to treating non-pleated as positive pleats");
});


test("photographic shirt construction details match exact selectable versioned options", () => {
  const cases = [
    { photo: "cuff", group: "shirt.cuff", id: "cuff", code: "legacy_cuff_mismatch" },
    { photo: "placket", group: "shirt.placket", id: "placket", code: "legacy_placket_mismatch" },
    { photo: "shirtFit", group: "shirt.fit", id: "fit", code: "legacy_shirt_fit_mismatch" },
  ] as const;
  for (const entry of cases) {
    const selectable = optionsFor(entry.group)
      .filter(option => option.legacySelectable !== false && Boolean(option.legacyLabel || option.label));
    assert.ok(selectable.length >= 2, entry.group + " needs two real selectable options");
    const [first, second] = selectable;
    const legacyLabel = first.legacyLabel || first.label;
    const photographic = { ...photo("Spread Collar", "Tucked"), [entry.photo]: legacyLabel };
    const matching = spec({ [entry.id]: first.id });
    assert.deepEqual(styleDirectorPresentationIssues(photographic, matching), [],
      entry.group + " matching photographic and versioned IDs must not be flagged");
    const mismatched = spec({ [entry.id]: second.id });
    const before = JSON.stringify(mismatched);
    assert.deepEqual(styleDirectorPresentationIssues(photographic, mismatched)
      .map(issue => issue.code), [entry.code],
      entry.group + " must not silently certify a different construction ID");
    assert.equal(JSON.stringify(mismatched), before, "no locked design rewrite");
    const unknown = { ...photographic, [entry.photo]: "Not a selectable photo option" };
    assert.deepEqual(styleDirectorPresentationIssues(unknown, matching)
      .map(issue => issue.code), [entry.code],
      entry.group + " unsupported photo label requires review");
  }
  const shirtOnly = photo("Spread Collar", "Tucked");
  assert.deepEqual(styleDirectorPresentationIssues(shirtOnly, spec()), [],
    "existing shirt-only pure callers without extra photo details stay compatible");
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes("...styleDirectorPresentationIssues(best.style,styleSpec)"),
    "real recommendation must evaluate the complete photo style and versioned spec");
});


test("candidate pleat instructions cannot silently disappear from the versioned trouser", () => {
  const cases: ReadonlyArray<readonly [string, string, string[]]> = [
    ["Wide-Leg Pleated Trouser", "flat_front", ["candidate_trouser_pleat_mismatch"]],
    ["Wide-Leg Double Pleats", "flat_front", ["candidate_trouser_pleat_mismatch"]],
    ["Single-Pleat Tailored Trouser", "flat_front", ["candidate_trouser_pleat_mismatch"]],
    ["Flat-Front Tailored Trouser", "single_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Flat Front Non-Pleated Trouser", "single_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["No Pleats Trouser", "single_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Unpleated Trouser", "double_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Without Any Pleats Trouser", "flat_front", []],
    ["Pleat-Free Trouser", "flat_front", []],
    ["Zero Pleats Trouser", "flat_front", []],
    ["Wide-Leg Pleated Trouser", "single_pleat_forward", []],
    ["Single-Pleat Tailored Trouser", "single_pleat_forward", []],
    ["Flat Front Non-Pleated Trouser", "flat_front", []],
    ["Wide-Leg Trouser", "flat_front", []],
    ["Drawstring Linen Trouser", "flat_front", []],
  ];
  for (const [candidate, pleat, expected] of cases) {
    const versioned = spec({}, { pleat });
    const before = JSON.stringify(versioned);
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(candidate, versioned.pant).map(x => x.code),
      expected, candidate + " with " + pleat,
    );
    assert.equal(JSON.stringify(versioned), before, "the checker must not rewrite locked specs");
  }
  assert.deepEqual(
    styleDirectorCandidateWordingIssues("Spread-Collar Dress Shirt", "Flat-Front Pleated Trouser")
      .map(x => x.code),
    ["ambiguous_candidate_trouser_front"],
    "ambiguous instructions are independently routed for explicit review",
  );
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes(
    "...styleDirectorCandidateFrontConstructionIssues(candidate.garments.trouser, styleSpec.pant)",
  ), "actual recommendations must check candidate/front construction parity");
  assert.ok(agent.includes('status: constructionIssues.length ? "needs_review" : best.status'),
    "conflicting requested front construction must not be approved");
});


test("explicit single and double pleat counts cannot silently mismatch the canonical pant specification", () => {
  // Each identifier comes from the existing pant.pleat catalogue; tests
  // should never assert imaginary tailoring options or rewrite the spec.
  const cases: ReadonlyArray<readonly [string, string, string[]]> = [
    ["Double Pleats Trouser", "single_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Wide-Leg Double Pleats", "single_pleat_reverse", ["candidate_trouser_pleat_mismatch"]],
    ["Wide-Leg Double Pleats", "double_pleat_forward", []],
    ["Two Pleats Trouser", "double_pleat_reverse", []],
    ["Two Pleats Trouser", "single_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Single-Pleat Tailored Trouser", "double_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Single-Pleat Tailored Trouser", "single_pleat_reverse", []],
    ["One Pleat Trouser", "single_pleat_forward", []],
    ["Single and Double Pleats Trouser", "single_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Pleated Trouser", "single_pleat_forward", []],
    ["Pleated Trouser", "double_pleat_forward", []],
    ["Flat-Front Non-Pleated Trouser", "flat_front", []],
  ];
  for (const [label, id, expected] of cases) {
    assert.ok(optionsFor("pant.pleat").some(option => option.id === id),
      "only canonical pant pleat options may be used");
    const versioned = spec({}, { pleat: id });
    const before = JSON.stringify(versioned);
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(label, versioned.pant).map(issue => issue.code),
      expected,
      label + " with " + id,
    );
    assert.equal(JSON.stringify(versioned), before, "pleat review never rewrites a locked construction");
  }
  const agent = readFileSync("src/lib/style-director-agent.ts", "utf8");
  assert.ok(agent.includes(
    "...styleDirectorCandidateFrontConstructionIssues(candidate.garments.trouser, styleSpec.pant)"
  ), "real recommendations must carry pleat-count review through their production bridge");
});

test("negated front and side pleats never become positive pleat instructions", () => {
  for (const label of [
    "Flat-Front Trouser with no front pleats",
    "Flat-Front Trouser without side pleats",
    "Flat-Front Trouser with no visible pleats",
    "Flat-Front Trouser without any pleats",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), "flat_front", label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, spec({}, {
      pleat: "flat_front",
    }).pant), [], label);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", label), [], label);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Flat-Front Trouser with two pleats"), "ambiguous");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Double Pleats Trouser", spec({}, { pleat: "single_pleat_forward" }).pant,
  ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
});


test("forward and reverse pleat intent must match the versioned tailoring direction", () => {
  // Direction is source data on the already-canonical pant.pleat option.
  // A photographic "Pleated Trouser" label alone does not convey direction.
  const cases: ReadonlyArray<readonly [string, string, string[]]> = [
    ["Single Reverse Pleat Trouser", "single_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Single Reverse Pleat Trouser", "single_pleat_reverse", []],
    ["Single Forward Pleat Trouser", "single_pleat_forward", []],
    ["Single Forward Pleat Trouser", "single_pleat_reverse", ["candidate_trouser_pleat_mismatch"]],
    ["Double Reverse Pleats Trouser", "double_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Double Reverse Pleats Trouser", "double_pleat_reverse", []],
    ["Double Forward Pleats Trouser", "double_pleat_forward", []],
    ["Double Forward Pleats Trouser", "double_pleat_reverse", ["candidate_trouser_pleat_mismatch"]],
    ["Forward and Reverse Pleats Trouser", "single_pleat_forward", ["candidate_trouser_pleat_mismatch"]],
    ["Pleated Trouser", "single_pleat_forward", []],
    ["Pleated Trouser", "single_pleat_reverse", []],
    ["No Pleats Trouser", "flat_front", []],
  ];
  for (const [candidate, id, expected] of cases) {
    const option = optionsFor("pant.pleat").find(item => item.id === id);
    assert.ok(option, "pleat IDs must belong to the actual catalogue");
    const versioned = spec({}, { pleat: id });
    const before = JSON.stringify(versioned);
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(candidate, versioned.pant).map(issue => issue.code),
      expected, candidate + " with " + id,
    );
    assert.equal(JSON.stringify(versioned), before, "direction checks never change a locked design");
  }
});


test("photographic trouser rise, waistband and break must match versioned selection", () => {
  const cases = [
    { photo: "rise", group: "pant.rise", id: "rise", code: "legacy_rise_mismatch" },
    { photo: "waistband", group: "pant.waistband", id: "waistband", code: "legacy_waistband_mismatch" },
    { photo: "break", group: "pant.break", id: "break", code: "legacy_break_mismatch" },
  ] as const;
  for (const entry of cases) {
    const options = optionsFor(entry.group).filter(
      option => option.legacySelectable !== false && Boolean(option.legacyLabel || option.label),
    );
    assert.ok(options.length >= 2, entry.group + " requires distinct catalogued options");
    const [first, second] = options;
    const photoLabel = first.legacyLabel || first.label;
    const photographic = { ...photo("Spread Collar", "Tucked"), [entry.photo]: photoLabel };
    const matching = spec({}, { [entry.id]: first.id });
    assert.deepEqual(styleDirectorPresentationIssues(photographic, matching), [],
      entry.group + " matching photographic and saved option IDs are compatible");
    const mismatched = spec({}, { [entry.id]: second.id });
    const before = JSON.stringify(mismatched);
    assert.deepEqual(
      styleDirectorPresentationIssues(photographic, mismatched).map(issue => issue.code),
      [entry.code], entry.group + " mismatched saved construction must require review",
    );
    assert.equal(JSON.stringify(mismatched), before, "review must not mutate locked pant details");
    assert.deepEqual(
      styleDirectorPresentationIssues(
        { ...photographic, [entry.photo]: "Not a selectable pant option" }, matching,
      ).map(issue => issue.code),
      [entry.code], entry.group + " unknown photographic labels must fail closed",
    );
  }
  assert.deepEqual(styleDirectorPresentationIssues(
    photo("Spread Collar", "Tucked"), spec(),
  ), [], "shirt-only existing callers may omit trouser-photo details");
  assert.ok(readFileSync("src/lib/style-director-agent.ts", "utf8").includes(
    "...styleDirectorPresentationIssues(best.style,styleSpec)",
  ), "real Style Director recommendations must evaluate the full photographic-to-versioned gate");
});

test("qualified negative pleat descriptions do not fabricate positive pleats", () => {
  for (const label of [
    "Flat-Front Trouser without any front pleats",
    "Trouser with no visible side pleats",
    "Trouser without any visible front pleats",
    "Trouser with zero front pleats",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), "flat_front", label);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", label), [], label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
      label, spec({}, { pleat: "flat_front" }).pant,
    ), [], label);
  }
});


test("front-facing and side-facing pleat negations do not request positive pleats", () => {
  for (const label of [
    "Flat-Front Trouser without front-facing pleats",
    "Trouser with no side-facing pleats",
    "Trouser without any visible front-facing pleats",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), "flat_front", label);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", label), [], label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, {pleat:"flat_front"}), [], label);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Flat-Front with front-facing pleats"), "ambiguous");
  assert.equal(styleDirectorCandidateTrouserFront("Trouser with side-facing pleats"), "pleated");
});


test("negating a specific pleat count does not invent positive pleats or a flat front", () => {
  for (const label of ["No Double Pleats Trouser", "Without Single Pleats Trouser", "No Two Pleats Trouser", "No visible double pleats", "Without any visible single pleat", "No front double pleats"]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), null, label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, { pleat: "flat_front" }), [], label);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Flat-Front Trouser without double pleats"), "flat_front");
  assert.equal(styleDirectorCandidateTrouserFront("No double pleats, add a single pleat"), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront("No double pleats but two pleats"), "pleated");
});

test("negated pleat count cannot masquerade as a requested pleat count", () => {
  const selected = spec({}, { pleat: "single_pleat_forward" });
  assert.ok(optionsFor("pant.pleat").some(option => option.id === selected.pant.pleat),
    "the test must use a canonical pleat option with declared construction parameters");
  const label = "No double pleats, single pleat trouser";
  assert.equal(styleDirectorCandidateTrouserFront(label), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, selected.pant), [],
    "rejecting double pleats is compatible with requesting a single pleat");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "No single pleats, double pleat trouser", selected.pant,
  ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
});


test("negated directional pleat counts do not become requested construction", () => {
  for (const label of [
    "No front-facing double pleats",
    "Without any side-facing single pleat",
    "No visible front-facing two pleats",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), null, label);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", label), [], label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, { pleat: "flat_front" }), [], label);
  }
  assert.equal(styleDirectorCandidateTrouserFront(
    "No front-facing double pleats, single pleat trouser",
  ), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "No front-facing double pleats, single pleat trouser",
    { pleat: "single_pleat_forward" },
  ), []);
  assert.equal(styleDirectorCandidateTrouserFront(
    "Flat-front trouser with front-facing double pleats",
  ), "ambiguous");
});


test("explicit not-pleated candidate wording remains flat-front intent", () => {
  for (const label of ["Not Pleated Trouser", "Flat Front Not Pleated Trouser"]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), "flat_front");
    assert.deepEqual(styleDirectorCandidateWordingIssues("", label), []);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Not Pleated, Single Pleat Trouser"), "ambiguous");
  assert.equal(styleDirectorCandidateTrouserFront("Pleated Trouser"), "pleated");
});

test("negated pleated adjectives do not request an excluded pleat count", () => {
  for (const label of [
    "Not Double Pleated Trouser",
    "No Single Pleated Trouser",
    "Without any visible double-pleated front",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), null, label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
      label, { pleat: "flat_front" },
    ), [], label);
  }
  assert.equal(styleDirectorCandidateTrouserFront(
    "Not Double Pleated, Single Pleat Trouser",
  ), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Not Double Pleated, Single Pleat Trouser",
    { pleat: "single_pleat_forward" },
  ), []);
  assert.equal(styleDirectorCandidateTrouserFront(
    "Flat Front, Double Pleated Trouser",
  ), "ambiguous");
});


test("negated pleating wording is flat-front intent, not a positive pleat request", () => {
  for (const wording of [
    "No pleating trouser",
    "Without pleating trouser",
    "Without any visible pleating trouser",
    "Zero front pleating trouser",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", wording), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Front pleating trouser"), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront("No pleating with single pleat trouser"), "ambiguous");
  assert.equal(styleDirectorCandidateTrouserFront("No double pleating trouser"), null,
    "negating a specific pleat count is not permission to claim flat-front construction");
});

test("negated pleated adjective with an article cannot create a pleat request", () => {
  for (const label of ["Not a Pleated Trouser", "Flat Front, Not a Pleated Trouser"]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), "flat_front", label);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", label), [], label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, { pleat: "flat_front" }), [], label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, { pleat: "single_pleat_forward" })
      .map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], label);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Not a Pleated Trouser, Single Pleat Requested"), "ambiguous");
  assert.equal(styleDirectorCandidateTrouserFront("Not Double Pleated Trouser"), null,
    "count-specific negation must not be promoted to flat-front");
});


test("avoid and never pleat wording is not a positive pleat request", () => {
  for (const name of ["Avoid pleats trouser", "Never pleated trouser", "Avoid any visible pleating"]) {
    assert.equal(styleDirectorCandidateTrouserFront(name), "flat_front", name);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(name, { pleat: "flat_front" }), [], name);
  }
  for (const name of ["Avoid double pleats, single pleat trouser", "Never double pleats, single pleat trouser"]) {
    assert.equal(styleDirectorCandidateTrouserFront(name), "pleated", name);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(name, { pleat: "single_pleat_forward" }), [], name);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Avoid pleats, single pleat trouser"), "ambiguous");
  assert.equal(styleDirectorCandidateTrouserFront("Double pleated trouser"), "pleated");
});


test("imperative do-not-pleat instructions cannot become positive pleats", () => {
  for (const wording of [
    "Do not pleat trouser",
    "Don't pleat trouser",
    "Don’t pleat trouser",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "single_pleat_forward" })
      .map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Do not double pleat, single pleat trouser"), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront("Do not double pleat trouser"), null);
  assert.equal(styleDirectorCandidateTrouserFront("Don't pleat, single pleat trouser"), "ambiguous");
});

test("imperative do-not with count-qualified pleats remains a negation", () => {
  for (const label of [
    "Do not double pleats trouser",
    "Do not single pleats trouser",
    "Do not any visible double pleats trouser",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), null, label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, { pleat: "flat_front" }), [], label);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", label), [], label);
  }
  const positive = "Do not double pleats, single pleat trouser";
  assert.equal(styleDirectorCandidateTrouserFront(positive), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    positive, { pleat: "single_pleat_forward" },
  ), []);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    positive, { pleat: "double_pleat_forward" },
  ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
});

test("explicit do-not-use pleat instructions are not positive pleat requests", () => {
  for (const wording of [
    "Do not use pleats",
    "Don't add pleats",
    "Never include pleating",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), []);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Do not use double pleats, single pleat trouser"), "pleated");
});

test("article-qualified negative pleats remain flat-front without losing positive alternatives", () => {
  for (const label of ["Without a pleat trouser", "No a pleat trouser", "Avoid a visible pleat trouser"]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), "flat_front", label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, { pleat: "flat_front" }), []);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, { pleat: "single_pleat_forward" })
      .map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Without a pleat, single pleat trouser"), "ambiguous");
  assert.equal(styleDirectorCandidateTrouserFront("A single pleat trouser"), "pleated");
});


test("article-qualified negative pleat counts never become positive construction", () => {
  for (const label of [
    "Trouser without a single pleat",
    "Trouser without any single pleat",
    "Trouser without a double pleat",
    "Trouser with no a single pleat",
  ]) {
    assert.notEqual(styleDirectorCandidateTrouserFront(label), "pleated", label);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", label), [], label);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(label, { pleat: "flat_front" }), [], label);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Without a double pleat, single pleat trouser"), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Without a double pleat, single pleat trouser",
    { pleat: "single_pleat_forward" },
  ), []);
});


test("postposed pleat prohibitions are flat-front intent, never positive pleat requests", () => {
  for (const candidate of ["Pleats prohibited", "Pleats are not allowed", "Pleating forbidden", "Pleats not permitted"]) {
    // The parser must not convert an explicit prohibition into a pleated construction.
    assert.equal(styleDirectorCandidateTrouserFront(candidate), "flat_front", candidate);
    assert.deepEqual(styleDirectorCandidateWordingIssues("", candidate), [], candidate);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, {pleat:"flat_front"}), [], candidate);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, {pleat:"single_pleat_forward"}).map(x=>x.code),
      ["candidate_trouser_pleat_mismatch"], candidate);
  }
});


test("explicit pleat bans never become positive construction requests", () => {
  for (const wording of [
    "Pleats are disallowed",
    "Pleating is banned",
    "Pleats should not be used",
    "Pleats must not be added",
    "Pleats aren't permitted",
    "Pleating isn't allowed",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
      wording, { pleat: "flat_front" },
    ), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
      wording, { pleat: "single_pleat_forward" },
    ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Single pleat trousers"), "pleated",
    "positive pleat wording must still be interpreted as a request");
});


test("cannot-be-used pleat prohibitions stay flat-front and fail closed against pleated specs", () => {
  for (const label of [
    "Pleats cannot be used",
    "Pleating can't be added",
    "Pleats can’t be included",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(label), "flat_front", label);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", label), [], label);
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(label, { pleat: "single_pleat_forward" })
        .map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"],
      label,
    );
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(label, { pleat: "flat_front" }),
      [],
      label,
    );
  }
  assert.equal(
    styleDirectorCandidateTrouserFront("Pleats cannot be used but add a single pleat"),
    "ambiguous",
    "a later positive instruction must not override an explicit prohibition",
  );
});


test("passive pleat prohibitions remain flat-front instructions", () => {
  for (const wording of [
    "Pleats are not to be used",
    "Pleating is not to be added",
    "Pleats must be avoided",
    "Pleats should be avoided",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.ok(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "single_pleat_forward" })
      .some(issue => issue.code === "candidate_trouser_pleat_mismatch"), wording);
    assert.equal(styleDirectorCandidateTrouserFront(wording + ", single pleat trouser"), "ambiguous", wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Single pleat trouser"), "pleated");
});


test("unknown pleat option cannot certify a named trouser front", () => {
  for (const label of ["Pleated Trouser", "Flat-Front Trouser", "Single Pleat Trouser"]) {
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
      label, { pleat: "retired_pleat_option" as never },
    ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], label);
  }
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Wide-Leg Trouser", { pleat: "retired_pleat_option" as never },
  ), [], "an unspecified front must not imply verified pleat construction");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Pleated Trouser", { pleat: "single_pleat_forward" },
  ), [], "a valid canonical pleat remains compatible");
});

test("pleats are to be avoided is a flat-front prohibition, not a positive pleat request", () => {
  for (const wording of ["Pleats are to be avoided", "Pleating is to be avoided"]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, {pleat:"flat_front"}), []);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, {pleat:"single_pleat_forward"}).map(x=>x.code), ["candidate_trouser_pleat_mismatch"]);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Single pleat trouser"), "pleated");
});

test("never-be-used pleat instructions require flat-front without changing canonical selections", () => {
  for (const wording of [
    "Pleats should never be used",
    "Pleating must never be added",
    "Pleats should never be included",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
      wording, { pleat: "single_pleat_forward" },
    ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], wording);
    assert.equal(styleDirectorCandidateTrouserFront(wording + ", single pleat trouser"), "ambiguous", wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Single pleat trouser"), "pleated");
});

test("shall-not pleat instructions fail closed without rewriting selected construction", () => {
  for (const phrase of ["Pleats shall not be used", "Pleating shall never be added"]) {
    assert.equal(styleDirectorCandidateTrouserFront(phrase), "flat_front");
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(phrase, { pleat: "flat_front" }), []);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(phrase, { pleat: "single_pleat_forward" }).map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"]);
    assert.equal(styleDirectorCandidateTrouserFront(phrase + " with single pleat"), "ambiguous");
  }
  assert.equal(styleDirectorCandidateTrouserFront("Single pleat requested"), "pleated");
});

test("unknown saved trouser pleat IDs require review without changing the locked design", () => {
  for (const type of ["pleated_trouser", "formal_flat_front", "cropped_ankle"]) {
    const selected = spec({}, { type, pleat: "obsolete_pleat_id", break: "no_break", hem: "cropped_above_ankle_hem" });
    const before = JSON.stringify(selected);
    const issues = styleDirectorConstructionIssues(selected).map(issue => issue.code);
    assert.ok(issues.includes("unknown_trouser_pleat_option"), type);
    assert.deepEqual(styleDirectorConstructionIssues(selected).map(issue => issue.code), issues);
    assert.equal(JSON.stringify(selected), before);
  }
  assert.ok(!styleDirectorConstructionIssues(spec({}, { type: "pleated_trouser", pleat: "single_pleat_forward" }))
    .some(issue => issue.code === "unknown_trouser_pleat_option"));
});

test("optional pleat language is neutral rather than a positive construction request", () => {
  for (const wording of [
    "Pleats optional",
    "Pleats are optional",
    "Pleats are not required",
    "Pleating is not mandatory",
    "Pleat not necessary",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "single_pleat_forward" }), [], wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Pleats optional, single pleat requested"), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats optional, flat-front trouser"), "flat_front");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats forbidden"), "flat_front");
});

test("permissive pleat wording does not mandate pleated construction", () => {
  for (const wording of [
    "Pleats may be added",
    "Pleating can be used",
    "Pleats could be included",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "single_pleat_forward" }), [], wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Pleats may be added, flat-front trouser"), "flat_front");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats may be added, single pleat requested"), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats must be added"), "pleated");
});

test("need-not pleat language is optional, not a mandatory pleated front", () => {
  for (const wording of [
    "Pleats need not be added",
    "Pleating does not need to be used",
    "Pleats do not need to be included",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "single_pleat_forward" }), [], wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Pleats need not be added, single pleat requested"), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats need not be added, flat-front trouser"), "flat_front");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats must be added"), "pleated");
});


test("permissive omission of pleats is not a mandatory flat or pleated construction", () => {
  for (const wording of ["Pleats may be omitted", "Pleating can be omitted", "Pleats could be omitted"]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "single_pleat_forward" }), [], wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Pleats may be omitted, single pleat requested"), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats may be omitted, flat-front trouser"), "flat_front");
});


test("unnecessary pleat wording is optional, preserving both construction choices", () => {
  for (const wording of ["Pleats are not needed", "Pleating is unnecessary", "Pleats not needed"]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "single_pleat_forward" }), [], wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Pleats are not needed, single pleat requested"), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats are not needed, flat-front trouser"), "flat_front");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats must be added"), "pleated");
});


test("may-not pleat wording is a prohibition, not a positive pleat", () => {
  for (const phrase of ["Pleats may not be added", "Pleating may never be used", "Pleats may not be included"]) {
    assert.equal(styleDirectorCandidateTrouserFront(phrase), "flat_front", phrase);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(phrase, { pleat: "flat_front" }), [], phrase);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(phrase, { pleat: "single_pleat_forward" }).map(x => x.code),
      ["candidate_trouser_pleat_mismatch"], phrase);
    assert.equal(styleDirectorCandidateTrouserFront("Flat-front; " + phrase), "flat_front");
    assert.equal(styleDirectorCandidateTrouserFront("Single pleat; " + phrase), "ambiguous");
  }
});

test("mandatory pleat omission means flat-front, unlike optional omission", () => {
  for (const wording of ["Pleats should be omitted", "Pleating must be omitted", "Pleats shall be omitted"]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "flat_front", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
      wording, { pleat: "single_pleat_forward" },
    ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], wording);
    assert.equal(styleDirectorCandidateTrouserFront(wording + "; single pleat requested"), "ambiguous", wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Pleats may be omitted"), null);
  assert.equal(styleDirectorCandidateTrouserFront("Single pleat requested"), "pleated");
});

test("optional counted pleats do not force construction or silently change locked fronts", () => {
  for (const wording of [
    "Double pleats may be added",
    "Single pleats can be included",
    "Two pleats could be omitted",
    "One pleat is optional",
  ]) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", wording), [], wording);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Double pleats required"), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront("Flat-front with double pleats required"), "ambiguous");
});

test("optional pleat count does not override an explicit single-pleat construction", () => {
  const wording = "Double pleats may be added; single pleat required";
  const single = { pleat: "single_pleat_forward" } as StyleSpecV2["pant"];
  const double = { pleat: "double_pleat_forward" } as StyleSpecV2["pant"];
  const original = JSON.stringify(single);
  assert.equal(styleDirectorCandidateTrouserFront(wording), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, single), []);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, double)
    .map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
  assert.equal(JSON.stringify(single), original, "review must preserve locked IDs");
});

test("negated pleat direction does not conflict with an explicitly selected direction", () => {
  const wording = "Avoid reverse pleats; forward pleats required";
  assert.equal(styleDirectorCandidateTrouserFront(wording), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    wording, { pleat: "single_pleat_forward" },
  ), []);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    wording, { pleat: "single_pleat_reverse" },
  ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Forward pleats and reverse pleats required", { pleat: "single_pleat_forward" },
  ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
});

test("negative pleat direction constraints reject only the forbidden direction", () => {
  for (const [wording, permitted, forbidden] of [
    ["Avoid reverse pleats; pleated trousers", "single_pleat_forward", "single_pleat_reverse"],
    ["No forward pleats; pleated trousers", "single_pleat_reverse", "single_pleat_forward"],
    ["Without reverse pleats; single pleat requested", "single_pleat_forward", "single_pleat_reverse"],
  ] as const) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), "pleated", wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: permitted }), [], wording);
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(wording, { pleat: forbidden }).map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"],
      wording,
    );
  }
});

test("postposed pleat-direction bans reject only forbidden canonical construction", () => {
  for (const [wording, allowed, forbidden] of [
    ["Reverse pleats prohibited; pleated trousers", "single_pleat_forward", "single_pleat_reverse"],
    ["Forward pleats are forbidden; single pleat trousers", "single_pleat_reverse", "single_pleat_forward"],
    ["Reverse pleats not permitted; forward pleats required", "single_pleat_forward", "single_pleat_reverse"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: allowed }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: forbidden })
      .map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], wording);
  }
});


test("direction-only bans do not imply any trouser front but still constrain locked pleat IDs", () => {
  for (const [wording, allowed, forbidden] of [
    ["Reverse pleats prohibited", "single_pleat_forward", "single_pleat_reverse"],
    ["Forward pleats are forbidden", "single_pleat_reverse", "single_pleat_forward"],
    ["Reverse pleats not permitted", "double_pleat_forward", "double_pleat_reverse"],
    ["No reverse pleats", "single_pleat_forward", "single_pleat_reverse"],
    ["Avoid forward pleats", "single_pleat_reverse", "single_pleat_forward"],
    ["Do not use reverse pleats", "double_pleat_forward", "double_pleat_reverse"],
  ] as const) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    const original = { pleat: forbidden };
    const before = JSON.stringify(original);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: allowed }), [], wording);
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(wording, original).map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"],
      wording,
    );
    assert.equal(JSON.stringify(original), before, "review cannot mutate locked options");
  }
});

test("direction-specific pleat bans do not masquerade as blanket prohibitions", () => {
  assert.equal(styleDirectorCandidateTrouserFront(
    "Reverse pleats prohibited; pleated trousers",
  ), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront(
    "Avoid reverse pleats; forward pleats required",
  ), "pleated");
  assert.equal(styleDirectorCandidateTrouserFront(
    "Reverse pleats prohibited; no pleats permitted",
  ), "flat_front");
  assert.equal(styleDirectorCandidateTrouserFront(
    "Reverse pleats prohibited; flat-front trousers",
  ), "flat_front");
  assert.equal(styleDirectorCandidateTrouserFront("Pleats prohibited"), "flat_front");
});


test("unknown locked pleat direction cannot satisfy a candidate direction prohibition", () => {
  for (const wording of [
    "No forward pleats",
    "Avoid reverse pleats",
    "Forward pleats are forbidden",
    "Reverse pleats not permitted",
    "Do not use forward pleats",
  ]) {
    // Only a known canonical ID can demonstrate that the banned direction
    // is not present. A stale ID is never converted into an invented option.
    const locked = { pleat: "retired_pleat_direction" as StyleSpecV2["pant"]["pleat"] };
    const before = JSON.stringify(locked);
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(wording, locked).map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"],
      wording,
    );
    assert.equal(JSON.stringify(locked), before, "review must not rewrite locked data");
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }),
      [],
      wording,
    );
  }
  assert.deepEqual(
    styleDirectorCandidateFrontConstructionIssues(
      "Wide-Leg Trouser", { pleat: "retired_pleat_direction" as StyleSpecV2["pant"]["pleat"] },
    ),
    [],
    "an unspecified front or direction cannot certify a stale ID, but adds no new candidate constraint",
  );
});


test("modal postposed pleat-direction bans preserve allowable options", () => {
  for (const [ban, allowed, forbidden] of [
    ["Reverse pleats must not be used", "single_pleat_forward", "single_pleat_reverse"],
    ["Forward pleats should never be added", "double_pleat_reverse", "double_pleat_forward"],
    ["Reverse pleats cannot be included", "double_pleat_forward", "double_pleat_reverse"],
    ["Forward pleats can't be used", "single_pleat_reverse", "single_pleat_forward"],
    ["Reverse pleats are not to be used", "single_pleat_forward", "single_pleat_reverse"],
    ["Forward pleats aren't permitted", "double_pleat_reverse", "double_pleat_forward"],
    ["Reverse pleats may not be used", "single_pleat_forward", "single_pleat_reverse"],
  ] as const) {
    for (const wording of [ban, ban + "; pleated trousers"]) {
      assert.equal(styleDirectorCandidateTrouserFront(wording),
        wording === ban ? null : "pleated", wording);
      const locked = { pleat: forbidden };
      const before = JSON.stringify(locked);
      assert.deepEqual(
        styleDirectorCandidateFrontConstructionIssues(wording, { pleat: allowed }),
        [],
        wording,
      );
      assert.deepEqual(
        styleDirectorCandidateFrontConstructionIssues(wording, locked).map(issue => issue.code),
        ["candidate_trouser_pleat_mismatch"],
        wording,
      );
      assert.equal(JSON.stringify(locked), before, "review may not change locked IDs");
    }
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(ban, { pleat: "flat_front" }),
      [],
      ban,
    );
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(ban, {
        pleat: "retired_pleat_direction" as StyleSpecV2["pant"]["pleat"],
      }).map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"],
      ban,
    );
  }
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Reverse pleats must be used", { pleat: "single_pleat_reverse" },
  ), [], "positive construction remains acceptable");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Reverse pleats must be used", { pleat: "single_pleat_forward" },
  ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
});


test("postposed pleat avoidance constrains direction without requiring pleats", () => {
  for (const [ban, allowed, forbidden] of [
    ["Reverse pleats should be avoided", "single_pleat_forward", "single_pleat_reverse"],
    ["Forward pleats must be avoided", "single_pleat_reverse", "single_pleat_forward"],
    ["Reverse pleats shall be avoided", "double_pleat_forward", "double_pleat_reverse"],
    ["Forward pleats are to be avoided", "double_pleat_reverse", "double_pleat_forward"],
    ["Reverse pleats to be avoided", "single_pleat_forward", "single_pleat_reverse"],
  ] as const) {
    assert.equal(styleDirectorCandidateTrouserFront(ban), null, ban);
    assert.equal(styleDirectorCandidateTrouserFront(ban + "; pleated trousers"), "pleated", ban);
    const locked = { pleat: forbidden };
    const original = JSON.stringify(locked);
    for (const wording of [ban, ban + "; pleated trousers"]) {
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: allowed }), [], wording);
      assert.deepEqual(
        styleDirectorCandidateFrontConstructionIssues(wording, locked).map(issue => issue.code),
        ["candidate_trouser_pleat_mismatch"],
        wording,
      );
      assert.equal(JSON.stringify(locked), original, "review must preserve locked construction");
    }
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(ban, { pleat: "flat_front" }), []);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(ban, {
      pleat: "obsolete_direction_id" as StyleSpecV2["pant"]["pleat"],
    }).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
  }
  for (const allowed of [
    "Reverse pleats should be used",
    "Reverse pleats may be added",
    "Forward pleats are optional",
  ]) {
    assert.notEqual(styleDirectorCandidateTrouserFront(allowed), "flat_front", allowed);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Pleats should be avoided"), "flat_front",
    "unqualified avoidance still prohibits all front pleats");
  assert.deepEqual(
    styleDirectorCandidateFrontConstructionIssues("Pleats should be avoided", { pleat: "single_pleat_forward" })
      .map(issue => issue.code),
    ["candidate_trouser_pleat_mismatch"],
  );
});


test("count-specific pleat prohibitions enforce canonical selections without banning all pleats", () => {
  for (const [wording, allowed, prohibited] of [
    ["No double pleats", "single_pleat_forward", "double_pleat_forward"],
    ["Avoid single pleats", "double_pleat_reverse", "single_pleat_reverse"],
    ["Don't use two pleats", "single_pleat_reverse", "double_pleat_reverse"],
    ["Without one pleat", "double_pleat_forward", "single_pleat_forward"],
    ["Do not choose double pleats", "single_pleat_forward", "double_pleat_forward"],
    ["Not a double pleated trouser", "single_pleat_reverse", "double_pleat_reverse"],
  ] as const) {
    assert.equal(styleDirectorCandidateTrouserFront(wording), null, wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: allowed }), [], wording);
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, { pleat: "flat_front" }), [], wording);
    const locked = { pleat: prohibited };
    const before = JSON.stringify(locked);
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues(wording, locked).map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"], wording,
    );
    assert.equal(JSON.stringify(locked), before, "review cannot modify locked production IDs");
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(wording, {
      pleat: "obsolete_pleat_count" as StyleSpecV2["pant"]["pleat"],
    }).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"],
    "unknown saved count cannot certify a negative count requirement");
  }
  assert.equal(styleDirectorCandidateTrouserFront("No double pleats; single pleat required"), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "No double pleats; single pleat required", { pleat: "single_pleat_forward" },
  ), []);
  for (const option of ["single_pleat_forward", "double_pleat_forward", "flat_front"] as const) {
    assert.deepEqual(
      styleDirectorCandidateFrontConstructionIssues("No double pleats; double pleats required", { pleat: option })
        .map(issue => issue.code),
      ["candidate_trouser_pleat_mismatch"],
      "contradictory candidate instructions must not pass under any versioned count",
    );
  }
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Double pleats may be added", { pleat: "double_pleat_forward" },
  ), [], "optional double pleats are not a count prohibition");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Double pleats required", { pleat: "double_pleat_forward" },
  ), [], "positive double-pleat requirements remain valid");
});


test("postposed count-specific bans cannot become a positive pleat request", () => {
  for (const [wording, allowed, banned] of [
    ["Double pleats prohibited", "single_pleat_forward", "double_pleat_forward"],
    ["Single pleats are forbidden", "double_pleat_reverse", "single_pleat_reverse"],
    ["Two pleats must not be used", "single_pleat_reverse", "double_pleat_reverse"],
    ["One pleat should be avoided", "double_pleat_forward", "single_pleat_forward"],
    ["Double pleats aren't permitted", "single_pleat_forward", "double_pleat_forward"],
    ["Single pleats should never be added", "double_pleat_reverse", "single_pleat_reverse"],
    ["1 pleat to be avoided", "double_pleat_forward", "single_pleat_forward"],
    ["Double pleats may not be included", "single_pleat_reverse", "double_pleat_reverse"],
  ] as const) {
    for (const candidate of [wording, wording + "; pleated trousers"]) {
      assert.equal(styleDirectorCandidateTrouserFront(candidate),
        candidate === wording ? null : "pleated", candidate);
      assert.deepEqual(styleDirectorCandidateWordingIssues("Dress Shirt", candidate), [], candidate);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, { pleat: allowed }), [], candidate);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, { pleat: "flat_front" })
        .map(issue => issue.code),
        candidate === wording ? [] : ["candidate_trouser_pleat_mismatch"], candidate);
      const locked = { pleat: banned };
      const before = JSON.stringify(locked);
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, locked).map(issue => issue.code),
        ["candidate_trouser_pleat_mismatch"], candidate);
      assert.equal(JSON.stringify(locked), before, "the locked option must not be changed");
      assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(candidate, {
        pleat: "unknown_count_id" as StyleSpecV2["pant"]["pleat"],
      }).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"], candidate);
    }
  }
  assert.equal(styleDirectorCandidateTrouserFront(
    "Double pleats prohibited; single pleat required",
  ), "pleated");
  assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
    "Double pleats prohibited; single pleat required", { pleat: "single_pleat_forward" },
  ), []);
  for (const pleat of ["flat_front", "single_pleat_forward", "double_pleat_reverse"] as const) {
    assert.deepEqual(styleDirectorCandidateFrontConstructionIssues(
      "Double pleats prohibited; double pleats required", { pleat },
    ).map(issue => issue.code), ["candidate_trouser_pleat_mismatch"]);
  }
  assert.equal(styleDirectorCandidateTrouserFront("Double pleats prohibited; Pleats prohibited"),
    "flat_front", "a general prohibition is still mandatory flat-front intent");
  for (const positiveOrOptional of [
    "Double pleats required", "Single pleats should be used", "Double pleats may be added",
  ]) {
    assert.notEqual(styleDirectorCandidateTrouserFront(positiveOrOptional), "flat_front",
      positiveOrOptional);
  }
});

test("unknown photographic collar labels fail closed without rewriting versioned construction", () => {
  const locked = spec({ collar: "spread_collar", wear: "tucked" });
  const before = JSON.stringify(locked);
  for (const label of ["Retired Collar Label", "", "Camp / Band Hybrid"]) {
    const issues = styleDirectorPresentationIssues({
      collar: label as DesignerStyle["collar"], shirtWear: "Tucked",
    }, locked);
    assert.ok(issues.some(issue => issue.code === "legacy_collar_mismatch"), label);
    assert.equal(JSON.stringify(locked), before, "locked construction must not change");
  }
  const supported = optionsFor("shirt.collar").find(option =>
    option.id === "spread_collar" && option.legacySelectable !== false);
  assert.ok(supported, "canonical spread collar must remain selectable");
  assert.equal(styleDirectorPresentationIssues({
    collar: (supported.legacyLabel || supported.label) as DesignerStyle["collar"],
    shirtWear: "Tucked",
  }, locked).some(issue => issue.code === "legacy_collar_mismatch"), false);
});

test("unreadable intelligence provenance cannot grant ranking trust or crash review", () => {
  const unreadable = Object.defineProperty({}, "trust", {
    get() { throw new Error("must not read a provenance getter"); },
  });
  Object.defineProperty(unreadable, "reviewStatus", {
    get() { throw new Error("must not read a review getter"); },
  });
  const inherited = Object.create({ trust: "reviewed", reviewStatus: "approved" });
  const trap = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("untrusted descriptor trap"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const item of [unreadable, inherited, trap, revoked.proxy]) {
    const result = styleDirectorIntelligenceTrustWeight(item as never);
    assert.equal(result, 0, "unverified provenance has no scoring benefit");
    assert.equal(styleDirectorIntelligenceTrustWeight(item as never), result,
      "unreadable provenance must deterministically fail closed");
  }
  const valid = Object.freeze(Object.assign(Object.create(null), {
    trust: "reviewed", reviewStatus: "approved",
  }));
  assert.equal(styleDirectorIntelligenceTrustWeight(valid), 1);
  assert.equal(styleDirectorIntelligenceTrustWeight(Object.freeze({
    trust: "high-confidence", reviewStatus: "rejected",
  })), 0, "rejection remains authoritative");
});

test("cropped hem proposal fails closed on throwing or inherited selectors", () => {
  const trap = new Proxy({}, {
    getOwnPropertyDescriptor() { throw new Error("unreadable crop selector"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const getter = Object.defineProperties({}, {
    type: { enumerable: true, get() { throw new Error("do not execute type getter"); } },
    break: { enumerable: true, get() { throw new Error("do not execute break getter"); } },
  });
  const inherited = Object.create({
    type: "cropped_ankle", break: "cropped_above_ankle",
  });
  const partial = Object.freeze({ type: "cropped_ankle" });
  for (const pant of [trap, revoked.proxy, getter, inherited, partial, null]) {
    assert.equal(styleDirectorProposedCroppedHem(pant as never), null,
      "untrusted/missing canonical selectors cannot authorise cropped hem");
    assert.equal(styleDirectorProposedCroppedHem(pant as never), null,
      "repeated review must remain deterministic");
  }
  const canonical = Object.freeze(Object.assign(Object.create(null), {
    type: "cropped_ankle", break: "cropped_above_ankle",
  }));
  assert.equal(styleDirectorProposedCroppedHem(canonical),
    "cropped_above_ankle_hem", "valid own data keeps the approved proposal path");
  assert.equal(canonical.type, "cropped_ankle");
  assert.equal(canonical.break, "cropped_above_ankle");
});

test("negative finished-wear clauses cannot consume a second conjunctive wear instruction", () => {
  const clauses = [
    "Do not wear blue linen and tucked shirt",
    "Must not wear blue linen but tucked shirt",
    "Should not wear blue linen or tucked shirt",
    "Do not wear striped cotton and untucked shirt",
    "Must not wear striped cotton but untucked shirt",
    "Should not wear striped cotton or untucked shirt",
  ];
  for (const wording of clauses) {
    // The first clause is incomplete: it cannot safely supply a finished
    // wear state, nor may it swallow the independent affirmative clause.
    const intended = wording.includes("untucked shirt") ? "untucked" : "tucked";
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, {
      wear: intended === "tucked" ? "untucked" : "tucked",
    }).map(issue => issue.code), ["candidate_shirt_wear_mismatch"], wording);
  }
});


test("yet conjunction preserves independent finished-wear intent", () => {
  for (const [wording, requested] of [
    ["Do not wear blue linen yet tucked shirt", "tucked"],
    ["Must not wear striped cotton yet untucked shirt", "untucked"],
    ["Do not tuck the linen shirt yet tucked shirt", "tucked"],
    ["Must not untuck the cotton garment yet untucked shirt", "untucked"],
  ] as const) {
    const opposite = requested === "tucked" ? "untucked" : "tucked";
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, { wear: opposite })
      .map(issue => issue.code), ["candidate_shirt_wear_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, { wear: opposite })
      .map(issue => issue.code), ["candidate_shirt_wear_mismatch"],
      "repeat review must be deterministic");
  }
});

test("contrastive however/whereas clauses preserve independent wear instructions", () => {
  for (const connector of ["however", "whereas"]) {
    for (const [ban, affirmative, opposite] of [
      ["Do not wear blue striped linen", "tucked shirt", "untucked"],
      ["Must not wear cream cotton", "untucked shirt", "tucked"],
      ["Do not tuck the blue linen shirt", "tucked shirt", "untucked"],
      ["Must not untuck the cotton garment", "untucked shirt", "tucked"],
    ] as const) {
      const candidate = `${ban} ${connector} ${affirmative}`;
      const locked = { wear: opposite } as const;
      const before = JSON.stringify(locked);
      const issues = styleDirectorCandidateWearIssues(candidate, locked);
      assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], candidate);
      assert.deepEqual(styleDirectorCandidateWearIssues(candidate, locked), issues, "deterministic replay");
      assert.equal(JSON.stringify(locked), before, "locked construction remains immutable");
    }
  }
});

test("although/while clause boundaries do not swallow independent wear instructions", () => {
  for (const connector of ["although", "while"]) {
    for (const [prohibition, positive, lockedWear] of [
      ["Do not wear blue striped linen", "tucked shirt", "untucked"],
      ["Must not wear cream cotton", "untucked shirt", "tucked"],
      ["Do not tuck the blue linen shirt", "tucked shirt", "untucked"],
      ["Must not untuck the cotton garment", "untucked shirt", "tucked"],
    ] as const) {
      const candidate = `${prohibition} ${connector} ${positive}`;
      const locked = { wear: lockedWear };
      const before = JSON.stringify(locked);
      const issues = styleDirectorCandidateWearIssues(candidate, locked);
      assert.deepEqual(issues.map(issue => issue.code), ["candidate_shirt_wear_mismatch"], candidate);
      assert.deepEqual(styleDirectorCandidateWearIssues(candidate, locked), issues);
      assert.equal(JSON.stringify(locked), before);
    }
  }
});

test("cropped construction and shoe-break matrix preserves locked IDs", () => {
  const breaks = [
    ["full_break", "cropped_full_break"],
    ["slight_break", "cropped_slight_break"],
    ["stacked_break", "cropped_stacked_break"],
  ] as const;
  for (const [shoeBreak, expected] of breaks) {
    for (const croppedBy of ["type", "hem"] as const) {
      const locked = spec();
      locked.pant.type = croppedBy === "type" ? "cropped_ankle" : "formal_flat_front";
      locked.pant.hem = croppedBy === "hem" ? "cropped_above_ankle_hem" : "plain_hem";
      locked.pant.break = shoeBreak;
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.ok(issues.some(issue => issue.code === expected),
        `${croppedBy} / ${shoeBreak} must receive construction review`);
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues, "review is deterministic");
      assert.equal(JSON.stringify(locked), before, "review must not rewrite locked options");
    }
  }
});


test("cropped break cannot certify a plain hem across canonical trouser fronts", () => {
  for (const type of ["formal_flat_front", "pleated_trouser", "cropped_ankle"] as const) {
    const locked = spec();
    locked.pant.type = type;
    locked.pant.hem = "plain_hem";
    locked.pant.break = "cropped_above_ankle";
    const before = JSON.stringify(locked);
    const issues = styleDirectorConstructionIssues(locked);
    assert.ok(issues.some(issue => issue.code === "cropped_break_hem_mismatch"),
      `${type} cannot claim an above-ankle break with a plain hem`);
    assert.deepEqual(styleDirectorConstructionIssues(locked), issues);
    assert.equal(JSON.stringify(locked), before, "review must preserve locked IDs");
  }
});

test("ordinary shoe breaks on non-cropped hems do not invent cropped construction defects", () => {
  for (const type of ["formal_flat_front", "pleated_trouser"] as const) {
    for (const shoeBreak of ["full_break", "slight_break", "stacked_break"] as const) {
      const locked = spec();
      locked.pant.type = type;
      locked.pant.hem = "plain_hem";
      locked.pant.break = shoeBreak;
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      const croppedCodes = issues.map(issue => issue.code).filter(code =>
        code.startsWith("cropped_"));
      assert.deepEqual(croppedCodes, [],
        `${type} / ${shoeBreak} must not produce cropped-only defects`);
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues,
        "construction review must be deterministic");
      assert.equal(JSON.stringify(locked), before,
        "review must not rewrite locked tailoring selections");
    }
  }
});


test("frozen canonical trouser construction remains reviewable without mutation", () => {
  for (const type of ["formal_flat_front", "pleated_trouser", "cropped_ankle"] as const) {
    for (const shoeBreak of ["full_break", "slight_break", "stacked_break", "cropped_above_ankle"] as const) {
      const locked = spec();
      locked.pant.type = type;
      locked.pant.break = shoeBreak;
      locked.pant.hem = type === "cropped_ankle" ? "cropped_above_ankle_hem" : "plain_hem";
      Object.freeze(locked.shirt);
      Object.freeze(locked.pant);
      Object.freeze(locked);
      const before = JSON.stringify(locked);
      const issues = styleDirectorConstructionIssues(locked);
      assert.deepEqual(styleDirectorConstructionIssues(locked), issues,
        "frozen locked designs must produce repeatable review results");
      assert.equal(JSON.stringify(locked), before,
        "construction review must never mutate frozen versioned selections");
      if (type === "cropped_ankle" && shoeBreak !== "cropped_above_ankle") {
        assert.ok(issues.some(issue => issue.code === `cropped_${shoeBreak}`),
          "cropped construction with an ordinary shoe break requires review");
      }
    }
  }
});


test("camp-collar occasion review is limited to explicit formal tiers and preserves locked construction", () => {
  const selected = spec({
    type: "camp_collar_resort", collar: "cuban_camp_collar", wear: "untucked",
  });
  const original = JSON.stringify(selected);
  for (const occasion of ["Formal", "Semi-Formal"] as const) {
    const issues = styleDirectorConstructionIssues(selected, occasion);
    assert.deepEqual(issues.map(issue => issue.code), ["formal_camp_collar"], occasion);
    assert.deepEqual(styleDirectorConstructionIssues(selected, occasion), issues,
      "occasion review must be deterministic");
    assert.equal(JSON.stringify(selected), original, "review must not change locked garment IDs");
  }
  assert.deepEqual(styleDirectorConstructionIssues(selected), [],
    "unspecified occasion must not be treated as a formal occasion");
  assert.equal(JSON.stringify(selected), original);
});


test("frozen camp-collar occasion review does not mutate or invent formal requirements", () => {
  const selected = spec({
    type: "camp_collar_resort", collar: "cuban_camp_collar", wear: "untucked",
  });
  Object.freeze(selected.shirt);
  Object.freeze(selected.pant);
  Object.freeze(selected);
  const before = JSON.stringify(selected);
  for (const occasion of ["Formal", "Semi-Formal"] as const) {
    const first = styleDirectorConstructionIssues(selected, occasion);
    assert.deepEqual(first.map(issue => issue.code), ["formal_camp_collar"]);
    assert.deepEqual(styleDirectorConstructionIssues(selected, occasion), first);
    assert.equal(JSON.stringify(selected), before);
  }
  assert.deepEqual(styleDirectorConstructionIssues(selected), []);
  assert.equal(JSON.stringify(selected), before);
});

test("nonessential construction wording does not select a placket or roll-up sleeve", () => {
  for (const wording of [
    "French placket is not necessary",
    "French placket isn't necessary",
    "French placket isn’t necessary",
  ]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: [], ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidatePlacket(wording, []), null, wording);
    const locked = spec({ placket: "hidden_fly_front" });
    Object.freeze(locked.shirt);
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, locked.shirt), [], wording);
    assert.equal(JSON.stringify(locked), before);
  }
  for (const wording of [
    "Roll-up styled is not necessary",
    "Roll-up styled isn't necessary",
    "Roll-up styled isn’t necessary",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(wording), {
      requested: false, prohibited: false, ambiguous: false,
    }, wording);
  }
  assert.deepEqual(styleDirectorCandidatePlacketIntent("French placket is necessary"), {
    requested: "french_placket", prohibited: [], ambiguous: false,
  });
  assert.equal(styleDirectorCandidateRollUpSleeveIntent("Roll-up styled is necessary").requested, true);
});

test("postposed placket bans do not become positive construction requests", () => {
  for (const wording of [
    "French placket isn't wanted",
    "French placket is not wanted",
    "French placket unwanted",
    "French placket should not be selected",
    "French placket must not be used",
    "French placket should never be selected",
    "French placket must never be worn",
    "French placket is not to be used",
    "French placket is not to be selected",
  ]) {
    const intent = styleDirectorCandidatePlacketIntent(wording);
    assert.deepEqual(intent, {
      requested: null, prohibited: ["french_placket"], ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidatePlacket(wording, []), null);
    const locked = spec({ placket: "french_placket" });
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, locked.shirt).map(x => x.code),
      ["candidate_placket_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording,
      spec({ placket: "hidden_fly_front" }).shirt), [], wording);
    assert.equal(JSON.stringify(locked), before, "review must not mutate locked construction");
  }
  for (const wording of [
    "French placket isn't required",
    "French placket isn't needed",
    "French placket isn't mandatory",
    "French placket is not required",
    "French placket is not needed",
  ]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: [], ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidatePlacket(wording, []), null, wording);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(
      wording, spec({ placket: "hidden_fly_front" }).shirt), [], wording);
  }
  assert.equal(styleDirectorCandidatePlacketIntent(
    "French placket and French placket isn't wanted").ambiguous, true);
});


test("frozen placket prohibitions preserve locked canonical construction", () => {
  for (const [wording, lockedPlacket, expected] of [
    ["French placket isn't wanted", "french_placket", "candidate_placket_mismatch"],
    ["French placket should not be selected", "hidden_fly_front", null],
    ["French placket is not required", "french_placket", null],
    // Contradictory requirements are reviewed by the wording gate, not the
    // single-construction mismatch gate.
    ["French placket and French placket isn't wanted", "french_placket", null],
  ] as const) {
    const locked = spec({ placket: lockedPlacket });
    Object.freeze(locked.shirt);
    Object.freeze(locked.pant);
    Object.freeze(locked);
    const before = JSON.stringify(locked);
    const first = styleDirectorCandidatePlacketIssues(wording, locked.shirt);
    assert.deepEqual(first.map(issue => issue.code),
      expected === null ? [] : [expected], wording);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, locked.shirt), first,
      "frozen review must be deterministic");
    assert.equal(JSON.stringify(locked), before, "locked option IDs must not change");
    if (styleDirectorCandidatePlacketIntent(wording).ambiguous) {
      assert.deepEqual(
        styleDirectorCandidateWordingIssues(wording).map(issue => issue.code)
          .filter(code => code === "ambiguous_candidate_placket"),
        ["ambiguous_candidate_placket"], "contradictory placket intent must reach review",
      );
    }
  }
});


test("postposed collar prohibitions and optionality preserve canonical locked IDs", () => {
  for (const wording of [
    "Camp collar isn't wanted",
    "Camp collar is not wanted",
    "Camp collar unwanted",
    "Camp collar should not be selected",
  ]) {
    const prohibited = spec({ collar: "cuban_camp_collar" });
    const permitted = spec({ collar: "spread_collar" });
    Object.freeze(prohibited.shirt);
    Object.freeze(permitted.shirt);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, prohibited.shirt)
      .map(issue => issue.code), ["candidate_collar_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, permitted.shirt), [], wording);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
  }
  for (const wording of [
    "Camp collar isn't required",
    "Camp collar is not needed",
    "Camp collar isn't mandatory",
  ]) {
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording,
      spec({ collar: "spread_collar" }).shirt), [], wording);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
  }
  assert.deepEqual(styleDirectorCandidateCollarIssues(
    "Camp collar and camp collar isn't wanted",
    spec({ collar: "cuban_camp_collar" }).shirt), [],
    "contradictory construction is handled by the ambiguity gate");
});


test("frozen collar prohibitions remain deterministic across explicit and optional wording", () => {
  for (const [wording, collar, expected] of [
    ["Camp collar isn't wanted", "cuban_camp_collar", "candidate_collar_mismatch"],
    ["Camp collar should not be selected", "spread_collar", null],
    ["Camp collar isn't required", "cuban_camp_collar", null],
    ["Camp collar and camp collar isn't wanted", "cuban_camp_collar", null],
  ] as const) {
    const locked = spec({ collar });
    Object.freeze(locked.shirt);
    Object.freeze(locked.pant);
    Object.freeze(locked);
    const before = JSON.stringify(locked);
    const first = styleDirectorCandidateCollarIssues(wording, locked.shirt);
    assert.deepEqual(first.map(issue => issue.code), expected === null ? [] : [expected], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, locked.shirt), first, wording);
    assert.equal(JSON.stringify(locked), before, "review must preserve locked IDs");
  }
});

test("contracted modal collar bans do not select forbidden locked constructions", () => {
  for (const wording of [
    "Camp collar shouldn't be selected",
    "Camp collar mustn't be worn",
    "Camp collar shouldn’t be chosen",
  ]) {
    const forbidden = spec({ collar: "cuban_camp_collar" });
    const permitted = spec({ collar: "spread_collar" });
    Object.freeze(forbidden.shirt);
    Object.freeze(permitted.shirt);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, forbidden.shirt)
      .map(issue => issue.code), ["candidate_collar_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, permitted.shirt), [], wording);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
  }
});

test("frozen modal collar prohibitions preserve independent wording review and saved IDs", () => {
  for (const wording of [
    "Camp collar shouldn't be selected",
    "Camp collar mustn't be worn",
    "Camp collar shouldn’t be chosen",
  ]) {
    for (const [collar, expected] of [
      ["cuban_camp_collar", ["candidate_collar_mismatch"]],
      ["spread_collar", []],
    ] as const) {
      const locked = spec({ collar });
      Object.freeze(locked.shirt);
      Object.freeze(locked.pant);
      Object.freeze(locked);
      const before = JSON.stringify(locked);
      const first = styleDirectorCandidateCollarIssues(wording, locked.shirt);
      assert.deepEqual(first.map(issue => issue.code), expected, wording);
      assert.deepEqual(styleDirectorCandidateCollarIssues(wording, locked.shirt), first,
        "repeat reviews of frozen selections must agree");
      assert.equal(JSON.stringify(locked), before, "review must not mutate locked IDs");
      assert.deepEqual(styleDirectorCandidateWordingIssues(wording)
        .filter(issue => issue.code === "ambiguous_candidate_collar"), [],
        "an unambiguous prohibition must not be reported as a positive request");
    }
  }
});

test("contracted placket bans preserve frozen construction and optionality", () => {
  for (const wording of [
    "French placket shouldn't be selected",
    "French placket mustn't be used",
    "French placket shouldn’t be chosen",
    "French placket mustn’t be worn",
  ]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: ["french_placket"], ambiguous: false,
    }, wording);
    assert.equal(styleDirectorCandidatePlacket(wording, []), null, wording);
    for (const [placket, expected] of [
      ["french_placket", ["candidate_placket_mismatch"]],
      ["hidden_fly_front", []],
    ] as const) {
      const locked = spec({ placket });
      Object.freeze(locked.shirt);
      Object.freeze(locked.pant);
      Object.freeze(locked);
      const before = JSON.stringify(locked);
      const first = styleDirectorCandidatePlacketIssues(wording, locked.shirt);
      assert.deepEqual(first.map(issue => issue.code), expected, wording);
      assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, locked.shirt), first);
      assert.equal(JSON.stringify(locked), before);
    }
  }
  assert.deepEqual(styleDirectorCandidatePlacketIntent("French placket isn't required"), {
    requested: null, prohibited: [], ambiguous: false,
  });
});

test("explicit select prohibitions never become positive collar or placket requests", () => {
  for (const wording of [
    "Do not select camp collar",
    "Don't select camp collar",
    "Never select camp collar",
  ]) {
    const forbidden = spec({ collar: "cuban_camp_collar" });
    const permitted = spec({ collar: "spread_collar" });
    Object.freeze(forbidden.shirt);
    Object.freeze(permitted.shirt);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, forbidden.shirt)
      .map(issue => issue.code), ["candidate_collar_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, permitted.shirt), [], wording);
  }
  for (const wording of [
    "Do not select French placket",
    "Don't select French placket",
    "Never select French placket",
  ]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: ["french_placket"], ambiguous: false,
    }, wording);
    const locked = spec({ placket: "french_placket" });
    Object.freeze(locked.shirt);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, locked.shirt)
      .map(issue => issue.code), ["candidate_placket_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording,
      spec({ placket: "hidden_fly_front" }).shirt), [], wording);
  }
});


test("optional tuck wording does not rewrite or constrain frozen wear IDs", () => {
  for (const wording of ["with or without tucked", "with or without being untucked"]) {
    for (const wear of ["tucked", "untucked"] as const) {
      const locked = Object.freeze({ wear });
      assert.deepEqual(styleDirectorCandidateWearIssues(wording, locked), [], wording);
      assert.deepEqual(styleDirectorCandidateWearIssues(wording, locked), [],
        "optional wording must remain deterministic");
      assert.equal(locked.wear, wear);
    }
  }
  for (const [wording, permitted] of [
    ["not tucked", "untucked"],
    ["not untucked", "tucked"],
  ] as const) {
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, Object.freeze({ wear: permitted })), []);
    const forbidden = permitted === "tucked" ? "untucked" : "tucked";
    assert.deepEqual(styleDirectorCandidateWearIssues(wording, Object.freeze({ wear: forbidden }))
      .map(issue => issue.code), ["candidate_shirt_wear_mismatch"]);
  }
});

test("conflicting tuck instructions fail closed without rewriting frozen wear selections", () => {
  for (const wording of [
    "tucked and untucked",
    "tucked or untucked",
  ]) {
    for (const wear of ["tucked", "untucked"] as const) {
      const locked = Object.freeze({ wear });
      const first = styleDirectorCandidateWearIssues(wording, locked);
      assert.deepEqual(first.map(issue => issue.code),
        ["candidate_shirt_wear_mismatch"], wording);
      assert.deepEqual(styleDirectorCandidateWearIssues(wording, locked), first,
        "conflicting wear review must be deterministic");
      assert.equal(locked.wear, wear, "review must preserve the locked wear ID");
    }
  }
});

test("explicit wear instructions override occasion defaults without changing locked designs", () => {
  for (const [occasion, wording, proposed, expected] of [
    ["Formal", "wear untucked", "Tucked", "Untucked"],
    ["Casual", "wear tucked", "Untucked", "Tucked"],
  ] as const) {
    assert.equal(styleDirectorWearForCandidate(occasion, wording, proposed), expected);
    assert.equal(styleDirectorWearForCandidate(occasion, wording, proposed), expected);
  }
});

test("cannot-be-used collar and placket bans preserve locked construction IDs", () => {
  for (const wording of ["French placket cannot be used", "French placket can't be selected"]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: ["french_placket"], ambiguous: false,
    }, wording);
    const forbidden = spec({ placket: "french_placket" });
    Object.freeze(forbidden.shirt);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, forbidden.shirt)
      .map(issue => issue.code), ["candidate_placket_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording,
      spec({ placket: "hidden_fly_front" }).shirt), [], wording);
  }
});


test("cannot-be-used collar bans require review without changing frozen IDs", () => {
  for (const wording of [
    "Camp collar cannot be used",
    "Camp collar can't be selected",
  ]) {
    const forbidden = spec({ collar: "cuban_camp_collar" });
    const allowed = spec({ collar: "spread_collar" });
    Object.freeze(forbidden.shirt);
    Object.freeze(forbidden.pant);
    Object.freeze(forbidden);
    Object.freeze(allowed.shirt);
    const before = JSON.stringify(forbidden);
    const first = styleDirectorCandidateCollarIssues(wording, forbidden.shirt);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_collar_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, forbidden.shirt), first);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, allowed.shirt), [], wording);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
    assert.equal(JSON.stringify(forbidden), before, "locked IDs must remain unchanged");
  }
});

test("postposed collar inclusion bans preserve frozen canonical selections", () => {
  for (const wording of [
    "Camp collar is not to be included",
    "Camp collar cannot be included",
    "Camp collar can't be included",
  ]) {
    const forbidden = spec({ collar: "cuban_camp_collar" });
    const permitted = spec({ collar: "spread_collar" });
    Object.freeze(forbidden.shirt);
    Object.freeze(forbidden.pant);
    Object.freeze(forbidden);
    Object.freeze(permitted.shirt);
    const before = JSON.stringify(forbidden);
    const issues = styleDirectorCandidateCollarIssues(wording, forbidden.shirt);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_collar_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, forbidden.shirt), issues);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, permitted.shirt), [], wording);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
    assert.equal(JSON.stringify(forbidden), before);
  }
});

test("never-qualified postposed collar bans cannot select a forbidden construction", () => {
  for (const wording of [
    "Camp collar must never be included",
    "Camp collar should never be worn",
    "Camp collar must never be selected",
  ]) {
    const forbidden = spec({ collar: "cuban_camp_collar" });
    const permitted = spec({ collar: "spread_collar" });
    Object.freeze(forbidden.shirt);
    Object.freeze(permitted.shirt);
    const snapshot = JSON.stringify(forbidden);
    const issues = styleDirectorCandidateCollarIssues(wording, forbidden.shirt);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_collar_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, forbidden.shirt), issues);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, permitted.shirt), [], wording);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
    assert.equal(JSON.stringify(forbidden), snapshot);
  }
});

test("never-allowed collar restrictions fail closed without mutating saved IDs", () => {
  for (const wording of [
    "Camp collar is never allowed",
    "Camp collar never permitted",
    "Camp collar is never permitted",
  ]) {
    const forbidden = spec({ collar: "cuban_camp_collar" });
    const permitted = spec({ collar: "spread_collar" });
    const snapshot = JSON.stringify(forbidden);
    Object.freeze(forbidden.shirt);
    Object.freeze(permitted.shirt);
    const issues = styleDirectorCandidateCollarIssues(wording, forbidden.shirt);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_collar_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, forbidden.shirt), issues);
    assert.deepEqual(styleDirectorCandidateCollarIssues(wording, permitted.shirt), [], wording);
    assert.equal(styleDirectorCandidateCollar(wording, []), null, wording);
    assert.equal(JSON.stringify(forbidden), snapshot);
  }
});


test("postposed placket inclusion and never-allowed bans preserve frozen IDs", () => {
  for (const wording of [
    "French placket cannot be included",
    "French placket can't be included",
    "French placket is not to be included",
    "French placket must never be included",
    "French placket is never allowed",
    "French placket never permitted",
  ]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: ["french_placket"], ambiguous: false,
    }, wording);
    const forbidden = spec({ placket: "french_placket" });
    const permitted = spec({ placket: "hidden_fly_front" });
    const snapshot = JSON.stringify(forbidden);
    Object.freeze(forbidden.shirt);
    Object.freeze(permitted.shirt);
    const first = styleDirectorCandidatePlacketIssues(wording, forbidden.shirt);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_placket_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, forbidden.shirt), first);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, permitted.shirt), [], wording);
    assert.equal(JSON.stringify(forbidden), snapshot);
  }
});

test("modal prefix placket bans require review without rewriting frozen construction", () => {
  for (const wording of [
    "Must not use French placket",
    "Should never include French placket",
    "Cannot select French placket",
    "Can't wear French placket",
    "Mustn't choose French placket",
  ]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: ["french_placket"], ambiguous: false,
    }, wording);
    const forbidden = spec({ placket: "french_placket" });
    const permitted = spec({ placket: "hidden_fly_front" });
    const before = JSON.stringify(forbidden);
    Object.freeze(forbidden.shirt);
    Object.freeze(permitted.shirt);
    const issues = styleDirectorCandidatePlacketIssues(wording, forbidden.shirt);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_placket_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, forbidden.shirt), issues);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, permitted.shirt), [], wording);
    assert.equal(JSON.stringify(forbidden), before);
  }
  assert.deepEqual(styleDirectorCandidatePlacketIntent("Use French placket"), {
    requested: "french_placket", prohibited: [], ambiguous: false,
  });
  assert.deepEqual(styleDirectorCandidatePlacketIntent("Must not use French placket; choose covered placket"), {
    requested: "covered_placket", prohibited: ["french_placket"], ambiguous: false,
  });
});

test("modal sleeve prohibitions preserve locked construction and reject forbidden length", () => {
  const cases = [
    ["Must never include short sleeves", "half_sleeve", "full_sleeve"],
    ["Short sleeves cannot be selected", "half_sleeve", "full_sleeve"],
    ["Should not wear full sleeves", "full_sleeve", "half_sleeve"],
    ["Full sleeves must never be included", "full_sleeve", "half_sleeve"],
    ["Cannot select half sleeves", "half_sleeve", "full_sleeve"],
  ] as const;
  for (const [instruction, forbidden, permitted] of cases) {
    const locked = spec({ sleeve: forbidden });
    const before = JSON.stringify(locked);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(instruction, locked.shirt)
      .map(issue => issue.code), ["candidate_sleeve_mismatch"], instruction);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(instruction, { sleeve: permitted }), [],
      "allowed canonical construction should remain valid: " + instruction);
    assert.equal(styleDirectorCandidateSleeve(instruction), null,
      "a prohibited length must never be selected as a new proposal");
    assert.equal(JSON.stringify(locked), before, "locked IDs must not be rewritten");
  }
});

test("contracted modal sleeve bans reject forbidden lengths without mutating saved IDs", () => {
  for (const [instruction, forbidden, permitted] of [
    ["Mustn't choose short sleeves", "half_sleeve", "full_sleeve"],
    ["Shouldn't include full sleeves", "full_sleeve", "half_sleeve"],
    ["Mustn’t wear half sleeves", "half_sleeve", "full_sleeve"],
    ["Shouldn’t select long sleeves", "full_sleeve", "half_sleeve"],
  ] as const) {
    const locked = spec({ sleeve: forbidden });
    const snapshot = JSON.stringify(locked);
    Object.freeze(locked.shirt);
    const issues = styleDirectorCandidateSleeveIssues(instruction, locked.shirt);
    assert.deepEqual(issues.map(issue => issue.code), ["candidate_sleeve_mismatch"], instruction);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(instruction, locked.shirt), issues);
    assert.deepEqual(styleDirectorCandidateSleeveIssues(instruction, { sleeve: permitted }), [], instruction);
    assert.equal(styleDirectorCandidateSleeve(instruction), null, instruction);
    assert.equal(JSON.stringify(locked), snapshot);
  }
  assert.deepEqual(styleDirectorCandidateSleeve("Choose short sleeves"), {
    sleeve: "half_sleeve", cuff: "open_short_hem_cuff",
  }, "affirmative short sleeves must retain their canonical compatible cuff");
});


test("contracted postposed placket bans cannot approve a forbidden locked ID", () => {
  for (const wording of [
    "French placket isn't allowed",
    "French placket isn’t permitted",
    "French placket aren't allowed",
  ]) {
    assert.deepEqual(styleDirectorCandidatePlacketIntent(wording), {
      requested: null, prohibited: ["french_placket"], ambiguous: false,
    }, wording);
    const forbidden = spec({ placket: "french_placket" });
    const allowed = spec({ placket: "hidden_fly_front" });
    Object.freeze(forbidden.shirt);
    Object.freeze(allowed.shirt);
    const before = JSON.stringify(forbidden);
    const first = styleDirectorCandidatePlacketIssues(wording, forbidden.shirt);
    assert.deepEqual(first.map(issue => issue.code), ["candidate_placket_mismatch"], wording);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, forbidden.shirt), first);
    assert.deepEqual(styleDirectorCandidatePlacketIssues(wording, allowed.shirt), [], wording);
    assert.equal(JSON.stringify(forbidden), before);
  }
  assert.deepEqual(styleDirectorCandidatePlacketIntent("French placket is allowed"), {
    requested: "french_placket", prohibited: [], ambiguous: false,
  });
});

test("modal roll-up bans cannot become positive construction requests", () => {
  for (const wording of [
    "Cannot select roll-up styled",
    "Can't wear roll-up sleeves",
    "Must not include roll-up styled",
    "Should never choose roll-up styled",
    "Roll-up styled cannot be selected",
    "Roll-up sleeves can't be worn",
  ]) {
    const intent = styleDirectorCandidateRollUpSleeveIntent(wording);
    assert.deepEqual(intent, {
      requested: false, prohibited: true, ambiguous: false,
    }, wording);
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(wording), intent);
  }
  assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent("Choose roll-up styled"), {
    requested: true, prohibited: false, ambiguous: false,
  });
});

test("roll-up select modal distinguishes prohibition from affirmative selection", () => {
  for (const wording of [
    "Can’t select roll-up styled",
    "Can't select roll-up sleeves",
    "Cannot select roll-up styled",
  ]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(wording), {
      requested: false, prohibited: true, ambiguous: false,
    }, wording);
  }
  for (const wording of ["Can select roll-up styled", "Select roll-up styled"]) {
    assert.deepEqual(styleDirectorCandidateRollUpSleeveIntent(wording), {
      requested: true, prohibited: false, ambiguous: false,
    }, wording);
  }
});
