import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const designer=readFileSync("src/components/DesignerModule.tsx","utf8");
const schema=readFileSync("src/lib/designer/style-spec-v2.ts","utf8");
const server=readFileSync("src/app/api/designer/assess/route.ts","utf8");
const engine=readFileSync("src/lib/designer/engine.ts","utf8");

test("actual expanded tailoring choices are visible only in optional precision drawer",()=>{
  assert.ok(designer.includes('Precision tailoring · optional'));
  for(const token of [
    '["sleeve","Sleeve length","shirt.sleeve"]',
    '["cuff","Cuff construction","shirt.cuff"]',
    '["pocket","Shirt pocket","shirt.pocket"]',
    '["length","Shirt length","shirt.length"]',
    '["hem","Shirt hem","shirt.hem"]',
    '["back","Back shaping","shirt.back"]',
    '["fit","Trouser leg shape","pant.fit"]',
    '["pleat","Trouser pleats","pant.pleat"]',
    '["hem","Trouser hem","pant.hem"]',
  ])assert.ok(designer.includes(token),token);
  assert.ok(designer.includes('changeExpandedCut("shirt",field,event.target.value)'));
  assert.ok(designer.includes('changeExpandedCut("pant",field,event.target.value)'));
  assert.ok(designer.includes("option.group!==`${garment}.${field}`"));
  assert.ok(designer.includes("applyStyleSpec(next)"));
  assert.ok(designer.includes("photographed mannequin"));
});

test("photographic preview cannot claim a verified direct render for an advanced garment cut",()=>{
  assert.ok(designer.includes("const photographed=fromLegacyStyle(style)"));
  assert.ok(designer.includes("styleSpec.shirt[field]!==photographed.shirt[field]"));
  assert.ok(designer.includes("styleSpec.pant[field]!==photographed.pant[field]"));
  assert.ok(designer.includes('support:{status:"approximate" as const'));
  assert.ok(designer.includes("const rows=[...legacyRows,...advancedRows]"));
  assert.ok(designer.includes("},[style,styleSpec]);"));
  assert.ok(designer.includes("PHOTO MATCH · MIXED"));
});

test("advanced-cut state reaches server rule evaluation and NEVER silently downgrades to unrelated old cut",()=>{
  assert.ok(engine.includes("spec:expandedStyleSpec??fromLegacyStyle(style)"));
  assert.ok(server.includes("body.context,styleSpec"));
  assert.ok(server.includes('status:422'));
  assert.ok(server.includes("body.styleSpec!==undefined && body.styleSpec!==null && !styleSpec"));
  assert.ok(schema.includes("if(option.legacyLabel)return option.legacyLabel;"));
  assert.ok(schema.includes("if(EXTENDED_LEGACY_GROUPS.has(group)&&option.legacySelectable!==false&&option.label===fallback)return option.label;"));
  assert.ok(schema.includes("return fallback;"));
  assert.ok(!schema.includes("option?.legacyLabel || option?.label || fallback;"));
  // The earlier cuff-only bridge was replaced with a stricter seven-group
  // guard. Assert the actual selected option is both visible and selectable
  // before the legacy photo state can change; v2-only cuts remain untouched.
  assert.ok(schema.includes("option.legacySelectable===false"));
  assert.ok(designer.includes("legacyLabelForSelectedOption(group,value,DESIGNER_STYLE_CHOICES[legacyKey])"));
  assert.ok(designer.includes("if(label) next.legacy[legacyKey]=label;"));
  for(const group of ["shirt.collar","shirt.cuff","shirt.placket","shirt.fit",
    "pant.rise","pant.waistband","pant.break"]){
    assert.ok(designer.includes('"'+group+'":'),group);
  }
  assert.ok(designer.includes("setAssessment(null)"));
  assert.ok(designer.includes("setRecommendation(null)"));
  assert.ok(designer.includes("setLockedRevision(null)"));
});
