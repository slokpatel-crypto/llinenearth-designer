import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  verifyProductionDeliveryOrders,
  verifyProductionDeliveryAudits,
} from "../src/lib/designer/production-delivery-ledger-validation.ts";

const uuid=(i:number)=>`00000000-0000-4000-8000-${i.toString(16).padStart(12,"0")}`;
const order=(i:number)=>({
  order_id:uuid(i),revision_id:"LE-REV-"+i,recipe_hash:"a".repeat(64),
  quote_id:null,status:"delivered",note:"",
  created_at:"2026-10-01T10:00:00+00:00",
  updated_at:"2026-10-02T10:00:00+00:00",
});
const audit=(i:number)=>({
  evidence_id:uuid(100+i),order_id:uuid(i),revision_id:"LE-REV-"+i,
  recipe_hash:"a".repeat(64),manual_design_reentry:false,
  reentry_fields:[],note:"",operator:"Named checker",
  evidence_reference:"Dispatch card "+i,
  created_at:"2026-10-03T10:00:00+00:00",
  order_created_at:"2026-10-01T10:00:00+00:00",
});

test("private delivery ledger verifies distinct orders and valid real receipt payloads",()=>{
  const orders=verifyProductionDeliveryOrders([order(1),order(2)]);
  const receipts=verifyProductionDeliveryAudits([audit(1),audit(2)]);
  assert.equal(orders.length,2);
  assert.equal(receipts.length,2);
  assert.equal(orders[0].status,"delivered");
  assert.equal(receipts[0].manual_design_reentry,false);
  assert.equal(receipts[0].order_id,orders[0].order_id);
});

test("historical delivery audit missing human provenance is visible but never forged",()=>{
  const legacy=verifyProductionDeliveryAudits([{
    ...audit(1),operator:null,evidence_reference:undefined,
  }]);
  assert.equal(legacy[0].operator,"");
  assert.equal(legacy[0].evidence_reference,"");
});

test("order duplicates, corrupt statuses, fake recipe hashes and invalid chronology fail closed",()=>{
  for(const rows of [
    [order(1),order(1)],
    [order(1),{...order(1),status:"cutting"}],
    [{...order(1),order_id:"duplicate"}],
    [{...order(1),status:"not-really-delivered"}],
    [{...order(1),recipe_hash:"bad"}],
    [{...order(1),created_at:"broken"}],
    [{...order(1),updated_at:"2026-09-30T00:00:00Z"}],
    [{...order(1),quote_id:"not-uuid"}],
    [{...order(1),note:null}],
  ])assert.throws(()=>verifyProductionDeliveryOrders(rows),
    /Invalid private production delivery ledger/,
    JSON.stringify(rows[0]));
});

test("duplicate or malformed completion receipts cannot become zero-reentry evidence",()=>{
  for(const rows of [
    [audit(1),audit(1)],
    [audit(1),{...audit(2),order_id:audit(1).order_id}],
    [{...audit(1),evidence_id:"not-uuid"}],
    [{...audit(1),manual_design_reentry:"false"}],
    [{...audit(1),manual_design_reentry:null}],
    [{...audit(1),reentry_fields:"fabric_identity"}],
    [{...audit(1),reentry_fields:["unknown-field"]}],
    [{...audit(1),created_at:"2026-09-01T00:00:00Z"}],
    [{...audit(1),order_created_at:"NaN"}],
    [{...audit(1),operator:{"leak":true}}],
    [{...audit(1),evidence_reference:42}],
    [{...audit(1),recipe_hash:"not-a-hash"}],
  ])assert.throws(()=>verifyProductionDeliveryAudits(rows),
    /Invalid private production delivery ledger/);
});

test("ledger transport bounded to 500 and rejects non-list or null objects",()=>{
  for(const input of [null,{},false,[null],Array.from({length:501},(_,i)=>order(i+1))])
    assert.throws(()=>verifyProductionDeliveryOrders(input),
      /Invalid operator production ledger response/);
  for(const input of [null,{},false,[null],Array.from({length:501},(_,i)=>audit(i+1))])
    assert.throws(()=>verifyProductionDeliveryAudits(input),
      /Invalid operator production ledger response/);
});

test("private delivery GET rejects invalid ledger before reporting configured success",()=>{
  const api=readFileSync("src/app/api/operator/production-evidence/route.ts","utf8");
  assert.match(api,/orders:verifyProductionDeliveryOrders\(orders\)/);
  assert.match(api,/evidence:verifyProductionDeliveryAudits\(evidence\)/);
  assert.match(api,/Production completion evidence could not be read/);
  assert.match(api,/cache-control","private, no-store"/);
});
