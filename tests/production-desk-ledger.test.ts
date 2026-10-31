import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validProductionDeskLedgers, validProductionDeskResponse, validProductionDeskMutationReceipt, sameProductionRecordId, sameProductionRecipeHash, selectProductionPacketRecords } from "../src/lib/designer/production-desk-ledger.ts";

const qid="123e4567-e89b-42d3-a456-426614174000";
const oid="123e4567-e89b-42d3-a456-426614174001";
const revisionId="LE-LOCK-20261001090000-ABCDEF123456";
const recipeHash="a".repeat(64);
const created="2026-10-30T10:00:00.000Z";
const updated="2026-10-30T10:01:00.000Z";
const quote={
  quote_id:qid,revision_id:revisionId,recipe_hash:recipeHash,
  currency:"INR",line_items:[{label:"Tailoring",amount:1200.12}],
  subtotal:1200.12,adjustment:-0.01,total:1200.11,
  note:"",status:"accepted",created_at:created,updated_at:updated,
};
const order={
  order_id:oid,revision_id:revisionId,recipe_hash:recipeHash,quote_id:qid,
  status:"created",note:"",created_at:updated,updated_at:updated,
};

test("J5 valid quote/order ledgers accept exact SQL receipt fields and capped history",()=>{
  assert.equal(validProductionDeskLedgers([],[]),true);
  assert.equal(validProductionDeskLedgers([quote],[order]),true);
  assert.equal(validProductionDeskLedgers([{...quote,quote_id:qid.toUpperCase()}],[order]),true);
  assert.equal(validProductionDeskLedgers([],[order]),true,"older linked quotes may be outside the newest 100");
  assert.equal(validProductionDeskLedgers([{...quote,line_items:[{label:"Historic detailed instruction ".repeat(9),amount:1.005}],subtotal:1.01,adjustment:-0.01,total:1.00}],[order]),true,"do not reject historic SQL-permitted labels or precision");
});

test("J5 rejects success-shaped malformed rows, dates, money and identifiers",()=>{
  const invalidQuotes=[
    {...quote,quote_id:[qid]}, {...quote,quote_id:" "+qid},
    {...quote,recipe_hash:["a".repeat(64)]},
    {...quote,status:"paid"}, {...quote,currency:["INR"]},
    {...quote,line_items:"[]"}, {...quote,line_items:[{label:["Tailoring"],amount:100}]},
    {...quote,line_items:[{label:"Tailoring",amount:"1200"}]},
    {...quote,total:"1200.11"}, {...quote,total:-1},
    {...quote,total:100}, {...quote,subtotal:100},
    {...quote,subtotal:Number.NaN}, {...quote,created_at:"2026-02-31T10:00:00Z"},
    {...quote,updated_at:"2026-10-29T10:00:00Z"},
    {...quote,note:null},
  ];
  for(const row of invalidQuotes) assert.equal(validProductionDeskLedgers([row],[order]),false,JSON.stringify(row));
  const invalidOrders=[
    {...order,order_id:{value:oid}}, {...order,order_id:" "+oid},
    {...order,quote_id:["123e4567-e89b-42d3-a456-426614174000"]},
    {...order,recipe_hash:"x".repeat(64)}, {...order,status:"paid"},
    {...order,created_at:"2026-02-31T10:00:00Z"},
    {...order,updated_at:created}, {...order,note:null},
  ];
  for(const row of invalidOrders) assert.equal(validProductionDeskLedgers([quote],[row]),false,JSON.stringify(row));
  assert.equal(validProductionDeskLedgers({rows:[quote]},[order]),false);
  assert.equal(validProductionDeskLedgers([quote],{rows:[order]}),false);
});

test("J5 duplicate, contradictory and impossible linked receipts cannot populate production desk",()=>{
  assert.equal(validProductionDeskLedgers([quote,{...quote,quote_id:qid.toUpperCase()}],[order]),false);
  assert.equal(validProductionDeskLedgers([quote],[order,{...order,order_id:oid.toUpperCase()}]),false);
  assert.equal(validProductionDeskLedgers([quote],[{...order,recipe_hash:"b".repeat(64)}]),false);
  assert.equal(validProductionDeskLedgers([{...quote,status:"void"}],[order]),false);
  assert.equal(validProductionDeskLedgers([{...quote,created_at:"2026-10-31T10:00:00Z",updated_at:"2026-10-31T10:01:00Z"}],[order]),false);
  assert.equal(validProductionDeskLedgers(Array.from({length:101},(_,i)=>({...quote,quote_id:qid})),[]),false);
  assert.equal(validProductionDeskLedgers([],Array.from({length:101},()=>order)),false);
});

test("operator route validates typed ledgers before returning them to UI",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const validation=route.indexOf("validProductionDeskLedgers(quotes,orders)");
  const response=route.indexOf("configured:true,quotes,orders");
  assert.ok(validation>0&&response>validation);
  assert.match(route,/import \{ validProductionDeskLedgers, validProductionDeskResponse, validProductionQcOrderRows \} from "@\/lib\/designer\/production-desk-ledger"/);
  assert.match(route,/if\(!validProductionDeskLedgers\(quotes,orders\)\) throw/);
});

test("J5 operator HTTP envelope fails closed on forged success, missing evidence sources and malformed ledgers",()=>{
  const configured={
    configured:true,quotes:[quote],orders:[order],
    qcInspections:[],customerOutcomes:[],learningContexts:[],
    optionalEvidenceSources:{qcInstalled:false,customerOutcomesInstalled:false,learningContextInstalled:false},
  };
  assert.equal(validProductionDeskResponse(configured),true);
  assert.equal(validProductionDeskResponse({configured:false,quotes:[],orders:[]}),true);
  assert.equal(validProductionDeskResponse({...configured,quotes:[{...quote,total:100}]}),false);
  assert.equal(validProductionDeskResponse({...configured,orders:[{...order,status:"invented"}]}),false);
  assert.equal(validProductionDeskResponse({...configured,configured:"true"}),false);
  assert.equal(validProductionDeskResponse({...configured,optionalEvidenceSources:undefined}),false);
  assert.equal(validProductionDeskResponse({...configured,optionalEvidenceSources:{qcInstalled:"false",customerOutcomesInstalled:false,learningContextInstalled:false}}),false);
  assert.equal(validProductionDeskResponse({...configured,qcInspections:null}),false);
  assert.equal(validProductionDeskResponse({...configured,qcInspections:[{}]}),false,"an uninstalled optional source cannot claim records");
  assert.equal(validProductionDeskResponse({...configured,customerOutcomes:[{}]}),false);
  assert.equal(validProductionDeskResponse({...configured,learningContexts:[{}]}),false);
  assert.equal(validProductionDeskResponse({configured:false,quotes:[quote],orders:[]}),false);
  assert.equal(validProductionDeskResponse({configured:false,quotes:[],orders:[],qcInspections:[]}),false);
});

test("J5 operator browser independently validates network receipts and clears old recovery identity",()=>{
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  const guard=client.indexOf("if(!validProductionDeskResponse(data))");
  const setQuotes=client.indexOf("setQuotes(data.quotes as Quote[])");
  assert.ok(guard>0&&setQuotes>guard,"the client cannot trust a successful HTTP JSON array without the typed receipt guard");
  assert.match(client,/setConfigured\(data\.configured\)/);
  assert.doesNotMatch(client,/setConfigured\(data\.configured!==false\)/);
  // Recovery must clear previously selected production identities and must not
  // enable any export or mutation from a merely success-shaped HTTP response.
  assert.ok(client.includes('import { verifyLockedDesignRevision, type LockedDesignRevision } from "@/lib/designer/design-lock";'));
  assert.ok(client.includes('setLoadedRevision(null);\\n    setQuote((current)=>({...current,revisionId:"",recipeHash:""}));\\n    setOrder((current)=>({...current,revisionId:"",recipeHash:"",quoteId:""}));'.replaceAll('\\n','\n')));
  const cryptographicGuard=client.indexOf("await verifyLockedDesignRevision(data.revision)");
  const loaded=client.indexOf("setLoadedRevision(revision)");
  assert.ok(cryptographicGuard>0&&loaded>cryptographicGuard,"unverified vault payload cannot populate production selection");
  assert.ok(client.includes("if(!response.ok||!data?.revision||!await verifyLockedDesignRevision(data.revision))"));
  assert.match(client,/value=\{recoveryToken\} disabled=\{busy\} onChange=\{\(e\)=>\{/);
  assert.match(client,/setRecoveryToken\(e\.target\.value\);\s*setLoadedRevision\(null\)/);
  assert.match(client,/setOrder\(\(current\)=>\(\{\.\.\.current,revisionId:revision\.revisionId,recipeHash:revision\.recipeHash,quoteId:""\}\)\)/);
});

test("J5 installed optional evidence must contain typed rows, not arbitrary success-shaped objects",()=>{
  const qc={
    inspection_id:"123e4567-e89b-42d3-a456-426614174002",order_id:oid,
    decision:"approved",inspector:"Tailor A",inspection_reference:"QC-2026-01",created_at:updated,
  };
  const outcome={
    outcome_id:"123e4567-e89b-42d3-a456-426614174003",order_id:oid,
    revision_id:revisionId,overall_rating:"good",fit_result:"clean_first_fit",
    worn_confirmed:true,note:"",created_at:updated,
  };
  const context={
    order_id:oid,revision_id:revisionId,recipe_hash:recipeHash,
    context:{version:"linen-earth-production-learning-context-v1",revisionId,recipeHash},created_at:updated,
  };
  const valid={
    configured:true,quotes:[quote],orders:[order],
    qcInspections:[qc],customerOutcomes:[outcome],learningContexts:[context],
    optionalEvidenceSources:{qcInstalled:true,customerOutcomesInstalled:true,learningContextInstalled:true},
  };
  assert.equal(validProductionDeskResponse(valid),true);
  // A valid-looking optional 200 row must not rewrite the visible order's
  // physical chronology or immutable recipe, even when the QC desk itself
  // has a separate stricter delivery-approval gate.
  const beforeOrder="2026-10-30T10:00:30.000Z";
  const linkedQc={...qc,revision_id:revisionId,recipe_hash:recipeHash};
  assert.equal(validProductionDeskResponse({...valid,qcInspections:[linkedQc]}),true);
  assert.equal(validProductionDeskResponse({...valid,qcInspections:[{...linkedQc,recipe_hash:recipeHash.toUpperCase()}]}),true,
    "PostgreSQL hashes may have equivalent uppercase hex");
  assert.equal(validProductionDeskResponse({...valid,qcInspections:[{...qc,inspector:null,inspection_reference:null}]}),true,
    "historical nullable physical provenance remains readable, not approved");
  for(const forged of [
    {...qc,created_at:beforeOrder},
    {...linkedQc,revision_id:"LE-LOCK-20261001090000-OTHER123456"},
    {...linkedQc,recipe_hash:"b".repeat(64)},
    {...linkedQc,recipe_hash:[recipeHash]},
  ]){
    assert.equal(validProductionDeskResponse({...valid,qcInspections:[forged]}),false,JSON.stringify(forged));
  }
  assert.equal(validProductionDeskResponse({...valid,customerOutcomes:[{...outcome,created_at:beforeOrder}]}),false,
    "customer outcome cannot precede its visible production order");
  assert.equal(validProductionDeskResponse({...valid,learningContexts:[{...context,created_at:beforeOrder}]}),false,
    "learning context cannot precede its visible production order");
  assert.equal(validProductionDeskResponse({...valid,qcInspections:[{...linkedQc,order_id:"123e4567-e89b-42d3-a456-426614174099",created_at:beforeOrder}]}),true,
    "independently capped order pages cannot certify chronology of older omitted orders");
  assert.equal(validProductionDeskResponse({...valid,qcInspections:[{...qc,decision:"invented"}]}),false);
  assert.equal(validProductionDeskResponse({...valid,qcInspections:[{...qc,created_at:"2026-02-31T10:00:00Z"}]}),false);
  assert.equal(validProductionDeskResponse({...valid,qcInspections:[qc,{...qc}]}),false);
  assert.equal(validProductionDeskResponse({...valid,customerOutcomes:[{...outcome,overall_rating:null}]}),false,
    "the UI must not call replaceAll on a forged rating");
  assert.equal(validProductionDeskResponse({...valid,customerOutcomes:[{...outcome,fit_result:["good"]}]}),false);
  assert.equal(validProductionDeskResponse({...valid,customerOutcomes:[{...outcome,overall_rating:"excellent"}]}),false);
  assert.equal(validProductionDeskResponse({...valid,customerOutcomes:[{...outcome,fit_result:"invented"}]}),false);
  assert.equal(validProductionDeskResponse({...valid,customerOutcomes:[{...outcome,worn_confirmed:"true"}]}),false);
  assert.equal(validProductionDeskResponse({...valid,customerOutcomes:[outcome,{...outcome}]}),false);
  assert.equal(validProductionDeskResponse({...valid,learningContexts:[{...context,context:[]}]}),false);
  assert.equal(validProductionDeskResponse({...valid,learningContexts:[{...context,recipe_hash:"wrong"}]}),false);
  assert.equal(validProductionDeskResponse({...valid,learningContexts:[{...context,context:{}}]}),false);
  assert.equal(validProductionDeskResponse({...valid,learningContexts:[{...context,context:{...context.context,recipeHash:"b".repeat(64)}}]}),false);
  assert.equal(validProductionDeskResponse({...valid,learningContexts:[{...context,context:{...context.context,version:"invented"}}]}),false);
  assert.equal(validProductionDeskResponse({...valid,learningContexts:[{...context,order_id:null}]}),false);
  assert.equal(validProductionDeskResponse({...valid,customerOutcomes:[{...outcome,revision_id:"LE-LOCK-20261001090000-OTHER123456"}]}),false,
    "outcome cannot claim another visible order's locked revision");
  assert.equal(validProductionDeskResponse({...valid,learningContexts:[{
    ...context,recipe_hash:"b".repeat(64),context:{...context.context,recipeHash:"b".repeat(64)},
  }]}),false,"self-consistent context cannot contradict the visible order hash");
  assert.equal(validProductionDeskResponse({...valid,orders:[]}),true,
    "older optional evidence may be outside the independently capped order page");
  assert.equal(validProductionDeskResponse({...valid,qcInspections:[]}),true,"empty installed source is valid");
  assert.equal(validProductionDeskResponse({...valid,qcInspections:[{...qc,inspector:null,inspection_reference:null}]}),true,
    "older unapproved QC provenance remains visible but cannot prove delivery");
});

test("J5 server rejects malformed installed optional rows before returning a successful operator ledger",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const guard=route.indexOf("if(!validProductionDeskResponse(receipt))");
  const response=route.indexOf('return NextResponse.json(receipt,{headers:');
  assert.ok(guard>0&&response>guard);
  assert.match(route,/Malformed optional production evidence receipts/);
});


test("J5 operator browser rejects unconfirmed mutation receipts despite HTTP 200",()=>{
  assert.equal(validProductionDeskMutationReceipt("create_quote",{quoteId:qid,lockedRevisionVerified:true}),true);
  assert.equal(validProductionDeskMutationReceipt("create_order",{orderId:oid,learningContextAttached:true,lockedRevisionVerified:true}),true);
  assert.equal(validProductionDeskMutationReceipt("quote_status",{updated:true}),true);
  assert.equal(validProductionDeskMutationReceipt("order_status",{updated:true}),true);
  for(const forged of [
    {action:"create_quote",receipt:{quoteId:[qid],lockedRevisionVerified:true}},
    {action:"create_quote",receipt:{quoteId:qid,lockedRevisionVerified:"true"}},
    {action:"create_quote",receipt:{lockedRevisionVerified:true}},
    {action:"create_order",receipt:{orderId:oid,learningContextAttached:false,lockedRevisionVerified:true}},
    {action:"create_order",receipt:{orderId:oid,learningContextAttached:true,lockedRevisionVerified:false}},
    {action:"create_order",receipt:{orderId:" "+oid,learningContextAttached:true,lockedRevisionVerified:true}},
    {action:"order_status",receipt:{updated:"true"}},
    {action:"quote_status",receipt:{updated:false}},
    {action:"unknown",receipt:{updated:true}},
    {action:"quote_status",receipt:null},
    {action:"order_status",receipt:[]},
  ]) assert.equal(validProductionDeskMutationReceipt(forged.action,forged.receipt),false,JSON.stringify(forged));
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(client,/if\(!validProductionDeskMutationReceipt\(body\.action,data\)\)/);
  assert.match(client,/Production operation receipt could not be verified/);
});

test("J5 operator packet and evidence links use canonical UUID and hash identity",()=>{
  assert.equal(sameProductionRecordId(oid,oid.toUpperCase()),true);
  assert.equal(sameProductionRecordId(oid," "+oid),false);
  assert.equal(sameProductionRecordId(oid,[oid]),false);
  assert.equal(sameProductionRecordId(null,null),false);
  assert.equal(sameProductionRecipeHash(recipeHash,recipeHash.toUpperCase()),true);
  assert.equal(sameProductionRecipeHash(recipeHash,"b".repeat(64)),false);
  assert.equal(sameProductionRecipeHash(recipeHash,[recipeHash]),false);
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(client,/sameProductionRecordId\(outcome\.order_id,item\.order_id\)/);
  assert.match(client,/sameProductionRecordId\(context\.order_id,item\.order_id\)/);
  assert.match(client,/sameProductionRecipeHash\(item\.recipe_hash,loadedRevision\.recipeHash\)/);
  assert.match(client,/sameProductionRecipeHash\(item\.recipe_hash,order\.recipeHash\)/);
});

test("J5 packet export only links an order to its actual immutable quote receipt",()=>{
  const unrelated={...quote,quote_id:"123e4567-e89b-42d3-a456-426614174002"};
  const matching={...quote,quote_id:qid.toUpperCase(),recipe_hash:recipeHash.toUpperCase()};
  const selected=selectProductionPacketRecords([unrelated,matching],[order],revisionId,recipeHash);
  assert.equal(selected.order?.order_id,oid);
  assert.equal(selected.quote?.quote_id,matching.quote_id,
    "a newer unrelated accepted quote for the same recipe must not enter this order's packet");
  assert.equal(selectProductionPacketRecords([unrelated],[order],revisionId,recipeHash).quote,null,
    "a linked quote outside the independently capped list is unverified, not substituted");
  assert.equal(selectProductionPacketRecords([{...quote,status:"draft"}],[order],revisionId,recipeHash).quote,null,
    "a quote not currently accepted cannot be attached as approved order evidence");
  assert.equal(selectProductionPacketRecords([quote],[{...order,quote_id:null}],revisionId,recipeHash).quote,null,
    "an unquoted order must never inherit a separate quote for the same recipe");
  assert.equal(selectProductionPacketRecords([quote],[],revisionId,recipeHash).quote?.quote_id,qid);
  assert.equal(selectProductionPacketRecords([],[],revisionId,recipeHash).order,null);
});

test("J5 packet export refuses ambiguous order or quote identities",()=>{
  const secondOrder={...order,order_id:"123e4567-e89b-42d3-a456-426614174003",quote_id:null};
  assert.throws(()=>selectProductionPacketRecords([quote],[order,secondOrder],revisionId,recipeHash),
    /Multiple production orders/);
  assert.throws(()=>selectProductionPacketRecords([quote,{...quote,quote_id:"123e4567-e89b-42d3-a456-426614174004"}],[],revisionId,recipeHash),
    /Multiple quotes/);
  assert.equal(selectProductionPacketRecords([
    {...quote,status:"draft"},quote,
  ],[],revisionId,recipeHash).quote?.status,"accepted",
    "a uniquely accepted quote remains selectable without an order");
  assert.throws(()=>selectProductionPacketRecords([quote],[],revisionId,"not-a-hash"),/verified locked recipe/);
  const client=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(client,/selectProductionPacketRecords\(\s*quotes,orders,loadedRevision\.revisionId,loadedRevision\.recipeHash/);
  assert.doesNotMatch(client,/const quoteMatch=quotes\.find/);
});
