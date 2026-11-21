import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

// Execute the actual route implementation with controlled identity responses.
// This is an HTTP-handler unit test, not a built-Next/browser acceptance test.
const source=readFileSync(new URL("../src/app/api/customer-auth/session/route.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

async function invoke(identity:()=>Promise<unknown>){
  const exports:Record<string,unknown>={};
  const response={
    json:(body:unknown,options?:{status?:number;headers?:Record<string,string>})=>({
      status:options?.status??200,body,headers:options?.headers??{},
    }),
  };
  const requireMock=(name:string)=>{
    if(name==="next/server") return {NextResponse:response};
    if(name==="@/lib/customer-auth") return {getCustomerIdentity:identity};
    throw new Error("Unexpected route import: "+name);
  };
  const load=new Function("require","exports",compiled);
  load(requireMock,exports);
  return (exports.GET as (request:Request)=>Promise<{status:number;body:unknown;headers:Record<string,string>}>)(new Request("https://example.invalid/api/customer-auth/session"));
}

test("identity service outage returns 503, private no-store and no upstream detail",async()=>{
  const previous=console.error;
  const logs:string[]=[];
  console.error=(...args:unknown[])=>{logs.push(args.map(String).join(" "));};
  try{
    const result=await invoke(async()=>{throw new Error("secret-provider-token");});
    assert.equal(result.status,503);
    assert.deepEqual(result.body,{customer:null,error:"Customer session temporarily unavailable."});
    assert.match(result.headers["cache-control"],/private.*no-store/);
    assert.equal(result.headers.pragma,"no-cache");
    assert.doesNotMatch(JSON.stringify(result)+logs.join(" " ),/secret-provider-token/);
  }finally{console.error=previous;}
});

test("ordinary signed-out identity remains HTTP 200 without cache",async()=>{
  const result=await invoke(async()=>null);
  assert.equal(result.status,200);
  assert.deepEqual(result.body,{customer:null});
  assert.match(result.headers["cache-control"],/private.*no-store/);
});

test("valid customer identity remains HTTP 200",async()=>{
  const customer={id:"customer-a",email:"a@example.invalid"};
  const result=await invoke(async()=>customer);
  assert.equal(result.status,200);
  assert.deepEqual(result.body,{customer});
});
