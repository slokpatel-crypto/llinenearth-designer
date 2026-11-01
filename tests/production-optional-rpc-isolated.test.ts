import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isMissingOptionalProductionRpc,validateOperatorLedgerRows} from "../src/lib/designer/operator-optional-rpc.ts";
import {publicOperatorPostError} from "../src/lib/designer/operator-production-errors.ts";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";

const json=(body:unknown,status=404)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json; charset=utf-8"},
});

test("only bounded literal PGRST202 HTTP 404 is a compatible absent optional function",async()=>{
  assert.equal(await isMissingOptionalProductionRpc(json({code:"PGRST202",message:"missing"})),true);
  for(const code of ["PGRST116","42501","PGRST205",null])
    assert.equal(await isMissingOptionalProductionRpc(json({code})),false);
  for(const status of [400,401,403,500,503])
    assert.equal(await isMissingOptionalProductionRpc(json({code:"PGRST202"},status)),false);
});

test("malformed, wrong MIME, gateway HTML and oversized errors never become empty evidence",async()=>{
  assert.equal(await isMissingOptionalProductionRpc(new Response("<html>not found</html>",{status:404,headers:{"content-type":"text/html"}})),false);
  assert.equal(await isMissingOptionalProductionRpc(new Response('{"code":"PGRST202"}',{status:404,headers:{"content-type":"text/plain"}})),false);
  for(const value of [[],null,{},true,"PGRST202"])
    assert.equal(await isMissingOptionalProductionRpc(json(value)),false);
  await assert.rejects(isMissingOptionalProductionRpc(new Response("{bad",{status:404,headers:{"content-type":"application/json"}})),SyntaxError);
  await assert.rejects(isMissingOptionalProductionRpc(json({code:"PGRST202",message:"x".repeat(5000)})),/exceeds allowed size/);
});

test("actual authenticated operator GET never swallows optional ledger failures",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const rpc=route.split("async function rpc<T>(")[1]?.split("async function loadVerifiedLockedRevision(")[0]??"";
  const get=route.split("export async function GET(){")[1]?.split("export async function POST(request:Request){")[0]??"";
  assert.match(rpc,/optional=false/);
  assert.match(rpc,/optional && await isMissingOptionalProductionRpc\(response\)/);
  assert.match(rpc,/throw new Error\("Production upstream request failed\."\)/);
  assert.doesNotMatch(rpc,/response\.text\(\)/);
  for(const name of ["finished_garment_qc_list","production_customer_outcome_list","production_order_learning_context_list"])
    assert.ok(get.includes('rpc<unknown[]>("'+name+'",'),name+" must be read explicitly");
  assert.equal((get.match(/,true,MAX_OPERATOR_LEDGER_BYTES\)/g)||[]).length,3);
  assert.doesNotMatch(get,/catch\s*\{\s*\/\/ Keep/);
  assert.match(get,/status:503/);
  assert.match(get,/GET failed \(details redacted\)/);
  assert.doesNotMatch(get,/console\.error\("\[operator\/production\]",error\)/);
  assert.match(route,/response\.headers\.set\("cache-control","private, no-store"\)/);
});

test("all five successful production ledgers require bounded arrays of row objects",()=>{
  assert.deepEqual(validateOperatorLedgerRows([],100),[]);
  assert.deepEqual(validateOperatorLedgerRows([{id:"real-db-id"},{id:"second"}],2),[{id:"real-db-id"},{id:"second"}]);
  for(const value of [null,undefined,{},true,"[]",1,[null],[false],[3],["x"],[[]],[{} ,null]])
    assert.throws(()=>validateOperatorLedgerRows(value,100),/Invalid operator production ledger response/);
  assert.throws(()=>validateOperatorLedgerRows([{},{}],1),/Invalid operator production ledger response/);
  for(const limit of [0,-1,1.5,NaN,Infinity])
    assert.throws(()=>validateOperatorLedgerRows([],limit),/Invalid operator production ledger response/);
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  for(const [name,limit] of [["quotes",100],["orders",100],["qcInspections",250],["customerOutcomes",250],["learningContexts",500]])
    assert.ok(route.includes("validateOperatorLedgerRows("+name+","+limit+")"),name+" must be checked before configured:true");
});


test("every authenticated production GET list is MIME-checked and decoded-byte bounded",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const rpc=route.split("async function rpc<T>(")[1]?.split("async function loadVerifiedLockedRevision(")[0]??"";
  const get=route.split("export async function GET(){")[1]?.split("export async function POST(request:Request){")[0]??"";
  assert.match(rpc,/mime!==\"application\/json\"/);
  assert.match(rpc,/readBoundedJsonResponse\(response,maxResponseBytes\)/);
  assert.match(route,/const MAX_OPERATOR_LEDGER_BYTES=8_388_608/);
  for(const name of ["production_quote_list","production_order_list","finished_garment_qc_list","production_customer_outcome_list","production_order_learning_context_list"]){
    const call=get.split(`\"${name}\"`)[1]?.split("\n")[0]??"";
    assert.match(call,/MAX_OPERATOR_LEDGER_BYTES/,name+" must bound decoded JSON");
  }
  assert.match(route,/return await response\.json\(\) as T/,"non-list legacy writes keep their response contract");
});


test("delivery status QC read is bounded and validated before any status mutation",()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const delivery=route.split('if(action==="order_status"){')[1]?.split('return privateProductionResponse({updated:Boolean(updated)});')[0]??"";
  assert.match(delivery,/rpc<unknown>\("finished_garment_qc_latest_for_order",\{p_order_id:orderId\},false,MAX_OPERATOR_LEDGER_BYTES\)/);
  assert.match(delivery,/validateOperatorLedgerRows\(rawInspections,2\)/);
  assert.ok(delivery.indexOf("validateOperatorLedgerRows")<delivery.indexOf("latestQcForOrder"),
    "validate QC envelope before selecting approval");
  assert.ok(delivery.indexOf("validateOperatorLedgerRows")<delivery.indexOf('"production_order_set_status"'),
    "validate QC envelope before any delivery write");
  assert.match(delivery,/latest\?\.decision!=="approved"/);
  assert.match(delivery,/latestQcForOrder\(inspections,orderId\)/);
  assert.match(delivery,/inspection_reference/);
});


test("order-specific QC SQL is bounded, tie-fail-closed and service-role-only",()=>{
  const sql=readFileSync("supabase/migrations/20261101_finished_garment_qc_order_scoped.sql","utf8");
  const latest=sql.split("create or replace function public.finished_garment_qc_latest_for_order(")[1]?.split("create or replace function public.production_order_set_status(")[0]??"";
  const status=sql.split("create or replace function public.production_order_set_status(")[1]??"";
  assert.match(latest,/where q\.order_id=p_order_id/);
  assert.match(latest,/order by q\.created_at desc,q\.inspection_id desc\s+limit 2/);
  assert.match(latest,/revoke all on function public\.finished_garment_qc_latest_for_order\(uuid\) from public,anon,authenticated/);
  assert.match(status,/where order_id=p_order_id\s+order by created_at desc,inspection_id desc limit 1/);
  assert.match(status,/where order_id=p_order_id and created_at=v_latest_at\s+limit 1 offset 1/);
  assert.match(status,/raise exception 'ambiguous latest finished-garment QC timestamp'/);
  assert.match(status,/revoke all on function public\.production_order_set_status\(uuid,text,text\) from public,anon,authenticated/);
});

test("operator POST error boundary exposes only authored validation messages",()=>{
  for(const message of [
    "Production backend is not configured.",
    "A valid locked-design recovery token is required.",
    "The locked design could not be verified for production.",
    "Invalid quote currency.",
    "Quote must contain 1 to 30 line items.",
    "Quote line item label is required.",
    "Invalid quote line item amount.",
    "Invalid quote adjustment.",
    "Quote total cannot be negative.",
  ]) assert.equal(publicOperatorPostError(new Error(message)),message);

  for(const failure of [
    new SyntaxError('Unexpected token in private customer recovery token: SECRET'),
    new Error('PostgreSQL private.production_orders row 123 leaked'),
    new Error('Failed to fetch https://private-db.example'),
    new Error('Internal PostgREST 42501 credentials'),
    new Error('SyntaxError: Invalid JSON'),
    new Error('invalid quote currency.'), // Exact allowlist only.
    'raw sensitive exception',
    {message:'Invalid quote currency.'},
    null,
    undefined,
  ]) assert.equal(publicOperatorPostError(failure),"Production operation failed.");

  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const post=route.split("export async function POST(request:Request){")[1]??"";
  assert.match(post,/return privateProductionResponse\(\{error:publicOperatorPostError\(error\)\},\{status:409\}\)/);
  assert.doesNotMatch(post,/error:error instanceof Error\?error\.message/);
  assert.doesNotMatch(post,/console\.error\("\[operator\/production\]",error\)/);
});

test("operator production POST bounds decoded JSON before any status or creation RPC",async()=>{
  const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
  const post=route.split("export async function POST(request:Request){")[1]??"";
  const parseAt=post.indexOf("readBoundedJsonResponse(request,MAX_OPERATOR_POST_BYTES)");
  const actionAt=post.indexOf('const action=String(body.action||"")');
  const statusAt=post.indexOf('if(action==="quote_status"){');
  assert.match(route,/const MAX_OPERATOR_POST_BYTES=262_144/);
  assert.ok(parseAt>=0&&parseAt<actionAt&&actionAt<statusAt,
    "streaming body bound must precede routing and all production RPC mutations");
  assert.match(post,/typeof rawBody!=="object"\|\|Array\.isArray\(rawBody\)/);
  assert.doesNotMatch(post,/await request\.json\(\)/);

  const ok=new Request("http://localhost/operator",{method:"POST",
    body:JSON.stringify({action:"quote_status",quoteId:"synthetic"})});
  assert.deepEqual(await readBoundedJsonResponse(ok,256),{
    action:"quote_status",quoteId:"synthetic",
  });
  const big=new Request("http://localhost/operator",{method:"POST",
    body:JSON.stringify({action:"quote_status",padding:"x".repeat(260)})});
  await assert.rejects(readBoundedJsonResponse(big,128),/exceeds allowed size/);
  await assert.rejects(readBoundedJsonResponse(new Request("http://localhost/operator",{
    method:"POST",body:"{bad",
  }),128),SyntaxError);
  await assert.rejects(readBoundedJsonResponse(new Request("http://localhost/operator",{
    method:"POST",
  }),128),/Invalid bounded JSON response/);
});
