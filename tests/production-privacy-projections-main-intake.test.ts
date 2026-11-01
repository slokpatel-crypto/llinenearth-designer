import test from "node:test";
import assert from "node:assert/strict";
import {safeProductionQcRows} from "../src/lib/designer/production-qc-transport.ts";
import {safeProductionCustomerOutcomes} from "../src/lib/designer/production-outcome-transport.ts";

const privateValue="DO-NOT-LEAK-RECOVERY-TOKEN-OR-PHONE";
test("main intake: optional QC history drops unrecognized private upstream columns",()=>{
  const row={
    inspection_id:"qc-1",order_id:"order-1",revision_id:"rev-1",
    recipe_hash:"a".repeat(64),decision:"hold",
    checks:{recipe_match:true,measurement_check:false},
    defects:["measurement"],note:"Needs fitting",inspector:"tailor",
    inspection_reference:"ref-1",created_at:"2026-11-01T00:00:00Z",
    privateCustomerPhone:privateValue,recoveryToken:privateValue,
    rawSupplierData:{value:privateValue},
  };
  const rows=safeProductionQcRows([row]);
  assert.equal(rows.length,1);
  assert.deepEqual(rows[0].checks,{recipe_match:true,measurement_check:false});
  assert.deepEqual(rows[0].defects,["measurement"]);
  assert.equal(rows[0].decision,"hold");
  assert.doesNotMatch(JSON.stringify(rows),/DO-NOT-LEAK|recoveryToken|privateCustomerPhone|rawSupplierData/);
  row.checks.recipe_match=false;
  row.defects.push("other");
  assert.equal(rows[0].checks?.recipe_match,true,"Nested QC decision must not reference mutable source data");
  assert.deepEqual(rows[0].defects,["measurement"],"Nested defects must be copied");
});
test("main intake: missing historical QC checks stay unknown, not approved",()=>{
  const item={inspection_id:"qc-2",decision:"hold"};
  const rows=safeProductionQcRows([item,{...item,checks:null,defects:null}]);
  assert.equal(rows[0].checks,null);
  assert.equal(rows[0].defects,null);
  assert.equal(rows[1].checks,null);
  assert.equal(rows[1].defects,null);
});
test("main intake: reject unexpected nested QC keys, non-boolean results and defects",()=>{
  const safe={inspection_id:"qc",checks:{recipe_match:true},defects:["measurement"]};
  for(const invalid of [
    null,{},[null],[[]],
    [{...safe,checks:["recipe_match"]}],
    [{...safe,checks:{unexpected_private_check:true}}],
    [{...safe,checks:{recipe_match:"yes"}}],
    [{...safe,checks:{recipe_match:1}}],
    [{...safe,defects:"measurement"}],
    [{...safe,defects:["customer_phone"]}],
    [{...safe,defects:["measurement",123]}],
    Array(251).fill(safe),
  ])assert.throws(()=>safeProductionQcRows(invalid),
    "Unverified nested SQL QC data cannot become operator approval");
  assert.deepEqual(safeProductionQcRows([]),[]);
});
test("main intake: customer outcome projection exposes only the reviewed evidence fields",()=>{
  const row={
    outcome_id:"outcome-1",order_id:"order-1",revision_id:"rev-1",
    overall_rating:4,fit_result:"alteration_needed",worn_confirmed:false,
    note:"Hem adjustment",created_at:"2026-11-01T00:00:00Z",
    customerPhone:privateValue,homeAddress:privateValue,
    recoveryToken:privateValue,sessionCookie:privateValue,
  };
  const [sanitized]=safeProductionCustomerOutcomes([row]);
  assert.deepEqual(Object.keys(sanitized).sort(),[
    "outcome_id","order_id","revision_id","overall_rating","fit_result",
    "worn_confirmed","note","created_at",
  ].sort());
  assert.equal(sanitized.overall_rating,4);
  assert.equal(sanitized.worn_confirmed,false,
    "A false worn confirmation is retained, never changed into an approval");
  assert.doesNotMatch(JSON.stringify(sanitized),/DO-NOT-LEAK|customerPhone|homeAddress|recoveryToken|sessionCookie/);
});
test("main intake: malformed and oversized customer outcome ledgers fail closed",()=>{
  for(const invalid of [null,{},[null],[[1]],Array(251).fill({outcome_id:"outcome-1"})])
    assert.throws(()=>safeProductionCustomerOutcomes(invalid),
      "Malformed or overly long upstream data cannot become verified outcomes");
  assert.deepEqual(safeProductionCustomerOutcomes([]),[]);
});
