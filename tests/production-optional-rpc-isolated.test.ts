import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isMissingOptionalProductionRpc,validateOperatorLedgerRows} from "../src/lib/designer/operator-optional-rpc.ts";

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
  assert.match(delivery,/rpc<unknown>\("finished_garment_qc_list",\{p_limit:500\},false,MAX_OPERATOR_LEDGER_BYTES\)/);
  assert.match(delivery,/validateOperatorLedgerRows\(rawInspections,500\)/);
  assert.ok(delivery.indexOf("validateOperatorLedgerRows")<delivery.indexOf("latestQcForOrder"),
    "validate QC envelope before selecting approval");
  assert.ok(delivery.indexOf("validateOperatorLedgerRows")<delivery.indexOf('"production_order_set_status"'),
    "validate QC envelope before any delivery write");
  assert.match(delivery,/latest\?\.decision!=="approved"/);
  assert.match(delivery,/latestQcForOrder\(inspections,orderId\)/);
  assert.match(delivery,/inspection_reference/);
});
