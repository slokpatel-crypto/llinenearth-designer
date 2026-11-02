import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  styleDirectorCandidateCollar,
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
  })).map(x=>x.code), ["cropped_full_break"]);
  assert.deepEqual(styleDirectorConstructionIssues(spec({}, {
    hem: "cropped_above_ankle_hem", break: "full_break",
  })).map(x=>x.code), ["cropped_full_break"]);
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
