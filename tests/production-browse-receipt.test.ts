import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validProductionDeliveryBrowseReceipt } from "../src/lib/designer/production-browse-receipt.ts";

const orderId="00000000-0000-4000-8000-000000000001";
const evidenceId="10000000-0000-4000-8000-000000000001";
const order={order_id:orderId,revision_id:"locked-revision-1",recipe_hash:"a".repeat(64),
  status:"delivered",created_at:"2026-10-01T10:00:00Z",delivered_at:"2026-10-02T10:00:00Z"};
const audit={evidence_id:evidenceId,order_id:orderId,manual_design_reentry:false,
  reentry_fields:[],note:"",operator:"Checker",evidence_reference:"job-card-1",
  created_at:"2026-10-03T10:00:00Z"};

test("empty and well-formed bounded browse receipts remain compatible",()=>{
  assert.equal(validProductionDeliveryBrowseReceipt([],[]),true);
  assert.equal(validProductionDeliveryBrowseReceipt([order],[audit]),true);
  assert.equal(validProductionDeliveryBrowseReceipt(
    [{...order,order_id:orderId.toUpperCase(),delivered_at:null}],
    [{...audit,evidence_id:evidenceId.toUpperCase(),reentry_fields:null,operator:null,note:null,evidence_reference:null}],
  ),true);
  // A capped browse page is not first-ten authority, but remains a valid queue.
  assert.equal(validProductionDeliveryBrowseReceipt(Array.from({length:500},(_,i)=>({
    ...order,order_id:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`,
  })),[]),true);
});

test("malformed, duplicated or coerced operator browse orders fail closed",()=>{
  const bad=[
    null,[],{},[{...order,order_id:" "+orderId}], [{...order,order_id:[orderId]}],
    [{...order,created_at:"2026-02-31T10:00:00Z"}],
    [{...order,delivered_at:"2026-04-31T10:00:00Z"}],
    [{...order,status:null}], [{...order,revision_id:null}],
    [{...order,recipe_hash:{}}],
    [order,{...order,order_id:orderId.toUpperCase()}],
    [...Array.from({length:501},(_,i)=>({...order,order_id:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`}))],
    [null],
  ];
  for(const orders of bad) assert.equal(validProductionDeliveryBrowseReceipt(orders,[audit]),false,
    "Invalid orders accepted: "+JSON.stringify(orders).slice(0,120));
});

test("malformed, duplicated or coerced evidence cannot appear as a safe audit",()=>{
  const bad=[
    null,{},[null],[{...audit,evidence_id:" "+evidenceId}],
    [{...audit,order_id:[orderId]}],
    [{...audit,manual_design_reentry:"false"}],
    [{...audit,reentry_fields:"fabric_identity"}],
    [{...audit,reentry_fields:["invented_field"]}],
    [{...audit,note:{}}], [{...audit,operator:[]}],
    [{...audit,evidence_reference:42}],
    [{...audit,created_at:"2026-02-31T10:00:00Z"}],
    [audit,{...audit,evidence_id:evidenceId.toUpperCase()}],
    [...Array.from({length:501},(_,i)=>({...audit,evidence_id:`10000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`}))],
  ];
  for(const evidence of bad) assert.equal(validProductionDeliveryBrowseReceipt([order],evidence),false,
    "Invalid evidence accepted: "+JSON.stringify(evidence).slice(0,120));
});

test("server and operator UI reject malformed success-shaped browse lists",()=>{
  const route=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  const client=readFileSync("src/app/operator/production-evidence/ProductionEvidenceClient.tsx","utf8");
  assert.match(route,/validProductionDeliveryBrowseReceipt\(orders,evidence\)/);
  assert.match(route,/Production completion evidence could not be read/);
  assert.match(client,/validProductionDeliveryBrowseReceipt\(data\.orders,data\.evidence\)/);
  assert.match(client,/setLoadError\(true\)/);
  assert.match(client,/setOrders\(\[\]\);\s*setEvidence\(\[\]\)/);
});
