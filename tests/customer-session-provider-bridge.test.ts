import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

// Exercise the real provider bridge and real session handler together.
// This is an in-process HTTP-handler integration, not built-Next HTTP evidence.
function load(path:string, requireMock:(name:string)=>unknown){
  const source=readFileSync(new URL(path,import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:Record<string,unknown>={};
  new Function("require","exports",compiled)(requireMock,exports);
  return exports;
}

test("provider 429/503 remain outages while 401 is signed-out",async()=>{
  const previousUrl=process.env.SUPABASE_URL;
  const previousKey=process.env.SUPABASE_ANON_KEY;
  const previousFetch=globalThis.fetch;
  const previousLog=console.error;
  process.env.SUPABASE_URL="https://supabase.example.invalid";
  process.env.SUPABASE_ANON_KEY="test-anon-key";
  const logs:string[]=[];
  console.error=(...args:unknown[])=>{logs.push(args.map(String).join(" "));};
  try{
    const auth=load("../src/lib/customer-auth.ts",(name)=>{
      if(name==="server-only") return {};
      if(name==="@/lib/customer-account") return {normalizeCustomerEmail:(v:string)=>v};
      if(name==="@/lib/customer-session") return {
        CUSTOMER_SESSION_COOKIE:"le_session",
        verifySignedCustomerSession:()=>null,
      };
      throw new Error("Unexpected customer-auth import: "+name);
    });
    const route=load("../src/app/api/customer-auth/session/route.ts",(name)=>{
      if(name==="next/server") return {NextResponse:{json:(body:unknown,options?:{status?:number;headers?:Record<string,string>})=>({
        status:options?.status??200,body,headers:options?.headers??{},
      })}};
      if(name==="@/lib/customer-auth") return auth;
      throw new Error("Unexpected session route import: "+name);
    });
    const GET=route.GET as (request:Request)=>Promise<{status:number;body:unknown;headers:Record<string,string>}>;
    for(const [upstream,expected] of [[429,503],[503,503],[401,200]] as const){
      globalThis.fetch=async(input)=>{
        assert.equal(String(input),"https://supabase.example.invalid/auth/v1/user");
        return new Response("upstream-secret-token",{status:upstream});
      };
      const request=new Request("https://example.invalid/api/customer-auth/session",{
        headers:{cookie:"le_customer_access=legacy-test-token"},
      });
      const result=await GET(request);
      assert.equal(result.status,expected,"upstream "+upstream);
      assert.deepEqual(result.body,upstream===401?{customer:null}:{customer:null,error:"Customer session temporarily unavailable."});
      assert.match(result.headers["cache-control"],/private.*no-store/);
      assert.doesNotMatch(JSON.stringify(result)+logs.join(" "),"upstream-secret-token");
    }
  }finally{
    globalThis.fetch=previousFetch;
    console.error=previousLog;
    if(previousUrl===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=previousUrl;
    if(previousKey===undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY=previousKey;
  }
});
