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

test("advanced-cut state reaches server rule evaluation and NEVER silently downgrades to unrelated old cut",()=>{
  assert.ok(engine.includes("spec:expandedStyleSpec??fromLegacyStyle(style)"));
  assert.ok(server.includes("body.context,styleSpec"));
  assert.ok(server.includes('status:422'));
  assert.ok(server.includes("body.styleSpec!==undefined && body.styleSpec!==null && !styleSpec"));
  assert.ok(schema.includes("return option?.legacyLabel || fallback;"));
  assert.ok(!schema.includes("option?.legacyLabel || option?.label || fallback;"));
  assert.ok(designer.includes("next.legacy.cuff=option.legacyLabel"));
  assert.ok(designer.includes("setAssessment(null)"));
  assert.ok(designer.includes("setRecommendation(null)"));
  assert.ok(designer.includes("setLockedRevision(null)"));
});
