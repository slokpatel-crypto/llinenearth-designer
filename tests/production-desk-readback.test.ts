import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {verifiedProductionMutationReadback as exactMutationReadback} from "../src/lib/designer/production-desk-readback.ts";

const quoteId="123e4567-e89b-42d3-a456-426614174031";
const orderId="123e4567-e89b-42d3-a456-426614174032";
const anotherId="123e4567-e89b-42d3-a456-426614174033";
const revisionId="LE-LOCKED-REVISION-20261031";
const recipeHash="a".repeat(64);
const quote={quote_id:quoteId,revision_id:revisionId,recipe_hash:recipeHash,
  currency:"INR",status:"draft",line_items:[{label:"Shirt fabric",amount:1200.12},{label:"Tailoring",amount:350.35}],
  subtotal:1550.47,adjustment:-0.01,total:1550.46,note:"Customer approved"};
const order={order_id:orderId,quote_id:quoteId,revision_id:revisionId,
  recipe_hash:recipeHash,status:"created"};
const context={order_id:orderId,revision_id:revisionId,recipe_hash:recipeHash,
  context:{version:"linen-earth-production-learning-context-v1"}};
function verifiedProductionMutationReadback(
  action:unknown,request:unknown,receipt:unknown,
  quotes:unknown,orders:unknown,contexts:unknown=[context],
):boolean{
  return exactMutationReadback(action,request,receipt,quotes,orders,contexts);
}


test("quote creation is never confirmed without the exact immutable quote and locked recipe",()=>{
  const body={action:"create_quote",revisionId,recipeHash,currency:"INR",
    lineItems:[{label:" Shirt fabric ",amount:1200.12},{label:"Tailoring",amount:350.35}],
    adjustment:-0.01,note:" Customer approved "};
  const receipt={quoteId,lockedRevisionVerified:true};
  assert.equal(verifiedProductionMutationReadback("create_quote",body,receipt,[quote],[]),true);
  assert.equal(verifiedProductionMutationReadback("create_quote",body,receipt,[],[]),false);
  assert.equal(verifiedProductionMutationReadback("create_quote",body,receipt,
    [{...quote,quote_id:anotherId}],[]),false);
  assert.equal(verifiedProductionMutationReadback("create_quote",body,receipt,
    [{...quote,revision_id:"DIFFERENT-REVISION"}],[]),false);
  assert.equal(verifiedProductionMutationReadback("create_quote",body,receipt,
    [{...quote,recipe_hash:"b".repeat(64)}],[]),false);
  assert.equal(verifiedProductionMutationReadback("create_quote",body,receipt,
    [{...quote,currency:"USD"}],[]),false);
  assert.equal(verifiedProductionMutationReadback("create_quote",body,
    {...receipt,quoteId:" "+quoteId},[quote],[]),false);
  assert.equal(verifiedProductionMutationReadback("create_quote",body,
    {...receipt,lockedRevisionVerified:false},[quote],[]),false);
  assert.equal(verifiedProductionMutationReadback("create_quote",
    {...body,recipeHash:recipeHash.toUpperCase()},receipt,[quote],[]),true);
});


test("new quote success requires the exact operator-entered prices, lines, adjustment and note",()=>{
  const body={action:"create_quote",revisionId,recipeHash,currency:"INR",
    lineItems:[{label:" Shirt fabric ",amount:1200.12},{label:"Tailoring",amount:350.35}],
    adjustment:-0.01,note:" Customer approved "};
  const receipt={quoteId,lockedRevisionVerified:true};
  const verify=(saved:unknown,requested:unknown=body)=>
    verifiedProductionMutationReadback("create_quote",requested,receipt,[saved],[]);
  assert.equal(verify(quote),true,"Trimmed labels/notes preserve legitimate normalized writes");
  assert.equal(verify({...quote,line_items:[{label:"Shirt fabric",amount:1200.11},{label:"Tailoring",amount:350.36}]}),false,
    "Equal subtotal cannot hide changed customer line prices");
  assert.equal(verify({...quote,line_items:[...quote.line_items].reverse()}),false,
    "Reordered line items cannot silently change quote meaning");
  assert.equal(verify({...quote,line_items:[{label:"Shirt fabric",amount:1200.12}]}),false);
  assert.equal(verify({...quote,line_items:[{label:"Shirt fabric",amount:1200.12},{label:"Fabric",amount:350.35}]}),false);
  assert.equal(verify({...quote,adjustment:0,total:1550.47}),false);
  assert.equal(verify({...quote,subtotal:1550.48,total:1550.47}),false);
  assert.equal(verify({...quote,total:1550.45}),false);
  assert.equal(verify({...quote,note:"Different customer instruction"}),false);
  assert.equal(verify({...quote,status:"sent"}),false,
    "A newly created quote must be in draft state at confirmation");
  assert.equal(verify({...quote,line_items:[{label:"Shirt fabric",amount:"1200.12"},quote.line_items[1]]}),false);
  assert.equal(verify(quote,{...body,lineItems:[{label:"Shirt fabric",amount:1200.12}]}),false);
  assert.equal(verify(quote,{...body,lineItems:[{label:"Shirt fabric",amount:-2}]}),false);
  assert.equal(verify(quote,{...body,note:["Customer approved"]}),false);
});

test("order creation readback binds exact order, revision, hash and quote association",()=>{
  const body={action:"create_order",revisionId,recipeHash,quoteId};
  const receipt={orderId,lockedRevisionVerified:true,learningContextAttached:true};
  assert.equal(verifiedProductionMutationReadback("create_order",body,receipt,[],[order]),true);
  assert.equal(verifiedProductionMutationReadback("create_order",body,receipt,[],[]),false);
  assert.equal(verifiedProductionMutationReadback("create_order",body,receipt,[],
    [{...order,order_id:anotherId}]),false);
  assert.equal(verifiedProductionMutationReadback("create_order",body,receipt,[],
    [{...order,quote_id:null}]),false);
  assert.equal(verifiedProductionMutationReadback("create_order",body,receipt,[],[order],[]),false,
    "A created order without the matching durable design context is not confirmed");
  assert.equal(verifiedProductionMutationReadback("create_order",body,receipt,[],[order],
    [{...context,order_id:anotherId}]),false);
  assert.equal(verifiedProductionMutationReadback("create_order",body,receipt,[],[order],
    [{...context,recipe_hash:"b".repeat(64)}]),false);
  assert.equal(verifiedProductionMutationReadback("create_order",body,receipt,[],
    [{...order,revision_id:"DIFFERENT"}]),false);
  assert.equal(verifiedProductionMutationReadback("create_order",body,
    {...receipt,learningContextAttached:false},[],[order]),false);
  assert.equal(verifiedProductionMutationReadback("create_order",body,
    {...receipt,orderId:{orderId}},[],[order]),false);
  assert.equal(verifiedProductionMutationReadback("create_order",
    {...body,quoteId:""},receipt,[],[{...order,quote_id:null}]),true);
  assert.equal(verifiedProductionMutationReadback("create_order",
    {...body,quoteId:""},receipt,[],[order]),false);
  assert.equal(verifiedProductionMutationReadback("create_order",
    {...body,quoteId:"not-a-uuid"},receipt,[],[order]),false);
});

test("quote and order status responses require exact record and requested new state",()=>{
  const accepted={...quote,status:"accepted"},delivered={...order,status:"delivered"};
  assert.equal(verifiedProductionMutationReadback("quote_status",
    {quoteId,status:"accepted"},{updated:true},[accepted],[]),true);
  assert.equal(verifiedProductionMutationReadback("quote_status",
    {quoteId,status:"accepted"},{updated:true},[quote],[]),false);
  assert.equal(verifiedProductionMutationReadback("quote_status",
    {quoteId,status:"accepted"},{updated:true},[{...accepted,quote_id:anotherId}],[]),false);
  assert.equal(verifiedProductionMutationReadback("order_status",
    {orderId,status:"delivered"},{updated:true},[],[delivered]),true);
  assert.equal(verifiedProductionMutationReadback("order_status",
    {orderId,status:"delivered"},{updated:true},[],[order]),false);
  assert.equal(verifiedProductionMutationReadback("order_status",
    {orderId,status:"delivered"},{updated:false},[],[delivered]),false);
  assert.equal(verifiedProductionMutationReadback("order_status",
    {orderId:" "+orderId,status:"delivered"},{updated:true},[],[delivered]),false);
  for(const invalid of [null,{},[],true]){
    assert.equal(verifiedProductionMutationReadback("quote_status",
      {quoteId,status:"accepted"},invalid,[accepted],[]),false);
  }
  assert.equal(verifiedProductionMutationReadback("other",
    {quoteId,status:"accepted"},{updated:true},[accepted],[]),false);
});

test("operator production UI requires exact readback before displaying saved mutation",()=>{
  const ui=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const post=ui.split("async function post(")[1].split("async function loadLockedDesign(")[0];
  const load=ui.split("async function load(")[1].split("useEffect(()=>")[0];
  assert.match(ui,/verifiedProductionMutationReadback/);
  assert.match(load,/validProductionDeskResponse\(data\)/);
  assert.match(load,/if\(readVersion!==ledgerReadVersion\.current\) return false/);
  assert.match(load,/verifiedProductionMutationReadback\(/);
  assert.match(load,/expected\.action,expected\.body,expected\.receipt,data\.quotes,data\.orders,data\.learningContexts/);
  assert.match(load,/if\(expected&&\(!data\.configured/);
  const receipt=post.indexOf("validProductionDeskMutationReceipt(body.action,data)");
  const readback=post.indexOf("const confirmed=await load({action:body.action,body,receipt:data});");
  const success=post.indexOf("if(confirmed)setMessage(success);");
  assert.ok(receipt>=0&&readback>receipt&&success>readback,
    "No saved quote/order/status success may be shown before exact fresh ledger proof");
  assert.match(ui,/The mutation may have been saved, but its exact quote\/order history could not be verified/);
  assert.doesNotMatch(post,/setMessage\(success\);await load\(\)/);
});
