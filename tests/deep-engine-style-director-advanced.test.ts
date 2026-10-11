import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const search=readFileSync("src/lib/designer/search.ts","utf8");
const api=readFileSync("src/app/api/designer/search/route.ts","utf8");
const studio=readFileSync("src/components/DesignerModule.tsx","utf8");

test("Style Director validates actual chosen StyleSpec v2 before recommending alternative fabric combinations",()=>{
  for(const token of [
    "styleSpec?:StyleSpecV2|null",
    "mergeLegacyIntoStyleSpec(input.styleSpec,style)",
    "evaluateDesignerCombo(shirt,pant,input.occasion,style,undefined,input.context,expanded)",
    "evaluateDesignerCombo(input.currentShirt,input.currentPant,input.occasion,style,undefined,input.context,advanced)",
    "if(hardBlocked(recommendation,fit)) continue;",
    "tier,shirt,pant,style,...(expanded?{styleSpec:expanded}:{})",
  ])assert.ok(search.includes(token),token);
});

test("Style Director API only accepts a validated advanced cut and returns its canonical construction",()=>{
  for(const token of [
    "validateStyleSpecV2(body.styleSpec)",
    "styleSpec:advanced",
    "if(body.styleSpec!=null&&!advanced)",
    "status:422",
    "result.styleSpec?{styleSpec:result.styleSpec}",
  ])assert.ok(api.includes(token),token);
});

test("photographic Studio cannot silently discard advanced cut upon applying a Style Director outfit",()=>{
  for(const token of [
    "styleSpec?:StyleSpecV2|null",
    "styleSpec,\n          context:{climate,intention}",
    "const nextStyleSpec=result.styleSpec??fromLegacyStyle(result.style)",
    "setStyleSpec(nextStyleSpec)",
    "style:result.style,styleSpec:nextStyleSpec,context:nextContext",
    "const expectedIdentity=JSON.stringify(",
  ])assert.ok(studio.includes(token),token);
  assert.ok(!studio.includes("setStyleSpec(fromLegacyStyle(result.style));"));
});
