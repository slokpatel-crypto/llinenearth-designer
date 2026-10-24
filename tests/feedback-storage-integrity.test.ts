import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {makeFeedbackId,mergeDistinctDesignFeedback,validStoredFeedback} from "../src/lib/feedback-storage-integrity.ts";

const row={
  id:"FB-1",designId:"SD-one",specHash:"LE-SAME",rating:"love",
  reasons:["Strong overall direction"],note:"",createdAt:"2026-10-24T12:00:00.000Z",
  reviewStatus:"pending_review"
};
test("different saved designs sharing a locked spec retain independent human feedback",()=>{
  const second={...row,id:"FB-2",designId:"SD-two",rating:"needs_work"};
  assert.deepEqual(mergeDistinctDesignFeedback([row],second),[second,row]);
  const revised={...row,id:"FB-3",rating:"good"};
  assert.deepEqual(mergeDistinctDesignFeedback([row],revised),[revised]);
});
test("review revisions preserve other versions and the 100 row cap",()=>{
  const existing=Array.from({length:100},(_,i)=>({...row,designId:`SD-${i}`}));
  const latest={...row,designId:"SD-new"};
  const next=mergeDistinctDesignFeedback(existing,latest);
  assert.equal(next.length,100);
  assert.equal(next[0],latest);
  assert.equal(existing.length,100);
});
test("malformed nested or invalid local feedback is rejected before staff review",()=>{
  const bad=[null,{},false,{...row,reviewStatus:"approved"},
    {...row,rating:"excellent"},{...row,reasons:[null]},{...row,note:7},
    {...row,designId:""}];
  assert.deepEqual(validStoredFeedback([...bad,row]),[row]);
  assert.deepEqual(validStoredFeedback("bad JSON"),[]);
  assert.deepEqual(validStoredFeedback(Array.from({length:110},(_,i)=>({...row,id:`FB-${i}`}))).length,100);
});
test("cryptographic ID nonce differs across same-spec requests",()=>{
  const first=new Uint8Array(16),second=new Uint8Array(16);
  first[0]=1;second[0]=2;
  assert.notEqual(makeFeedbackId("LE-SAME",first),makeFeedbackId("LE-SAME",second));
  assert.match(makeFeedbackId("LE-SAME",first),/^FB-LE-SAME-[A-F0-9]{32}$/);
  assert.throws(()=>makeFeedbackId("LE-SAME",new Uint8Array(5)),/128 cryptographic bits/);
});
test("feedback writer uses composite request identity and safe browser reader",()=>{
  const source=readFileSync("src/lib/feedback.ts","utf8");
  assert.match(source,/validStoredFeedback<DesignFeedback>\(parsed\)/);
  assert.match(source,/mergeDistinctDesignFeedback\(existing,item\)/);
  assert.match(source,/window\.crypto\.getRandomValues\(new Uint8Array\(16\)\)/);
  assert.doesNotMatch(source,/filter\(\(x\)=>x\.specHash !== input\.specHash\)/);
});

test("saved-design rating never pretends local cache delivered feedback to staff",()=>{
  const source=readFileSync("src/components/SavedDesignsClient.tsx","utf8");
  assert.match(source,/Saved to this browser only/);
  assert.match(source,/not sent to Linen Earth staff/);
  assert.match(source,/feedbackError\?\.designId===active\.id/);
  assert.match(source,/role="alert"/);
  assert.match(source,/Feedback could not be saved in this browser/);
  assert.doesNotMatch(source,/Saved for human review\./);
});
