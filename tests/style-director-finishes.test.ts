import test from "node:test";
import assert from "node:assert/strict";
import { FABRIC_STOCK } from "../src/lib/fabric-stock.ts";
import { designerFabricFromStock, designerStyleForOccasion } from "../src/lib/designer/engine.ts";
import { fromLegacyStyle, validateStyleSpecV2 } from "../src/lib/designer/style-spec-v2.ts";
import { optionById } from "../src/lib/designer/options/library.ts";
import {
  createStyleDirectorFinishAlternatives, STYLE_DIRECTOR_FINISH_GROUPS,
  type StyleDirectorFinishKey,
} from "../src/lib/designer/style-director-finishes.ts";
import type { StyleDirectorRealModelSpec } from "../src/lib/style-director-agent.ts";

const shirt=FABRIC_STOCK.find((fabric)=>fabric.id==="linen-plain-60-sky-blue")!;
const pant=FABRIC_STOCK.find((fabric)=>fabric.id==="linen-suiting-beige")!;
assert.ok(shirt && pant);

function fixture():StyleDirectorRealModelSpec {
  const style=designerStyleForOccasion("Semi-Formal");
  return {
    shirtId:shirt.id,shirtName:shirt.colorName,shirtFabric:designerFabricFromStock(shirt),
    pantId:pant.id,pantName:pant.colorName,pantFabric:designerFabricFromStock(pant),
    occasion:"Semi-Formal",climate:"Air-conditioned",intention:"Understated",
    style,styleSpec:fromLegacyStyle(style),reason:"Synthetic test only",
    status:"preliminary",confidenceScore:0,designFitScore:0,
  };
}

test("finishing suggestions keep fabrics, v2 identity and every other construction detail",()=>{
  const source=fixture();
  const frozen=structuredClone(source);
  let total=0;
  for(const dimension of STYLE_DIRECTOR_FINISH_GROUPS){
    const variants=createStyleDirectorFinishAlternatives(source,dimension.key);
    assert.ok(variants.length<=3);
    assert.equal(new Set(variants.map(v=>v.optionId)).size,variants.length);
    total+=variants.length;
    for(const alt of variants){
      assert.ok(validateStyleSpecV2(alt.realModel.styleSpec));
      assert.equal(alt.realModel.shirtId,shirt.id);
      assert.equal(alt.realModel.pantId,pant.id);
      assert.equal(alt.baseShirtId,shirt.id);
      assert.equal(alt.basePantId,pant.id);
      assert.deepEqual(alt.realModel.shirtFabric,source.shirtFabric);
      assert.deepEqual(alt.realModel.pantFabric,source.pantFabric);
      const target=dimension.key==="collar"||dimension.key==="cuff"||dimension.key==="placket"
        ? alt.realModel.styleSpec.shirt : alt.realModel.styleSpec.pant;
      assert.equal(target[dimension.key],alt.optionId);
      assert.equal(optionById(alt.optionId)?.group,dimension.group);
      assert.equal(alt.realModel.style[dimension.key],optionById(alt.optionId)?.legacyLabel);
      const oldStyle={...source.style},newStyle={...alt.realModel.style};
      delete (oldStyle as Partial<typeof oldStyle>)[dimension.key];
      delete (newStyle as Partial<typeof newStyle>)[dimension.key];
      assert.deepEqual(newStyle,oldStyle);
      const origSpec=structuredClone(source.styleSpec);
      const editedSpec=structuredClone(alt.realModel.styleSpec);
      delete (dimension.key==="collar"||dimension.key==="cuff"||dimension.key==="placket" ? origSpec.shirt : origSpec.pant as Record<string,unknown>)[dimension.key];
      delete (dimension.key==="collar"||dimension.key==="cuff"||dimension.key==="placket" ? editedSpec.shirt : editedSpec.pant as Record<string,unknown>)[dimension.key];
      // The v2 legacy snapshot correctly tracks the user-selected legacy option.
      delete (origSpec.legacy as Record<string,unknown>)[dimension.key];
      delete (editedSpec.legacy as Record<string,unknown>)[dimension.key];
      assert.deepEqual(editedSpec,origSpec);
      assert.match(alt.reviewNote,/preliminary|review/i);
      assert.match(alt.id,new RegExp("^"+dimension.key+":"));
    }
    assert.deepEqual(createStyleDirectorFinishAlternatives(source,dimension.key),variants);
  }
  assert.ok(total>=3,"At least three genuine alternatives across canonical construction groups");
  assert.deepEqual(source,frozen);
});

test("French cuffs are not suggested with an incompatible point collar",()=>{
  const cuff=createStyleDirectorFinishAlternatives(fixture(),"cuff");
  assert.ok(cuff.length>0);
  assert.ok(cuff.every(candidate=>candidate.optionId!=="french_double_cuff"));
});

test("rejects unsupported field and corrupt construction instead of inventing an option",()=>{
  const source=fixture();
  assert.deepEqual(createStyleDirectorFinishAlternatives(source,"pocket" as StyleDirectorFinishKey),[]);
  assert.deepEqual(createStyleDirectorFinishAlternatives({...source,styleSpec:{...source.styleSpec,styleSchemaVersion:3 as 2}},"collar"),[]);
  assert.deepEqual(createStyleDirectorFinishAlternatives({...source,styleSpec:{...source.styleSpec,shirt:{...source.styleSpec.shirt,collar:"hostile"}}},"collar"),[]);
});
