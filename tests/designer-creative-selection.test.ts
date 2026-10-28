import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { DesignerFabric, DesignerStyle } from "../src/lib/designer/engine.ts";
import type { CreativeDirection } from "../src/lib/designer/creative-engine.ts";
import {
  creativeDirectionMatchesSelection,
  fabricRevisionKey,
  type CreativeSelection,
} from "../src/lib/designer/creative-selection.ts";
import { fromLegacyStyle } from "../src/lib/designer/style-spec-v2.ts";

function fixture() {
  // Keep the fixture independent of the legacy engine's unannotated JSON
  // import; this pure selection gate is intentionally testable in Node.
  const style:DesignerStyle={
    collar:"Point (Standard) Collar",collarFinish:"Self-fabric",
    cuff:"Barrel Cuff (1-button)",placket:"Standard (visible stitch)",
    shirtFit:"Regular / Classic Fit",shirtWear:"Tucked",
    trouser:"Pleated Trouser",rise:"Mid Rise",waistband:"Belt Loops",
    break:"Slight Break",button:"Corozo (vegetable ivory)",
  };
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
  assert.match(source,/\[draftReady,shirtId,pantId,shirt,pant,occasion,climate,intention,style,styleSpec\]/);
  assert.match(source,/shirt:shirt\?\?null,pant:pant\?\?null/);
  assert.match(source,/const fabricIdentity=JSON\.stringify\(\[fabricRevisionKey\(shirt\),fabricRevisionKey\(pant\)\]\)/);
  assert.match(source,/const assessmentIdentity=JSON\.stringify\(\[shirtId,pantId,fabricIdentity,/);
  assert.match(source,/shirt:DESIGNER_SHIRTS\.find\(\(item\)=>item\.id===nextShirtId\)\?\?null/);
  assert.match(source,/pant:DESIGNER_PANTS\.find\(\(item\)=>item\.id===nextPantId\)\?\?null/);
  assert.match(source,/\[shirtId,pantId,fabricIdentity,styleSpec,bodyProfile,measurementProfile,activeCreative\]/);
  assert.match(source,/\[shirtId,pantId,occasion,style,styleSpec,climate,intention,craftRequest\]/);
});

test("assessment request binds its payload and late reply to the committed selection",()=>{
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  const block=source.slice(source.indexOf("  async function assess("),source.indexOf("  function giveFeedback("));
  assert.match(block,/const nextStyleSpec=mergeLegacyIntoStyleSpec\(styleSpec,nextStyle\)/);
  assert.match(block,/setStyle\(\{ \.\.\.nextStyle \}\);\s*setStyleSpec\(nextStyleSpec\)/);
  assert.match(block,/styleSpec:nextStyleSpec,[\s\S]*signal:controller\.signal/);
  assert.match(block,/if\(!isCurrent\(\)\) return;\s*applyServerAssessment\(next\)/);
  assert.match(block,/catch\(error\) \{\s*if\(!isCurrent\(\)\) return;/);
  assert.match(source,/run\.identity!==assessmentIdentity[\s\S]*run\.controller\.abort\(\)/);
  assert.match(source,/committedAssessmentIdentity\.current!==assessmentIdentity[\s\S]*setAssessment\(null\)/);
});


test("same-ID catalogue revisions revoke creative direction and physical preview evidence",()=>{
  const {selection,direction}=fixture();
  const shirt={
    id:selection.shirtId,name:"Blue stripe",image:"/fabrics/a.webp",source:"operator",
    renderScale:{physicalScaleStatus:"declared_repeat",repeatMm:10,stripeWidthMm:null},
    weightGsm:180,confirmedAvailableMetres:14,availabilityVerified:true,
    physicsProfile:{version:"linen-earth-fabric-physics-v1",fabricId:selection.shirtId,
      gsm:{value:180,evidence:"declared"}},
  } as unknown as DesignerFabric;
  const pant={id:selection.pantId,name:"Beige suiting",image:"/fabrics/b.webp",
    source:"operator",confirmedAvailableMetres:20} as unknown as DesignerFabric;
  const selected={...selection,shirt:{...shirt},pant:{...pant}};
  const concept={...direction,recommendation:{...direction.recommendation,shirt:{...shirt},pant:{...pant}}};
  assert.equal(creativeDirectionMatchesSelection(concept,selected),true);
  assert.equal(fabricRevisionKey(shirt),fabricRevisionKey({...shirt}),true);
  const changes=[
    {...shirt,image:"/fabrics/new-photo.webp"},
    {...shirt,renderScale:{physicalScaleStatus:"declared_repeat" as const,repeatMm:12,stripeWidthMm:null}},
    {...shirt,weightGsm:210},
    {...shirt,confirmedAvailableMetres:3},
    {...shirt,physicsProfile:{...shirt.physicsProfile!,
      gsm:{value:180,evidence:"reviewed" as const}}},
  ];
  for(const revised of changes){
    assert.equal(creativeDirectionMatchesSelection(concept,{...selected,shirt:revised}),false);
    assert.notEqual(fabricRevisionKey(shirt),fabricRevisionKey(revised));
  }
  assert.equal(creativeDirectionMatchesSelection(concept,{...selected,pant:{...pant,source:"supplier-revised"}}),false);
  assert.equal(creativeDirectionMatchesSelection(concept,{...selected,shirt:null}),false);
  assert.equal(creativeDirectionMatchesSelection(concept,{...selected,shirt:{...shirt,id:""}}),false);
  assert.equal(creativeDirectionMatchesSelection(direction,selected),false,
    "a legacy ID-only concept must not certify a current physical catalogue snapshot");
  assert.equal(creativeDirectionMatchesSelection(direction,selection),true,
    "legacy callers without snapshot remain compatible but do not assert physical parity");
});


test("fabric revision keys are order-independent and fail closed on non-JSON evidence",()=>{
  const base={id:"fabric-a",image:"/fabrics/a.webp",weightGsm:180,
    physicsProfile:{version:"linen-earth-fabric-physics-v1",fabricId:"fabric-a",
      gsm:{value:180,evidence:"declared"}}} as unknown as DesignerFabric;
  const reordered={...base,physicsProfile:{
    gsm:{evidence:"declared",value:180},
    fabricId:"fabric-a",version:"linen-earth-fabric-physics-v1",
  }} as unknown as DesignerFabric;
  assert.equal(fabricRevisionKey(base),fabricRevisionKey(reordered));
  assert.equal(fabricRevisionKey({...base,weightGsm:Number.NaN}),"missing");
  assert.equal(fabricRevisionKey({...base,weightGsm:Number.POSITIVE_INFINITY}),"missing");
  const cyclic:Record<string,unknown>={};
  cyclic.self=cyclic;
  assert.equal(fabricRevisionKey({...base,physicsProfile:cyclic as unknown as DesignerFabric["physicsProfile"]}),"missing");
});
