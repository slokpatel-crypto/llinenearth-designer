import test from "node:test";
import assert from "node:assert/strict";
import { FABRIC_STOCK } from "../src/lib/fabric-stock.ts";
import { designerFabricFromStock, designerStyleForOccasion } from "../src/lib/designer/engine.ts";
import { fromLegacyStyle } from "../src/lib/designer/style-spec-v2.ts";
import {
  evaluateStyleDirectorVersatility, STYLE_DIRECTOR_VERSATILITY_OCCASIONS,
} from "../src/lib/designer/style-director-versatility.ts";
import type { StyleDirectorRealModelSpec } from "../src/lib/style-director-agent.ts";

const shirt=FABRIC_STOCK.find(f=>f.id==="linen-plain-60-sky-blue")!;
const pant=FABRIC_STOCK.find(f=>f.id==="linen-suiting-beige")!;
assert.ok(shirt&&pant);

function source():StyleDirectorRealModelSpec {
  const style=designerStyleForOccasion("Semi-Formal");
  return {
    shirtId:shirt.id,shirtName:shirt.colorName,shirtFabric:designerFabricFromStock(shirt),
    pantId:pant.id,pantName:pant.colorName,pantFabric:designerFabricFromStock(pant),
    style,styleSpec:fromLegacyStyle(style),occasion:"Semi-Formal",
    climate:"Air-conditioned",intention:"Understated",reason:"Synthetic only",
    status:"preliminary",designFitScore:0,confidenceScore:0,
  };
}

test("four distinct existing occasion bands are evaluated without changing either fabric or construction",()=>{
  const base=source(),before=structuredClone(base);
  const rows=evaluateStyleDirectorVersatility(base);
  assert.equal(rows.length,STYLE_DIRECTOR_VERSATILITY_OCCASIONS.length);
  assert.deepEqual(rows.map(row=>row.occasion),["Casual","Smart-Casual","Semi-Formal","Formal"]);
  for(const row of rows){
    assert.ok(["preliminary","review_required"].includes(row.state));
    assert.ok(row.occasionBandMatch===null||typeof row.occasionBandMatch==="boolean");
    assert.ok(row.stylingSignal===null||(row.stylingSignal>=0&&row.stylingSignal<=100));
    assert.ok(row.confidenceSignal===null||(row.confidenceSignal>=0&&row.confidenceSignal<=100));
    assert.match(row.evidenceNote,/provisional|physical|fit|tailor/i);
    assert.ok(row.reviewItems.length<=3);
  }
  assert.deepEqual(base,before,"Versatility exploration must never mutate a saved recipe");
  assert.deepEqual(evaluateStyleDirectorVersatility(base),rows,"Evaluation is deterministic");
});

test("invalid v2 spec or a swapped catalogue identity fails closed",()=>{
  const base=source();
  assert.deepEqual(evaluateStyleDirectorVersatility({...base,shirtId:"fake"}),[]);
  assert.deepEqual(evaluateStyleDirectorVersatility({...base,pantId:"fake"}),[]);
  assert.deepEqual(evaluateStyleDirectorVersatility({...base,styleSpec:{...base.styleSpec,styleSchemaVersion:3 as 2}}),[]);
  assert.deepEqual(evaluateStyleDirectorVersatility({...base,styleSpec:{...base.styleSpec,shirt:{...base.styleSpec.shirt,collar:"unknown"}}}),[]);
});

test("formal direction never silently approves a conflicting rough/casual recipe",()=>{
  const base=source();
  const rows=evaluateStyleDirectorVersatility(base);
  for(const row of rows){
    if(row.occasionBandMatch===false) assert.equal(row.state,"review_required");
  }
  assert.ok(rows.some(row=>row.stylingSignal!==null),"At least one authentic engine styling score exists");
});
