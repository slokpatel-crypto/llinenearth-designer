import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifyProductionCutLedger} from "../src/lib/designer/production-cut-ledger-validation.ts";

const uuid=(i:number)=>`00000000-0000-4000-8000-${i.toString(16).padStart(12,"0")}`;
const sample=(i:number,garment:"shirt"|"trouser"="shirt")=>({
  evidence_id:uuid(i+10000),
  case_id:`CUT-${i.toString().padStart(3,"0")}`,
  order_id:uuid(i),
  revision_id:`LE-LOCK-${i}`,
  recipe_hash:"a".repeat(64),
  garment,
  fabric_id:`FABRIC-${i}`,
  fabric_width_cm:"150.25",
  actual_metres:"1.875",
  pattern_repeat_mm:null,
  pattern_matching:false,
  cut_context:"Full sleeves",
  checked_by:"Verified tailor",
  evidence_reference:`Cut ticket ${i}`,
  note:"",
  created_at:"2026-11-02T05:00:00+00:00",
});

test("verified physical cut rows retain calibrated numeric quantities",()=>{
  const rows=verifyProductionCutLedger([sample(1),{...sample(2,"trouser"),pattern_repeat_mm:"24.5",pattern_matching:true}]);
  assert.equal(rows[0].actual_metres,1.875);
  assert.equal(rows[0].fabric_width_cm,150.25);
  assert.equal(rows[1].pattern_repeat_mm,24.5);
  assert.equal(rows[1].garment,"trouser");
});

test("forty distinct real cut evidence records can count as 20 shirt and 20 trouser cases",()=>{
  const rows=verifyProductionCutLedger(Array.from({length:40},(_,i)=>sample(i+1,i<20?"shirt":"trouser")));
  assert.equal(rows.filter(r=>r.garment==="shirt").length,20);
  assert.equal(rows.filter(r=>r.garment==="trouser").length,20);
  const oneShort=verifyProductionCutLedger(Array.from({length:39},(_,i)=>sample(i+1,i<19?"shirt":"trouser")));
  assert.equal(oneShort.filter(r=>r.garment==="shirt").length,19);
  assert.equal(oneShort.filter(r=>r.garment==="trouser").length,20);
});

test("malformed upstream ledger cannot fabricate readiness from numeric coercion or missing physical provenance",()=>{
  const row=sample(1);
  const corrupt=[
    {actual_metres:null},{actual_metres:""},{actual_metres:"NaN"},{actual_metres:"Infinity"},
    {actual_metres:0},{actual_metres:13},{fabric_width_cm:null},
    {fabric_width_cm:"0"},{fabric_width_cm:"250"},{fabric_width_cm:{}},
    {pattern_repeat_mm:"0"},{pattern_repeat_mm:"Infinity"},
    {pattern_repeat_mm:-1},{pattern_repeat_mm:1001},
    {pattern_matching:"true"},{garment:"coat"},
    {checked_by:""},{checked_by:"X"},{evidence_reference:""},
    {evidence_reference:"ab"},{case_id:"A"},{fabric_id:""},
    {evidence_id:"not-uuid"},{order_id:"not-uuid"},
    {recipe_hash:"not-a-hash"},{created_at:"no date"},
    {created_at:"2026-11-02"},{revision_id:""},
    {note:null},{cut_context:null},
  ];
  for(const patch of corrupt){
    assert.throws(()=>verifyProductionCutLedger([{...row,...patch}]),
      /Invalid production cut evidence ledger/,
      "Rejected corrupt field "+Object.keys(patch)[0]);
  }
  for(const value of [null,{},false,"[]",[{...row},null]])
    assert.throws(()=>verifyProductionCutLedger(value),/Invalid operator production ledger response/);
});

test("duplicate evidence IDs, case IDs and order/garment cuts cannot be double counted",()=>{
  const row=sample(1),other=sample(2);
  for(const collision of [
    {...other,evidence_id:row.evidence_id},
    {...other,case_id:row.case_id},
    {...other,order_id:row.order_id},
  ])assert.throws(()=>verifyProductionCutLedger([row,collision]),
    /Invalid production cut evidence ledger/);
  // A single order may legitimately have one shirt AND one trouser cut.
  assert.equal(verifyProductionCutLedger([row,{...other,order_id:row.order_id,garment:"trouser"}]).length,2);
  assert.throws(()=>verifyProductionCutLedger([row,other],1),/Invalid operator production ledger response/);
});

test("operator GET verifies all upstream physical cuts before reporting any estimator readiness",()=>{
  const src=readFileSync("src/app/api/operator/production-calibration/route.ts","utf8");
  const validated=src.indexOf("verifyProductionCutLedger(rows,1000)");
  const mapped=src.indexOf("const cases=verifiedRows.map");
  const counted=src.indexOf("const shirts=cases.filter");
  assert.ok(validated>0&&mapped>validated&&counted>mapped);
  assert.match(src,/readyForModel:shirts\.length>=20&&trousers\.length>=20/);
  assert.match(src,/catch\(error\)\{\s*console\.error\("\[operator\/production-calibration:get\] request failed \(details redacted\)\."/);
  assert.match(src,/Production cut evidence could not be read\./);
});
