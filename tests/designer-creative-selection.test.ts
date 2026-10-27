import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { designerStyleForOccasion } from "../src/lib/designer/engine.ts";
import type { CreativeDirection } from "../src/lib/designer/creative-engine.ts";
import {
  creativeDirectionMatchesSelection,
  type CreativeSelection,
} from "../src/lib/designer/creative-selection.ts";
import { fromLegacyStyle } from "../src/lib/designer/style-spec-v2.ts";

function fixture() {
  const style=designerStyleForOccasion("Semi-Formal");
  const selection:CreativeSelection={
    shirtId:"linen-shirt-a",pantId:"linen-pant-a",occasion:"Semi-Formal",
    climate:"Not specified",intention:"Balanced",style,
    styleSpec:fromLegacyStyle(style),
  };
  const direction={
    id:"concept-1",
    baseStyle:{...style},
    recommendation:{
      shirt:{id:selection.shirtId},pant:{id:selection.pantId},
      occasion:selection.occasion,
      context:{climate:selection.climate,intention:selection.intention},
    },
  } as unknown as CreativeDirection;
  return {selection,direction};
}

test("selected concept remains attached only to the identical fabric/context/cut",()=>{
  const {selection,direction}=fixture();
  assert.equal(creativeDirectionMatchesSelection(direction,selection),true);
  assert.equal(creativeDirectionMatchesSelection(null,selection),false);
});

test("changing either fabric, occasion, climate or intention invalidates the old concept",()=>{
  const {selection,direction}=fixture();
  const edits:CreativeSelection[]=[
    {...selection,shirtId:"linen-shirt-b"},
    {...selection,pantId:"linen-pant-b"},
    {...selection,occasion:"Formal"},
    {...selection,climate:"Hot / humid"},
    {...selection,intention:"Expressive"},
  ];
  for(const edited of edits) assert.equal(creativeDirectionMatchesSelection(direction,edited),false);
});

test("legacy construction and advanced v2-only cuts invalidate old concept and render evidence",()=>{
  const {selection,direction}=fixture();
  assert.equal(creativeDirectionMatchesSelection(direction,{
    ...selection,style:{...selection.style,collar:"Spread Collar"},
  }),false);
  assert.equal(creativeDirectionMatchesSelection(direction,{
    ...selection,
    styleSpec:{...selection.styleSpec,shirt:{...selection.styleSpec.shirt,sleeve:"half_sleeve"}},
  }),false);
  assert.equal(creativeDirectionMatchesSelection(direction,{
    ...selection,
    styleSpec:{...selection.styleSpec,pant:{...selection.styleSpec.pant,fit:"wide_leg_drape"}},
  }),false);
  assert.equal(creativeDirectionMatchesSelection(direction,{
    ...selection,
    styleSpec:{...selection.styleSpec,legacy:{...selection.styleSpec.legacy,shirtWear:"Untucked"}},
  }),false);
});

test("stored concept with mismatched recommendation context cannot be restored",()=>{
  const {selection,direction}=fixture();
  const stale={...direction,recommendation:{
    ...direction.recommendation,context:{climate:"Cool" as const,intention:"Balanced" as const},
  }};
  assert.equal(creativeDirectionMatchesSelection(stale,selection),false);
});

test("Designer restore, live invalidation and generation lifecycle use the same full selection",()=>{
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.match(source,/creativeDirectionMatchesSelection\(parsed\.creative,/);
  assert.match(source,/creativeDirectionMatchesSelection\(activeCreative,/);
  assert.match(source,/if\(activeCreative\) \{\s*setRecommendation\(null\);\s*setAssessment\(null\);\s*setRecommendationId\(null\);/);
  assert.match(source,/\[draftReady,shirtId,pantId,occasion,climate,intention,style,styleSpec\]/);
  assert.match(source,/\[shirtId,pantId,occasion,style,styleSpec,climate,intention,craftRequest\]/);
});
