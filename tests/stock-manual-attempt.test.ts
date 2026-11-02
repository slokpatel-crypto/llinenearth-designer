import test from "node:test";
import assert from "node:assert/strict";
import {createStockManualAttemptTracker} from "../src/lib/designer/stock-manual-attempt.ts";
const record={fabricId:"linen-a",eventType:"receipt",quantityMetres:3.125,
  note:"roll counted",recordedBy:"checker",sourceReference:"ROLL-0001"};
test("manual movements replay the exact original request key after ACK or refresh",()=>{
  let n=0;
  const tracker=createStockManualAttemptTracker(()=>String(++n).padStart(12,"0"));
  const first=tracker.keyFor(record);
  assert.equal(tracker.keyFor({...record}),first);
  assert.equal(tracker.keyFor({...record,note:" roll   counted "}),first);
  assert.equal(n,1);
});
test("different physical evidence never shares a manual stock request key",()=>{
  let n=0;
  const tracker=createStockManualAttemptTracker(()=>String(++n).padStart(12,"0"));
  const first=tracker.keyFor(record);
  for(const change of [{sourceReference:"ROLL-0002"},{quantityMetres:4.125},
    {eventType:"adjustment_out"},{recordedBy:"second checker"},
    {note:"new evidence"},{fabricId:"linen-b"}]){
    const changed=tracker.keyFor({...record,...change});
    assert.notEqual(changed,first);
    assert.equal(tracker.keyFor({...record,...change}),changed);
  }
});
