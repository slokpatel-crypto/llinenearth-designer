import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validProductionDeskLedgers } from "../src/lib/designer/production-desk-ledger.ts";

const qid="123e4567-e89b-42d3-a456-426614174000";
const oid="123e4567-e89b-42d3-a456-426614174001";
const revisionId="LE-LOCK-20261001090000-ABCDEF123456";
const recipeHash="a".repeat(64);
const created="2026-10-30T10:00:00.000Z";
const updated="2026-10-30T10:01:00.000Z";
const quote={
  quote_id:qid,revision_id:revisionId,recipe_hash:recipeHash,
  currency:"INR",line_items:[{label:"Tailoring",amount:1200.12}],
  subtotal:1200.12,adjustment:-0.01,total:1200.11,
  note:"",status:"accepted",created_at:created,updated_at:updated,
};
const order={
  order_id:oid,revision_id:revisionId,recipe_hash:recipeHash,quote_id:qid,
  status:"created",note:"",created_at:updated,updated_at:updated,
};

test("J5 valid quote/order ledgers accept exact SQL receipt fields and capped history",()=>{
  assert.equal(validProductionDeskLedgers([],[]),true);
  assert.equal(validProductionDeskLedgers([quote],[order]),true);
  assert.equal(validProductionDeskLedgers([{...quote,quote_id:qid.toUpperCase()}],[order]),true);
  assert.equal(validProductionDeskLedgers([],[order]),true,"older linked quotes may be outside the newest 100");
  assert.equal(validProductionDeskLedgers([{...quote,line_items:[{label:"Historic detailed instruction ".repeat(9),amount:1.005}]}],[order]),true,"do not reject historic SQL-permitted labels or precision");
});

test("J5 rejects success-shaped malformed rows, dates, money and identifiers",()=>{
  const invalidQuotes=[
    {...quote,quote_id:[qid]}, {...quote,quote_id:" "+qid},
    {...quote,recipe_hash:["a".repeat(64)]},
    {...quote,status:"paid"}, {...quote,currency:["INR"]},
    {...quote,line_items:"[]"}, {...quote,line_items:[{label:["Tailoring"],amount:100}]},
    {...quote,line_items:[{label:"Tailoring",amount:"1200"}]},
    {...quote,total:"1200.11"}, {...quote,total:-1},
    {...quote,subtotal:Number.NaN}, {...quote,created_at:"2026-02-31T10:00:00Z"},
    {...quote,updated_at:"2026-10-29T10:00:00Z"},
    {...quote,note:null},
  ];
  for(const row of invalidQuotes) assert.equal(validProductionDeskLedgers([row],[order]),false,JSON.stringify(row));
  const invalidOrders=[
    {...order,order_id:{value:oid}}, {...order,order_id:" "+oid},
    {...order,quote_id:["123e4567-e89b-42d3-a456-426614174000"]},
    {...order,recipe_hash:"x".repeat(64)}, {...order,status:"paid"},
    {...order,created_at:"2026-02-31T10:00:00Z"},
    {...order,updated_at:created}, {...order,note:null},
  ];
  for(const row of invalidOrders) assert.equal(validProductionDeskLedgers([quote],[row]),false,JSON.stringify(row));
  assert.equal(validProductionDeskLedgers({rows:[quote]},[order]),false);
  assert.equal(validProductionDeskLedgers([quote],{rows:[order]}),false);
});

test("J5 duplicate, contradictory and impossible linked receipts cannot populate production desk",()=>{
  assert.equal(validProductionDeskLedgers([quote,{...quote,quote_id:qid.toUpperCase()}],[order]),false);
  assert.equal(validProductionDeskLedgers([quote],[order,{...order,order_id:oid.toUpperCase()}]),false);
  assert.equal(validProductionDeskLedgers([quote],[{...order,recipe_hash:"b".repeat(64)}]),false);
  assert.equal(validProductionDeskLedgers([{...quote,status:"void"}],[order]),false);
  assert.equal(validProductionDeskLedgers([{...quote,created_at:"2026-10-31T10:00:00Z",updated_at:"2026-10-31T10:01:00Z"}],[order]),false);
  assert.equal(validProductionDeskLedgers(Array.from({length:101},(_,i)=>({...quote,quote_id:qid})),[]),false);
  assert.equal(validProductionDeskLedgers([],Array.from({length:101},()=>order)),false);
});

test("operator route validates typed ledgers before returning them to UI",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const validation=route.indexOf("validProductionDeskLedgers(quotes,orders)");
  const response=route.indexOf("configured:true,quotes,orders");
  assert.ok(validation>0&&response>validation);
  assert.match(route,/import \{ validProductionDeskLedgers \} from "@\/lib\/designer\/production-desk-ledger"/);
  assert.match(route,/if\(!validProductionDeskLedgers\(quotes,orders\)\) throw/);
});
