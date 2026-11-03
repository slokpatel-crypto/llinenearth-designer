import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  styleDirectorCandidateCollar,
  styleDirectorCandidateSleeve,
  styleDirectorCandidateTrouserFront,
  styleDirectorCandidateWordingIssues,
  styleDirectorConstructionIssues,
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
});

test("camp-collar type requires matching open collar and untucked wear", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type: "camp_collar_resort", collar: "cuban_camp_collar", wear: "untucked",
  })), []);
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    type: "camp_collar_resort", collar: "point_standard_collar", wear: "tucked",
  })).map(x=>x.code), ["camp_collar_construction"]);
});

test("short sleeves cannot be recommended with French double cuffs", () => {
  assert.deepEqual(styleDirectorConstructionIssues(spec({
    sleeve: "half_sleeve", cuff: "french_double_cuff",
  })).map(x=>x.code), ["short_sleeve_double_cuff"]);
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
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "formal_flat_front", hem: "plain_hem", break: "half_break",
  })), [], "ordinary full-length trousers may use half break");
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    type: "cropped_ankle", hem: "cropped_above_ankle_hem", break: "no_break",
  })), [], "compatible cropped trousers remain valid");
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
  assert.equal(a.length,3);
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
  })).map(issue=>issue.code),["short_sleeve_double_cuff"]);
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
    assert.deepEqual(styleDirectorPresentationIssues(photo(collar, "Tucked"), spec()), [], collar);
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


test("conflicting named collar families fail closed rather than silently selecting a construction", () => {
  for (const name of ["Cuban Band-Collar Shirt", "Mandarin Cutaway Shirt", "Camp Cutaway Shirt", "Cuban Mandarin Cutaway Shirt"]) {
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

test("ambiguous candidate descriptions force an explicit recommendation review", () => {
  const cases: Array<[string, string[]]> = [
    ["Cuban Band-Collar Shirt", ["ambiguous_candidate_collar"]],
    ["Mandarin Cutaway Shirt", ["ambiguous_candidate_collar"]],
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
