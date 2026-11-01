import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireOperatorClientMutationAck} from "../src/lib/designer/operator-client-mutation-ack.ts";

test("operator must not claim a quote/order status change unless backend confirmed updated true",()=>{
  for(const action of ["quote_status","order_status"]){
    assert.doesNotThrow(()=>requireOperatorClientMutationAck(action,{updated:true}));
    for(const payload of [
      {updated:false},{updated:null},{updated:"false"},{updated:1},
      {},[],null,undefined,true,false,"true",
      {updated:[]},{updated:{}},
    ]) assert.throws(
      ()=>requireOperatorClientMutationAck(action,payload),
      /Production status was not updated/,
      action+" "+JSON.stringify(payload),
    );
  }
  // Other create operations are independently verified by the production backend.
  assert.doesNotThrow(()=>requireOperatorClientMutationAck("create_quote",{}));
  assert.doesNotThrow(()=>requireOperatorClientMutationAck("create_order",{}));
});

test("Production Desk verifies status ACK and reloads before reporting success",()=>{
  const src=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const post=src.split("  async function post(")[1]?.split("  async function loadLockedDesign(")[0]??"";
  assert.match(src,/import \{ requireOperatorClientMutationAck \}/);
  assert.match(post,/requireOperatorClientMutationAck\(body\.action,data\)/);
  assert.ok(post.indexOf("requireOperatorClientMutationAck")<post.indexOf("setMessage(success)"));
  assert.ok(post.indexOf("await load()")<post.indexOf("setMessage(success)"));
  assert.match(src,/setConfigured\(false\)/);
  assert.match(src,/Production records could not be loaded/);
  assert.match(src,/disabled=\{busy\|\|!configured\}/);
  assert.match(src,/Refresh records/);
  assert.match(src,/e\.target\.value=""/);
  assert.doesNotMatch(post,/if\(!response\.ok\)[\s\S]*?setMessage\(success\);await load\(\)/);
});
