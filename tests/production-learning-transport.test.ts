import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeProductionLearningContexts} from "../src/lib/designer/production-learning-transport.ts";
import {validProductionDeskResponse} from "../src/lib/designer/production-desk-ledger.ts";

const revisionId="LE-LOCK-CI-QUOTE-20261031",hash="a".repeat(64);
const context={
  version:"linen-earth-production-learning-context-v1",
  revisionId,recipeHash:hash,
  source:{designerRuleSetVersion:"ci-only-rules",fitConstructionVersion:null,
    styleSchemaVersion:2,private_optimizer_key:"DO-NOT-LEAK-CI-SOURCE"},
  context:{occasion:"Semi-Formal",climate:"Cool",intention:"Balanced",
    private_customer_phone:"DO-NOT-LEAK-CI-CUSTOMER"},
  fabrics:{shirtId:"ci-shirt",trouserId:"ci-trouser",
    private_supplier:"DO-NOT-LEAK-CI-FABRIC"},
  shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",
    cuff:"Barrel",placket:"Standard",button:"Corozo",
    private_factory:"DO-NOT-LEAK-CI-SHIRT"},
  trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",
    break:"Slight Break"},
  creative:{conceptId:"ci",explorationClass:"essential",treatmentIds:["c1"],
    patternId:null,private_note:"DO-NOT-LEAK-CI-CREATIVE"},
  private_session:"DO-NOT-LEAK-CI-CONTEXT",
};
const row={
  order_id:"123e4567-e89b-42d3-a456-426614174011",revision_id:revisionId,
  recipe_hash:hash,created_at:"2026-10-31T03:00:00Z",context,
  private_supplier_contact:"DO-NOT-LEAK-CI-ROW",
};
const order={
  order_id:row.order_id,revision_id:revisionId,recipe_hash:hash,quote_id:null,
  status:"created",note:"CI",created_at:"2026-10-31T01:00:00Z",
  updated_at:"2026-10-31T01:00:00Z",
};
function validEnvelope(learningContexts:unknown[]){
  return {
    configured:true,quotes:[],orders:[order],
    qcInspections:[],customerOutcomes:[],learningContexts,
    optionalEvidenceSources:{
      qcInstalled:false,customerOutcomesInstalled:false,learningContextInstalled:true,
    },
  };
}
test("nested learning context transport preserves immutable recipe and selected tailoring fields",()=>{
  assert.equal(validProductionDeskResponse(validEnvelope([row])),true);
  const [safe]=safeProductionLearningContexts([row]);
  assert.equal(safe.order_id,row.order_id);
  assert.equal(safe.context.version,context.version);
  assert.equal(safe.context.recipeHash,hash);
  assert.equal(safe.context.shirt.fit,"Regular");
  assert.deepEqual(safe.context.creative?.treatmentIds,["c1"]);
  assert.deepEqual(Object.keys(safe).sort(),[
    "order_id","revision_id","recipe_hash","created_at","context",
  ].sort());
  assert.deepEqual(Object.keys(safe.context).sort(),[
    "version","revisionId","recipeHash","source","context","fabrics","shirt","trouser","creative",
  ].sort());
  assert.doesNotMatch(JSON.stringify(safe),/DO-NOT-LEAK-CI-/);
  assert.equal(validProductionDeskResponse(validEnvelope([safe])),true);
  assert.ok(Object.hasOwn(context.source,"private_optimizer_key"),
    "Projection must not edit or delete original persisted source");
});
test("learning context transport bounds and rejects malformed nested evidence",()=>{
  for(const value of [null,{},[null],[4],[[row]],Array.from({length:501},()=>row)]){
    assert.throws(()=>safeProductionLearningContexts(value));
  }
  for(const bad of [
    {...row,context:{...context,source:null}},
    {...row,context:{...context,shirt:{...context.shirt,fit:42}}},
    {...row,context:{...context,source:{...context.source,styleSchemaVersion:3}}},
    {...row,context:{...context,creative:{...context.creative,treatmentIds:[true]}}},
    {...row,context:{...context,creative:{...context.creative,treatmentIds:Array(41).fill("x")}}},
    {...row,context:{...context,context:{...context.context,intention:"x".repeat(201)}}},
    {...row,context:{...context,version:"other"}},
  ])assert.throws(()=>safeProductionLearningContexts([bad]));
  assert.equal(validProductionDeskResponse(validEnvelope([{...row,recipe_hash:"b".repeat(64)}])),false);
});
test("route validates complete nested learning ledger before allowlist, then revalidates",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const original=route.indexOf("if(!validProductionDeskResponse(originalReceipt))");
  const projection=route.indexOf("safeProductionLearningContexts(contexts.rows)");
  const final=route.indexOf("if(!validProductionDeskResponse(receipt))");
  assert.ok(original>0&&projection>original&&final>projection);
  assert.ok(route.includes("learningContexts:safeProductionLearningContexts(contexts.rows)"));
  const fixture=readFileSync("scripts/ci-verified-stock-fixture.cjs","utf8");
  assert.ok(fixture.includes("LEARNING_CONTEXT_LISTS"));
  assert.ok(fixture.includes("DO-NOT-LEAK-CI-LEARNING-SOURCE"));
  const http=readFileSync("scripts/verify-production-ledger-private-http.cjs","utf8");
  assert.ok(http.includes("contextRow.context.fabrics.shirtId"));
  assert.ok(http.includes("private_roll_supplier"));
  assert.ok(http.includes("assert.doesNotMatch(JSON.stringify(data),/DO-NOT-LEAK-CI-/)"));
});
