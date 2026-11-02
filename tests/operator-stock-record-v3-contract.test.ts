import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeManualStockEvent} from "../src/lib/designer/stock-ledger.ts";

const route=()=>readFileSync("src/app/api/operator/stock/route.ts","utf8");
const client=()=>readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
test("manual record requires a nonempty bounded request key before service role RPC",()=>{
  const data={fabricId:"linen-a",eventType:"receipt",quantityMetres:1.123,recordedBy:"operator",sourceReference:"roll-sheet-17"};
  assert.throws(()=>normalizeManualStockEvent(data),/request key/i);
  assert.throws(()=>normalizeManualStockEvent({...data,requestKey:"short"}),/request key/i);
  assert.throws(()=>normalizeManualStockEvent({...data,requestKey:"x".repeat(181)}),/request key/i);
  assert.equal(normalizeManualStockEvent({...data,requestKey:"idempotent-attempt-123"}).requestKey,"idempotent-attempt-123");
});
test("actual manual record API supplies a validated key to v3, never v2",()=>{
  const s=route();const record=s.slice(s.indexOf('if(action==="record")'),s.indexOf('if(action==="reserve")'));
  assert.match(record,/normalizeManualStockEvent\(body\)/);
  assert.match(record,/fabric_stock_record_v3/);
  assert.match(record,/p_request_key:draft.requestKey/);
  assert.doesNotMatch(record,/fabric_stock_record_v2/);
});
test("manual record browser reuses one key for unchanged evidence, clears only after acknowledged success",()=>{
  const s=client();
  assert.match(s,/manualAttempt=useRef\(createStockManualAttemptTracker/);
  assert.match(s,/requestKey:manualAttempt\.current\.keyFor\(draft\)/);
  assert.doesNotMatch(s,/manualAttempt\.current=null/);
  assert.match(s,/stockMutationNeedsReconciliation/);
});
