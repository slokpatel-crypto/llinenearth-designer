import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validProductionDeskResponse, selectProductionPacketRecords} from "../src/lib/designer/production-desk-ledger.ts";

const revisionId="LE-LOCK-20261001090000-ABCDEF123456";
const recipeHash="a".repeat(64);
const quoteId="123e4567-e89b-42d3-a456-426614174000";
const orderId="123e4567-e89b-42d3-a456-426614174001";
const createdAt="2026-10-30T10:00:00.000Z";
const quote={
  quote_id:quoteId,revision_id:revisionId,recipe_hash:recipeHash,
  currency:"INR",line_items:[{label:"Tailoring",amount:1200}],
  subtotal:1200,adjustment:0,total:1200,note:"",
  status:"accepted",created_at:createdAt,updated_at:createdAt,
};
const order={
  order_id:orderId,revision_id:revisionId,recipe_hash:recipeHash,
  quote_id:quoteId,status:"created",note:"",
  created_at:createdAt,updated_at:createdAt,
};
const envelope=(quotes:(typeof quote)[],orders:(typeof order)[])=>({
  configured:true,quotes,orders,
  qcInspections:[],customerOutcomes:[],learningContexts:[],
  optionalEvidenceSources:{
    qcInstalled:false,customerOutcomesInstalled:false,learningContextInstalled:false,
  },
});

test("J5 packet export must verify fresh private ledger, not cached React history",()=>{
  const source=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const fn=source.split("async function exportProductionPacket(){")[1]
    ?.split("const quoteRows=useMemo(")[0]||"";
  assert.match(fn,/if\(!loadedRevision\|\|!configured\|\|requiresWriteReview\|\|busy\|\|actionInFlight\.current\) return;/);
  assert.match(fn,/actionInFlight\.current=true;/);
  assert.match(fn,/setBusy\(true\)/);
  assert.match(fn,/await fetch\("\/api\/operator\/production",\{cache:"no-store"\}\)/);
  assert.match(fn,/if\(!response\.ok\) throw new Error/);
  assert.match(fn,/const fresh:unknown=await response\.json\(\)/);
  const validated=fn.indexOf("validProductionDeskResponse(fresh)");
  const selected=fn.indexOf("selectProductionPacketRecords(");
  const downloaded=fn.indexOf("download(");
  assert.ok(validated>=0&&selected>validated&&downloaded>selected,
    "Do not select or export from an unverified fresh response");
  assert.match(fn,/fresh\.quotes as Quote\[\],fresh\.orders as Order\[\]/);
  assert.doesNotMatch(fn,/\n\s*quotes,orders,loadedRevision/,
    "Previously displayed records must never be used for export");
  assert.match(fn,/finally\{actionInFlight\.current=false;setBusy\(false\);\}/);
  assert.match(source,/disabled=\{!configured\|\|requiresWriteReview\|\|busy\} onClick=\{\(\)=>void exportProductionPacket\(\)\}/);
});

test("J5 fresh verified capped history cannot attach a stale previously visible quote",()=>{
  const stale=envelope([quote],[order]);
  const fresh=envelope([],[order]);
  assert.equal(validProductionDeskResponse(stale),true);
  assert.equal(validProductionDeskResponse(fresh),true,
    "An older quote can be absent from the newest 100 without implying it was deleted");
  const before=selectProductionPacketRecords(stale.quotes,stale.orders,revisionId,recipeHash);
  assert.equal(before.quote?.quote_id,quoteId);
  const after=selectProductionPacketRecords(fresh.quotes,fresh.orders,revisionId,recipeHash);
  assert.equal(after.order?.order_id,orderId);
  assert.equal(after.quote,null,"Do not attach a quote that fresh verified history cannot prove");
  assert.equal(validProductionDeskResponse({...fresh,quotes:[{...quote,total:99}]}),false,
    "A malformed success-shaped GET cannot authorize a packet");
  assert.throws(()=>selectProductionPacketRecords([],[
    order,{...order,order_id:"123e4567-e89b-42d3-a456-426614174002"},
  ],revisionId,recipeHash),/Multiple production orders/);
});
