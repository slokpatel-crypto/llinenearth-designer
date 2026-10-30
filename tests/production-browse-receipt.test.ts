import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validProductionDeliveryBrowseReceipt, validProductionBrowseFirstTenAgreement } from "../src/lib/designer/production-browse-receipt.ts";

const orderId="00000000-0000-4000-8000-000000000001";
const evidenceId="10000000-0000-4000-8000-000000000001";
const order={order_id:orderId,revision_id:"locked-revision-1",recipe_hash:"a".repeat(64),
  status:"delivered",created_at:"2026-10-01T10:00:00Z",delivered_at:"2026-10-02T10:00:00Z"};
const audit={evidence_id:evidenceId,order_id:orderId,revision_id:order.revision_id,
  recipe_hash:order.recipe_hash,order_created_at:order.created_at,manual_design_reentry:false,
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
    null,{},[{...order,order_id:" "+orderId}], [{...order,order_id:[orderId]}],
    [{...order,created_at:"2026-02-31T10:00:00Z"}],
    [{...order,delivered_at:"2026-04-31T10:00:00Z"}],
    [{...order,status:null}], [{...order,status:"invented"}],
    [{...order,revision_id:null}], [{...order,revision_id:"  "}],
    [{...order,recipe_hash:{}}], [{...order,recipe_hash:"not-a-hash"}],
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
    [{...audit,revision_id:"another-locked-revision"}],
    [{...audit,recipe_hash:"b".repeat(64)}],
    [{...audit,order_created_at:"2026-10-01T10:00:01Z"}],
    [{...audit,order_created_at:"2026-10-04T10:00:00Z"}],
    [{...audit,manual_design_reentry:false,reentry_fields:["fabric_identity"]}],
    [{...audit,created_at:"2026-02-31T10:00:00Z"}],
    [audit,{...audit,evidence_id:evidenceId.toUpperCase()}],
    [...Array.from({length:501},(_,i)=>({...audit,evidence_id:`10000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`}))],
  ];
  for(const evidence of bad) assert.equal(validProductionDeliveryBrowseReceipt([order],evidence),false,
    "Invalid evidence accepted: "+JSON.stringify(evidence).slice(0,120));
});

test("browse history rejects delivery before booking and audits before physical delivery",()=>{
  // A successful RPC with calendar-valid but contradictory chronology is not
  // credible production evidence. A nullable legacy delivered_at remains
  // browsable, but its audit still cannot predate the order itself.
  assert.equal(validProductionDeliveryBrowseReceipt(
    [{...order,delivered_at:"2026-09-30T10:00:00Z"}],[audit]),false);
  assert.equal(validProductionDeliveryBrowseReceipt(
    [order],[{...audit,created_at:"2026-10-01T11:00:00Z"}]),false);
  assert.equal(validProductionDeliveryBrowseReceipt(
    [order],[{...audit,created_at:"2026-10-02T09:59:59Z"}]),false);
  assert.equal(validProductionDeliveryBrowseReceipt(
    [{...order,delivered_at:null}],[{...audit,created_at:"2026-09-30T10:00:00Z"}]),false);
  assert.equal(validProductionDeliveryBrowseReceipt(
    [order],[{...audit,created_at:order.delivered_at}]),true);
  // Evidence can refer to an older order omitted by the newest-500 browse
  // page. Its chronology cannot be checked without that source order.
  assert.equal(validProductionDeliveryBrowseReceipt([],[audit]),true);
  // Equivalent timezone encodings of the same immutable order instant match.
  assert.equal(validProductionDeliveryBrowseReceipt([order],[{
    ...audit,order_created_at:"2026-10-01T15:30:00+05:30",
  }]),true);
  // Even when the related order lies outside this browse page, its own
  // recorded creation cannot occur after its completion audit.
  assert.equal(validProductionDeliveryBrowseReceipt([],[{
    ...audit,order_created_at:"2026-10-04T10:00:00Z",
  }]),false);
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

test("authoritative first-ten and recent browsing cannot contradict overlapping receipts",()=>{
  const basis={version:"linen-earth-production-first-ten-audit-v2",historyValid:true,
    orders:[order],evidence:[audit]};
  assert.equal(validProductionBrowseFirstTenAgreement([order],[audit],basis),true);
  assert.equal(validProductionBrowseFirstTenAgreement([],[],basis),true);
  assert.equal(validProductionBrowseFirstTenAgreement([],[],{...basis,orders:[],evidence:[]}),true);
  assert.equal(validProductionBrowseFirstTenAgreement([],[],{...basis,historyValid:false}),true);
  assert.equal(validProductionBrowseFirstTenAgreement([{...order,recipe_hash:"b".repeat(64)}],[],basis),false);
  assert.equal(validProductionBrowseFirstTenAgreement([{...order,revision_id:"changed-revision"}],[],basis),false);
  assert.equal(validProductionBrowseFirstTenAgreement([{...order,created_at:"2026-10-01T10:00:01Z"}],[],basis),false);
  assert.equal(validProductionBrowseFirstTenAgreement([],[{...audit,note:"Changed"}],basis),false);
  assert.equal(validProductionBrowseFirstTenAgreement([],[{
    ...audit,manual_design_reentry:true,reentry_fields:["fabric_identity"],
  }],basis),false);
  assert.equal(validProductionBrowseFirstTenAgreement([order],[],{...basis,orders:[],evidence:[]}),false);
  assert.equal(validProductionBrowseFirstTenAgreement([{
    ...order,order_id:orderId.toUpperCase(),created_at:"2026-10-01T15:30:00+05:30",
  }],[{
    ...audit,evidence_id:evidenceId.toUpperCase(),order_id:orderId.toUpperCase(),
    created_at:"2026-10-03T15:30:00+05:30",
  }],basis),true);
});

test("operator server and client enforce separate-snapshot consistency",()=>{
  const route=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  const client=readFileSync("src/app/operator/production-evidence/ProductionEvidenceClient.tsx","utf8");
  assert.match(route,/validProductionBrowseFirstTenAgreement\(orders,evidence,firstTenBasis\)/);
  assert.match(client,/validProductionBrowseFirstTenAgreement\(nextOrders,nextEvidence,rawBasis\)/);
  assert.match(client,/item\.order_id\.toLowerCase\(\)/);
  assert.match(client,/item\.evidence_id\.toLowerCase\(\)/);
});
