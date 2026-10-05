import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStyleDirectorLooks, type StyleDirectorAnswers } from "../src/lib/style-director-agent.ts";
import { validateStyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";

function answers(overrides:Partial<StyleDirectorAnswers>={}):StyleDirectorAnswers{
  return {
    occasion:"Work",
    mood:"Sharp",
    time:"Day",
    climate:"Indoor",
    garment:"shirt",
    colorDirection:"Blue",
    ...overrides,
  };
}

test("Style Director real-model looks carry canonical garment types",()=>{
  const looks=createStyleDirectorLooks(answers());
  const real=looks.map((look)=>look.realModel).filter(Boolean);
  assert(real.length>0);
  for(const look of real){
    assert(look);
    assert.equal(validateStyleSpecV2(look.styleSpec),true);
    assert.equal(look.styleSpec.styleSchemaVersion,2);
    assert.ok(look.styleSpec.shirt.type);
    assert.ok(look.styleSpec.pant.type);
  }
});

test("Style Director translates garment language into explicit shirt types",()=>{
  const resort=createStyleDirectorLooks(answers({occasion:"Travel",mood:"Relaxed",climate:"Hot",colorDirection:"Surprise me"}));
  const types=resort.map((look)=>look.realModel?.styleSpec.shirt.type).filter(Boolean);
  assert(types.includes("camp_collar_resort"),"Travel/resort directions should carry a camp-collar shirt type when the candidate calls for it.");
});

test("Style Director handoff signs and verifies StyleSpec rather than legacy style alone",()=>{
  const handoff=readFileSync("src/lib/designer/style-director-handoff.ts","utf8");
  const api=readFileSync("src/app/api/style-director/handoff/route.ts","utf8");
  const page=readFileSync("src/app/style-director/page.tsx","utf8");
  const designer=readFileSync("src/components/DesignerModule.tsx","utf8");

  assert(handoff.includes('const VERSION="v2"'));
  assert(handoff.includes('version:"linen-earth-style-director-handoff-v2"'));
  assert(handoff.includes("styleSpec:StyleSpecV2"));
  assert(handoff.includes("canonical(payload.styleSpec)===canonical(observed.styleSpec)"));
  assert(api.includes("validateStyleSpecV2(body.styleSpec)"));
  assert(page.includes("styleSpec:JSON.stringify(selectedLook.realModel.styleSpec)"));
  assert(designer.includes('const routedStyleSpec = params.get("styleSpec")'));
  assert(designer.includes("styleSpec:nextStyleSpec || fromLegacyStyle(nextStyle)"));
});
