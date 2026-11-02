import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stockMutationNeedsReconciliation} from "../src/lib/designer/stock-mutation-reconciliation.ts";

test("uncertain physical stock writes require operator reconciliation before retry",()=>{
  assert.equal(stockMutationNeedsReconciliation(false,false,null),false);
  assert.equal(stockMutationNeedsReconciliation(true,false,null),true,"lost HTTP response");
  assert.equal(stockMutationNeedsReconciliation(true,false,200),true,"malformed successful ACK");
  assert.equal(stockMutationNeedsReconciliation(true,false,503),true,"upstream may commit before failure");
  assert.equal(stockMutationNeedsReconciliation(true,false,502),true);
  assert.equal(stockMutationNeedsReconciliation(true,false,423),false,"rollout gate rejected before RPC");
  assert.equal(stockMutationNeedsReconciliation(true,false,429),false,"explicit client rejection");
  assert.equal(stockMutationNeedsReconciliation(true,false,409),false,"definitive stock conflict");
  assert.equal(stockMutationNeedsReconciliation(true,false,401),false);
  assert.equal(stockMutationNeedsReconciliation(true,true,200),false,"verified action ACK");
  assert.equal(stockMutationNeedsReconciliation(true,true,503),false,"verified ACK dominates");
});

test("Stock Desk blocks repeat writes on ambiguous ACK until operator rechecks and reloads",()=>{
  const source=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  const post=source.split("  async function post(")[1]?.split("  const totalAvailable=")[0]??"";
  assert.match(post,/if\(uncertainWriteRef\.current\|\|uncertainWrite\|\|busy\|\|snapshotState!=="ready"\|\|!configured\|\|!mutationGate\.current\.enter\(\)\)/);
  assert.ok(post.indexOf("requestSent=true")<post.indexOf('fetch("/api/operator/stock"'));
  assert.ok(post.indexOf("httpStatus=response.status")<post.indexOf("const data:unknown=await response.json()"));
  assert.ok(post.indexOf("requireStockClientAcknowledgment(body.action,data)")<post.indexOf("acknowledged=true"));
  const failureBranch=post.split("}catch(error){")[1]?.split("finally{")[0]??"";
  assert.ok(failureBranch.indexOf("stockMutationNeedsReconciliation(requestSent,acknowledged,httpStatus)")<
    failureBranch.indexOf("setUncertainWrite(true)"),
    "only ambiguous HTTP outcomes enter the catch-block reconciliation lock");
  assert.ok(failureBranch.indexOf("uncertainWriteRef.current=true")<
    failureBranch.indexOf("setUncertainWrite(true)"),
    "synchronous uncertainty reference must lock before React state updates");
  assert.ok(post.indexOf("uncertainJournal.current.markPending()")<post.indexOf("requestSent=true"),
    "pending marker must persist before the privileged HTTP request");
  assert.ok(post.includes("if(!uncertainJournal.current.clearPending())"),
    "storage failure must not silently unlock stock writes");
  assert.ok(source.indexOf("uncertainWriteRef.current=false")<source.indexOf("setUncertainWrite(false)"));
  assert.match(post,/Stock write outcome is uncertain\. It may have committed\./);
  assert.equal((source.match(/disabled=\{uncertainWrite\|\|busy\|\|snapshotState!=="ready"/g)||[]).length,4,
    "all physical stock write buttons are held");
  assert.match(source,/A successful snapshot refresh alone does not prove whether the previous write committed/);
  assert.match(source,/I checked the ledger and source; refresh to unlock/);
  assert.ok(source.indexOf("if(await load())")<source.indexOf("setUncertainWrite(false)"),
    "operator reconciliation must re-read the ledger before unlocking");
});
