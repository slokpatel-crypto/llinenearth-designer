import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {safeProductionQcRows} from "../src/lib/designer/production-qc-transport.ts";
import {validProductionDeskResponse} from "../src/lib/designer/production-desk-ledger.ts";
import {hasVerifiedLatestDeliveryQc} from "../src/lib/designer/delivery-qc-approval.ts";

const orderId="123e4567-e89b-42d3-a456-426614174011";
const row={
  inspection_id:"123e4567-e89b-42d3-a456-426614174012",
  order_id:orderId,revision_id:"LE-LOCK-CI-QUOTE-20261031",
  recipe_hash:"a".repeat(64),decision:"approved",
  inspector:"CI Tailor",inspection_reference:"CI-QC-01",
  checks:{
    recipe_match:true,fabric_match:true,measurement_check:true,
    pattern_alignment:true,stitching_finish:true,clean_damage_free:true,
  },
  defects:[],note:"Synthetic check only",
  created_at:"2026-10-31T02:00:00Z",
  private_customer_phone:"DO-NOT-LEAK-CI-QC",
};
test("operator QC transport preserves physical checks without leaking future SQL fields",()=>{
  const [safe]=safeProductionQcRows([row]);
  assert.equal(Object.keys(safe).length,11);
  assert.equal(safe.decision,"approved");
  assert.deepEqual(safe.checks,row.checks);
  assert.deepEqual(safe.defects,[]);
  assert.equal(hasVerifiedLatestDeliveryQc([safe],orderId,250),true);
  assert.doesNotMatch(JSON.stringify(safe),/DO-NOT-LEAK-CI-/);
  assert.equal(Object.hasOwn(row,"private_customer_phone"),true);
});
test("nested unexpected QC evidence and invalid values fail closed rather than leak",()=>{
  for(const candidate of [
    {...row,checks:{...row.checks,private_customer:"DO-NOT-LEAK-CI-QC"}},
    {...row,checks:{...row.checks,recipe_match:"true"}},
    {...row,checks:["recipe_match"]},
    {...row,defects:["unapproved-private-defect"]},
    {...row,defects:{secret:"DO-NOT-LEAK-CI-QC"}},
    null,
  ]) assert.throws(()=>safeProductionQcRows([candidate]));
  assert.throws(()=>safeProductionQcRows({rows:[row]}));
  assert.throws(()=>safeProductionQcRows(Array.from({length:251},()=>row)));
});
test("historical incomplete physical QC stays visible but never approves delivery",()=>{
  const [safe]=safeProductionQcRows([{
    ...row,checks:null,defects:null,inspector:null,inspection_reference:null,
  }]);
  assert.equal(safe.checks,null);
  assert.equal(hasVerifiedLatestDeliveryQc([safe],orderId,250),false);
});
test("production route validates original optional ledger before allowlisting QC",()=>{
  const source=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const original=source.indexOf("if(!validProductionDeskResponse(originalReceipt))");
  const safe=source.indexOf("safeProductionQcRows(qc.rows)");
  const revalidate=source.indexOf("if(!validProductionDeskResponse(receipt))");
  assert.ok(original>0&&safe>original&&revalidate>safe);
  assert.ok(source.includes("qcInspections:safeProductionQcRows(qc.rows)"));
});
