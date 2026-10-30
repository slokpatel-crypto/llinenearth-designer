import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FINISHED_GARMENT_QC_CHECKS } from "../src/lib/designer/finished-garment-qc.ts";
import { validGarmentQcDeskResponse } from "../src/lib/designer/garment-qc-ledger.ts";

const orderId="123e4567-e89b-42d3-a456-426614174000";
const inspectionId="123e4567-e89b-42d3-a456-426614174001";
const revisionId="locked-revision-2026-10-31";
const recipeHash="a".repeat(64);
const order={order_id:orderId,revision_id:revisionId,recipe_hash:recipeHash,quote_id:null,
  status:"ready",note:"",created_at:"2026-10-30T08:00:00Z",updated_at:"2026-10-30T09:00:00Z"};
const checks=Object.fromEntries(FINISHED_GARMENT_QC_CHECKS.map(check=>[check.id,true]));
const inspection={inspection_id:inspectionId,order_id:orderId,revision_id:revisionId,recipe_hash:recipeHash,
  decision:"approved",checks,defects:[],note:"",inspector:"Tailor QC",
  inspection_reference:"QC sheet 42",created_at:"2026-10-30T10:00:00Z"};
const good={configured:true,orders:[order],inspections:[inspection]};

test("J5 QC screen accepts typed physical receipts and honest unconfigured/legacy histories",()=>{
  assert.equal(validGarmentQcDeskResponse(good),true);
  assert.equal(validGarmentQcDeskResponse({configured:false,orders:[],inspections:[]}),true);
  assert.equal(validGarmentQcDeskResponse({...good,inspections:[{...inspection,inspector:"",inspection_reference:""}]}),true,
    "old SQL-valid QC remains visible but cannot prove physical approval");
  assert.equal(validGarmentQcDeskResponse({...good,orders:[],inspections:[inspection]}),true,
    "older QC evidence can refer to an order outside the independently capped order page");
  assert.equal(validGarmentQcDeskResponse({...good,configured:false}),false);
});

test("J5 QC screen rejects forged, duplicate, impossible or contradictory production evidence",()=>{
  for(const malformed of [null,{}, {orders:[],inspections:[]}, {...good,orders:{}},
    {...good,inspections:{}}, {...good,orders:[order,order]}, {...good,inspections:[inspection,inspection]},
    {...good,orders:[{...order,order_id:[orderId]}]},
    {...good,orders:[{...order,status:"invented"}]},
    {...good,inspections:[{...inspection,inspection_id:[inspectionId]}]},
    {...good,inspections:[{...inspection,decision:["approved"]}]},
    {...good,inspections:[{...inspection,checks:{"recipe_match":"true"}}]},
    {...good,inspections:[{...inspection,checks:{...checks,recipe_match:false}}]},
    {...good,inspections:[{...inspection,defects:["stitching",false]}]},
    {...good,inspections:[{...inspection,inspector:["Tailor QC"]}]},
    {...good,inspections:[{...inspection,inspection_reference:{value:"QC sheet 42"}}]},
    {...good,inspections:[{...inspection,created_at:"2026-02-31T10:00:00Z"}]},
    {...good,inspections:[{...inspection,created_at:"2026-10-29T10:00:00Z"}]},
    {...good,inspections:[{...inspection,revision_id:"another-revision"}]},
    {...good,inspections:[{...inspection,recipe_hash:"b".repeat(64)}]},
    {...good,inspections:[{...inspection,decision:"rework",defects:[],note:""}]},
  ]) assert.equal(validGarmentQcDeskResponse(malformed),false,JSON.stringify(malformed));
});

test("J5 QC screen requires descending source chronology, not a stale first approved event",()=>{
  const earlier={...inspection,inspection_id:"123e4567-e89b-42d3-a456-426614174002",
    decision:"rework",checks:{},defects:["stitching"],created_at:"2026-10-30T09:30:00Z"};
  assert.equal(validGarmentQcDeskResponse({...good,inspections:[inspection,earlier]}),true);
  assert.equal(validGarmentQcDeskResponse({...good,inspections:[earlier,inspection]}),false);
});

test("QC HTTP and browser independently validate typed receipts and invalidate stale state",()=>{
  const route=readFileSync("src/app/api/operator/garment-qc/route.ts","utf8");
  const ui=readFileSync("src/app/operator/garment-qc/GarmentQcClient.tsx","utf8");
  assert.match(route,/validGarmentQcDeskResponse\(\{configured:true,orders,inspections\}\)/);
  assert.match(ui,/if\(!validGarmentQcDeskResponse\(data\)\)/);
  for(const reset of ["setConfigured(false)","setOrders([])","setInspections([])","setSelectedOrderId(\"\")"])
    assert.ok(ui.includes(reset),reset);
  assert.match(ui,/verifiedOperatorProductionCreateId\(data\?\.inspectionId\)/);
  assert.match(ui,/LEGACY \/ UNVERIFIED/);
});
