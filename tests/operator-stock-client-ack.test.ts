import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createOperatorMutationGate} from "../src/lib/designer/operator-mutation-gate.ts";
import {requireStockClientAcknowledgment} from "../src/lib/designer/operator-stock-client-ack.ts";

const uuid="b287e470-0e90-4fd4-b5fb-976eecebd244";

test("stock client never infers a successful physical mutation from HTTP 200 alone",()=>{
  for(const [action,value] of [
    ["record",{eventId:uuid}],["reserve",{reservationId:uuid}],
    ["release",{released:true}],["consume",{consumed:true}],
  ])assert.doesNotThrow(()=>requireStockClientAcknowledgment(action,value));
  const invalid:unknown[]=[
    null,undefined,{},[],false,true,"true",
    {eventId:null,reservationId:null,released:false,consumed:false},
    {eventId:"not-a-uuid",reservationId:"false",released:"true",consumed:1},
  ];
  for(const action of ["record","reserve","release","consume"]){
    for(const value of invalid)
      assert.throws(()=>requireStockClientAcknowledgment(action,value),
        /Stock response could not be verified/,action+" "+JSON.stringify(value));
  }
  for(const [action,value] of [
    ["record",{eventId:null}],["record",{eventId:"not-uuid"}],
    ["reserve",{reservationId:{id:uuid}}],
    ["release",{released:false}],["release",{released:"true"}],
    ["consume",{consumed:0}],["consume",{consumed:"true"}],
    ["invalid",{eventId:uuid,released:true,consumed:true}],
  ])assert.throws(()=>requireStockClientAcknowledgment(action,value),
    /Stock response could not be verified/);
});

test("stock client gate refuses synchronous double submit and releases after errors",async()=>{
  const gate=createOperatorMutationGate();
  assert.equal(gate.enter(),true);
  assert.equal(gate.enter(),false);
  try{await assert.rejects(Promise.reject(new Error("synthetic request failed"))); }
  finally{gate.exit();}
  assert.equal(gate.enter(),true);
  gate.exit();
});

test("Stock Desk acquires single-flight before fetch and validates ACK before success message",()=>{
  const s=readFileSync("src/app/operator/stock/StockClient.tsx","utf8");
  const post=s.split("  async function post(")[1]?.split("  const totalAvailable=")[0]??"";
  assert.match(s,/useRef\(createOperatorMutationGate\(\)\)/);
  assert.match(post,/uncertainWriteRef\.current\|\|uncertainWrite\|\|busy\|\|snapshotState!=="ready"\|\|!configured\|\|!mutationGate\.current\.enter\(\)/);
  assert.ok(post.indexOf("mutationGate.current.enter()")<post.indexOf('fetch("/api/operator/stock"'));
  assert.ok(post.indexOf("requireStockClientAcknowledgment(body.action,data)")<
    post.indexOf("const refreshed=await load()"));
  assert.ok(post.indexOf("const refreshed=await load()")<
    post.indexOf("setMessage(refreshed?success:"));
  assert.match(post,/finally\{[\s\S]*mutationGate\.current\.exit\(\);setBusy\(false\);/);
  assert.ok(post.indexOf("uncertainJournal.current.clearPending()")<
    post.indexOf("mutationGate.current.exit();setBusy(false);"),
    "pending stock state must be resolved before the client-side mutation gate unlocks");
  assert.match(post,/const data:unknown=await response\.json\(\)/);
});
