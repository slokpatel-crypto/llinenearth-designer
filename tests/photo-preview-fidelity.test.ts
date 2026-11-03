import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { DesignerStyle } from "../src/lib/designer/engine.ts";
import type { StyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";
import { photoConstructionMismatches } from "../src/lib/designer/photo-preview-fidelity.ts";

const baseStyle: DesignerStyle = {
  collar: "Point (Standard) Collar",
  collarFinish: "Self-fabric",
  cuff: "Barrel Cuff (1-button)",
  placket: "Standard (visible stitch)",
  shirtFit: "Regular / Classic Fit",
  shirtWear: "Tucked",
  trouser: "Pleated Trouser",
  rise: "Mid Rise",
  waistband: "Belt Loops",
  break: "Slight Break",
  button: "Plastic / Resin",
};
const baseSpec: StyleSpecV2 = {
  styleSchemaVersion: 2,
  shirt: {
    type: "dress_shirt",
    collar: "point_standard_collar",
    collarFinish: "Self-fabric",
    cuff: "barrel_cuff_1_button",
    placket: "standard_visible_placket",
    pocket: "no_pocket",
    sleeve: "full_sleeve",
    fit: "regular_classic_fit",
    length: "shirt_length_tuck",
    hem: "curved_shirttail",
    back: "plain_back",
    wear: "tucked",
    button: "plastic_resin",
  },
  pant: {
    type: "pleated_trouser",
    fit: "pleated_straight",
    rise: "mid_rise",
    pleat: "single_pleat_forward",
    waistband: "belt_loops",
    hem: "plain_hem",
    break: "slight_break",
  },
  legacy: baseStyle,
};
const fields = (style: DesignerStyle, spec?: StyleSpecV2) =>
  photoConstructionMismatches(style, spec).map((gap) => gap.field);

test("photographed point collar, cuff, standard placket and tucked pleat baseline have no construction mismatch", () => {
  assert.deepEqual(fields(baseStyle, baseSpec), []);
});

test("selected collar, cuff and hidden placket are not described as photo geometry", () => {
  const style = {...baseStyle, collar: "Spread Collar", cuff: "French / Double Cuff", placket: "Hidden Placket"};
  const actual = fields(style);
  assert.deepEqual(actual.filter((x)=>x.startsWith("shirt.")), ["shirt.collar", "shirt.cuff", "shirt.placket"]);
});

test("advanced v2 collar and short sleeve are reported even when legacy photographic labels stay unchanged", () => {
  const spec:StyleSpecV2 = {...baseSpec, shirt:{...baseSpec.shirt,collar:"cuban_camp_collar",sleeve:"half_sleeve",cuff:"open_short_hem_cuff"}};
  assert.deepEqual(fields(baseStyle,spec).filter((x)=>x.startsWith("shirt.")),["shirt.collar","shirt.cuff","shirt.sleeve"]);
});

test("default untucked straight construction does not silently claim the pictured curved shirt hem matches", () => {
  const style:DesignerStyle={...baseStyle,shirtWear:"Untucked"};
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,wear:"untucked",length:"shirt_length_regular",hem:"straight_flat_hem"},legacy:style};
  assert.ok(fields(style,spec).includes("shirt.hem"));
  assert.equal(fields(style,{...spec,shirt:{...spec.shirt,hem:"curved_shirttail"}}).includes("shirt.hem"),false);
});

test("untucked wide source matches wide silhouette but not a flat-front v2 pleat", () => {
  const style:DesignerStyle={...baseStyle,shirtWear:"Untucked",trouser:"Wide-leg / Relaxed Drape Trouser",break:"Full Break"};
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,wear:"untucked",length:"shirt_length_regular"},pant:{...baseSpec.pant,type:"wide_leg_relaxed_drape",fit:"wide_leg_drape",pleat:"flat_front",break:"full_break"},legacy:style};
  const gaps=fields(style,spec);
  assert.ok(gaps.includes("pant.pleat"));
  assert.equal(gaps.includes("pant.type"),false);
  assert.equal(gaps.includes("pant.fit"),false);
});

test("tucked wide leg is explicitly a straight-leg photo mismatch", () => {
  const style:DesignerStyle={...baseStyle,trouser:"Wide-leg / Relaxed Drape Trouser"};
  const gaps=photoConstructionMismatches(style);
  assert.ok(gaps.some((row)=>row.field==="pant.type" && /tucked straight-leg photograph/i.test(row.reason)));
});

test("advanced flat front, rise and waistband cannot be claimed from tucked photograph", () => {
  const spec:StyleSpecV2={...baseSpec,pant:{...baseSpec.pant,pleat:"flat_front",rise:"high_rise",waistband:"extended_tab"}};
  assert.deepEqual(fields(baseStyle,spec),["pant.pleat","pant.rise","pant.waistband"]);
});

test("mismatch reporting is stable and never changes versioned garment data", () => {
  const snapshot=JSON.stringify(baseSpec);
  assert.deepEqual(photoConstructionMismatches(baseStyle,baseSpec),photoConstructionMismatches(baseStyle,baseSpec));
  assert.equal(JSON.stringify(baseSpec),snapshot);
});

test("customer photographic preview displays selected construction mismatch notice",()=>{
  const source=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(source,/photoConstructionMismatches\(style,styleSpec\)/);
  assert.match(source,/data-photo-construction-mismatch/);
  assert.match(source,/not reconstructed in the fixed studio photograph/);
});

test("versioned wear choice cannot silently borrow the legacy tucked photograph", () => {
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,wear:"untucked",collarFinish:"White contrast collar"}};
  const rows=photoConstructionMismatches(baseStyle,spec);
  assert.ok(rows.some((x)=>x.field==="shirt.wear" && /photographed tuck mode/i.test(x.reason)));
  assert.ok(rows.some((x)=>x.field==="shirt.collarFinish"));
});

test("versioned trouser cut and break do not inherit legacy photographic support", () => {
  const spec:StyleSpecV2={...baseSpec,pant:{...baseSpec.pant,type:"formal_flat_front",break:"cropped_above_ankle"}};
  const rows=photoConstructionMismatches(baseStyle,spec);
  assert.ok(rows.some((x)=>x.field==="pant.type"));
  assert.ok(rows.some((x)=>x.field==="pant.break"));
  assert.equal(new Set(rows.map((x)=>x.field)).size,rows.length);
});

test("rear construction stays explicitly unverified in the fixed front photograph", () => {
  const spec:StyleSpecV2={...baseSpec,shirt:{...baseSpec.shirt,back:"darts_back"}};
  const rows=photoConstructionMismatches(baseStyle,spec);
  assert.deepEqual(rows.map((x)=>x.field),["shirt.back"]);
  assert.match(rows[0].reason,/front photograph cannot verify/i);
});
