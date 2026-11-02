import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createStockManualAttemptTracker} from "../src/lib/designer/stock-manual-attempt.ts";

const draft={fabricId:"linen-plain-60-sky-blue",eventType:"receipt",
  quantityMetres:2.125,recordedBy:"Physical checker",sourceReference:"Roll tag 7",note:"Real count"};

test("manual stock retries keep the same request key until a verified ACK",()=>{
  let count=0;
  const tracker=createStockManualAttemptTracker(()=>`synthetic-manual-key-${++count}`);
  const first=tracker.keyFor(draft);
  assert.equal(tracker.keyFor({...draft}),first);
  tracker.confirmed({...draft,quantityMetres:3});
  assert.equal(tracker.keyFor(draft),first);
  tracker.confirmed(draft);
  assert.notEqual(tracker.keyFor(draft),first);
  assert.equal(count,2);
});

test("changed fabric, event, metres, checker, source or note gets a fresh key",()=>{
  let n=0;
  const tracker=createStockManualAttemptTracker(()=>`manual-${++n}`);
  let previous=tracker.keyFor(draft);
  for(const next of [
    {...draft,fabricId:"another-fabric"},{...draft,eventType:"adjustment_in"},
    {...draft,quantityMetres:2.126},{...draft,recordedBy:"Another checker"},
    {...draft,sourceReference:"Another roll"},{...draft,note:"Corrected count"},
  ]){
    const key=tracker.keyFor(next);
    assert.notEqual(key,previous);
    assert.equal(tracker.keyFor(next),key);
    previous=key;
  }
  assert.equal(n,7);
});

test("manual Stock Desk sends stable key and confirms only after valid backend ACK",()=>{
  const ui=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  const route=readFileSync("src/app/api/operator/stock/route.ts","utf8");
  const post=ui.split("  async function post(")[1]?.split("  const totalAvailable=")[0]??"";
  assert.match(ui,/createStockManualAttemptTracker\(\(\)=>crypto\.randomUUID\(\)\)/);
  assert.match(ui,/requestKey:manualAttempt\.current\.keyFor\(draft\)/);
  assert.ok(post.indexOf("requireStockClientAcknowledgment(body.action,data)")<
    post.indexOf("manualAttempt.current.confirmed(manualDraft)"));
  assert.ok(post.indexOf("manualAttempt.current.confirmed(manualDraft)")<
    post.indexOf("const refreshed=await load()"));
  assert.match(route,/normalizeManualStockRequest\(body\)/);
  assert.match(route,/rpc<string>\("fabric_stock_record_v3"/);
  assert.match(route,/p_request_key:draft\.requestKey/);
  assert.doesNotMatch(route,/fabric_stock_record_v2/);
});
