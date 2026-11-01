import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isMissingOptionalProductionRpc} from "../src/lib/designer/operator-optional-rpc.ts";

const route=readFileSync("src/app/api/operator/production/route.ts","utf8");
const json404=(body:unknown,status=404)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json; charset=utf-8"},
});

test("only literal bounded PGRST202 404 allows legacy missing optional RPC",async()=>{
  assert.equal(await isMissingOptionalProductionRpc(json404({
    code:"PGRST202",message:"Could not find the function",
  })),true);
  assert.equal(await isMissingOptionalProductionRpc(json404({
    code:"PGRST116",message:"No rows",
  })),false);
  assert.equal(await isMissingOptionalProductionRpc(json404({
    code:"42501",message:"permission denied",
  })),false);
  assert.equal(await isMissingOptionalProductionRpc(json404({
    code:"PGRST202",message:"Unexpected non-404 error",
  },503)),false);
  assert.equal(await isMissingOptionalProductionRpc(json404({
    code:"PGRST202",
  },400)),false);
});

test("gateway HTML, wrong MIME, malformed JSON and oversized 404 never become empty evidence",async()=>{
  assert.equal(await isMissingOptionalProductionRpc(new Response("<html>404</html>",{
    status:404,headers:{"content-type":"text/html"},
  })),false);
  assert.equal(await isMissingOptionalProductionRpc(new Response('{"code":"PGRST202"}',{
    status:404,headers:{"content-type":"text/plain"},
  })),false);
  assert.equal(await isMissingOptionalProductionRpc(json404([])),false);
  assert.equal(await isMissingOptionalProductionRpc(json404(null)),false);
  await assert.rejects(isMissingOptionalProductionRpc(new Response("{broken",{
    status:404,headers:{"content-type":"application/json"},
  })),SyntaxError);
  await assert.rejects(isMissingOptionalProductionRpc(json404({
    code:"PGRST202",message:"x".repeat(5_000),
  })),/exceeds allowed size/);
});

test("real operator GET fails closed on all optional errors except verified missing RPC",()=>{
  const rpc=route.split("async function rpc<T>(")[1]?.split("async function loadVerifiedLockedRevision(")[0]??"";
  const get=route.split("export async function GET(){")[1]?.split("export async function POST(request:Request){")[0]??"";
  assert.match(rpc,/optional=false/);
  assert.match(rpc,/if\(optional && await isMissingOptionalProductionRpc\(response\)\) return \[\] as/);
  assert.match(rpc,/throw new Error\("Production upstream request failed\."\)/);
  assert.match(get,/rpc\("production_quote_list",\{p_limit:100\}\)/);
  assert.match(get,/rpc\("production_order_list",\{p_limit:100\}\)/);
  for(const name of ["finished_garment_qc_list","production_customer_outcome_list",
    "production_order_learning_context_list"]){
    assert.ok(get.includes('rpc<unknown[]>("'.concat(name,'",'))&&
      get.includes(name+'",{p_limit:'),"optional evidence RPC must be explicitly listed");
  }
  assert.equal((get.match(/,true\)/g)||[]).length,3);
  assert.doesNotMatch(get,/catch\s*\{\s*\/\/ Keep/);
  assert.match(get,/status:503/);
  assert.match(get,/cache-control":"private, no-store"/);
});
