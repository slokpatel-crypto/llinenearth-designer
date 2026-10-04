import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url),Module=require("node:module"),nativeLoad=Module._load;
Module._load=function(name:string,...args:unknown[]){if(name==="server-only")return {};return nativeLoad.call(this,name,...args);};
const {load}=require("../scripts/designer-test-loader.cjs"),api=load("src/app/api/designer/creative-profile/route.ts"),session=load("src/lib/customer-session.ts"),ledger=load("src/lib/designer/creative-profile-server.ts"),cron=load("src/app/api/cron/designer-research/route.ts"),spec=load("src/lib/designer/creative-spec.ts"),engine=load("src/lib/designer/engine.ts"),creative=load("src/lib/designer/creative-engine.ts");
Module._load=nativeLoad;
const shirt=engine.DESIGNER_SHIRTS[0],pant=engine.DESIGNER_PANTS[0],concept=spec.attachCreativeCraft(creative.generateCreativeDirections({shirt,pant,style:engine.designerStyleForOccasion("Casual"),context:{climate:"Not specified",intention:"Balanced"},occasion:"Casual",limit:1}),{...spec.DEFAULT_CRAFT_REQUEST,surface:"embroidery"})[0];
test("creative account and scheduler HTTP handlers enforce ownership, consent, reset and the daily atomic claim",async t=>{
  const names=["SUPABASE_URL","SUPABASE_SECRET_KEY","SUPABASE_SERVICE_ROLE_KEY","LINEN_CUSTOMER_SESSION_SECRET","CRON_SECRET"],previous=Object.fromEntries(names.map(n=>[n,process.env[n]])),originalFetch=globalThis.fetch;
  process.env.SUPABASE_URL="https://creative-qa.invalid";process.env.SUPABASE_SECRET_KEY="sb_secret_test_only";process.env.LINEN_CUSTOMER_SESSION_SECRET="creative-qa-session-secret-never-for-production";process.env.CRON_SECRET="creative-qa-cron-secret";
  const rows:Array<Record<string,any>>=[];let clock=Date.now();
  globalThis.fetch=async(input:any,init:any={})=>{
    const url=new URL(String(input));assert.equal(url.hostname,"creative-qa.invalid","No provider/network calls permitted");
    if(init.method==="POST"){
      const row=JSON.parse(init.body);if(rows.some(r=>r.id===row.id))return Response.json({code:"23505"},{status:409});
      row.received_at=new Date(++clock).toISOString();rows.push(row);return Response.json([row],{status:201});
    }
    let result=rows.filter(r=>(!url.searchParams.get("payload->>customerId")||r.payload.customerId===url.searchParams.get("payload->>customerId")!.slice(3))&&(!url.searchParams.get("payload->>subtype")||r.payload.subtype===url.searchParams.get("payload->>subtype")!.slice(3)));
    if(url.searchParams.get("type")==="eq.customer_updated")result=result.filter(r=>r.type==="customer_updated");
    return Response.json([...result].reverse().slice(0,Number(url.searchParams.get("limit")||1000)));
  };
  t.after(()=>{globalThis.fetch=originalFetch;for(const n of names){if(previous[n]===undefined)delete process.env[n];else process.env[n]=previous[n];}});
  const request=(owner:string|null,body?:Record<string,unknown>,origin="https://linen-qa.invalid")=>new Request("https://linen-qa.invalid/api/designer/creative-profile",{method:body?"POST":"GET",headers:{...(owner?{cookie:`le_customer_session=${session.createSignedCustomerSession({id:owner,email:null})}`}:{ }),origin,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
  await t.test("guest state is explicit and cannot persist reviews",async()=>{assert.equal((await (await api.GET(request(null))).json()).authenticated,false);assert.equal((await api.POST(request(null,{action:"review"}))).status,401);});
  await t.test("forged owner and cross-origin writes are rejected before persistence",async()=>{assert.equal((await api.POST(request("11111111-1111-4111-8111-111111111111",{owner:"22222222-2222-4222-8222-222222222222",action:"preferences",preferences:{...spec.DEFAULT_CRAFT_PREFERENCES,enabled:true}}))).status,409);assert.equal((await api.POST(request("11111111-1111-4111-8111-111111111111",{owner:"11111111-1111-4111-8111-111111111111",action:"reset"},"https://evil.invalid"))).status,403);assert.equal(rows.length,0);});
  await t.test("review consent is required and preferences persist to only the signed owner",async()=>{
    assert.equal((await api.POST(request("11111111-1111-4111-8111-111111111111",{owner:"11111111-1111-4111-8111-111111111111",action:"review",conceptId:concept.id,rating:"up",reason:"visual_balance",craft:concept.craft}))).status,409);
    assert.equal((await api.POST(request("11111111-1111-4111-8111-111111111111",{owner:"11111111-1111-4111-8111-111111111111",action:"preferences",customerId:"22222222-2222-4222-8222-222222222222",preferences:{...spec.DEFAULT_CRAFT_PREFERENCES,enabled:true}}))).status,200);
    assert.equal((await (await api.GET(request("11111111-1111-4111-8111-111111111111"))).json()).preferences.enabled,true);assert.equal((await (await api.GET(request("22222222-2222-4222-8222-222222222222"))).json()).preferences.enabled,false);assert.equal(rows[0].payload.customerId,"11111111-1111-4111-8111-111111111111");
  });
  await t.test("fresh reviews deduplicate per concept; reset disables and clears learned context",async()=>{
    for(let i=0;i<2;i++)assert.equal((await api.POST(request("11111111-1111-4111-8111-111111111111",{owner:"11111111-1111-4111-8111-111111111111",action:"review",conceptId:concept.id,rating:i?"down":"up",reason:"visual_balance",craft:concept.craft}))).status,200);
    const a=await (await api.GET(request("11111111-1111-4111-8111-111111111111"))).json(),b=await (await api.GET(request("22222222-2222-4222-8222-222222222222"))).json();assert.equal(a.reviewCount,1);assert.equal(b.reviewCount,0);
    // Bring the simulated DB clock into the current wall-time before reset.
    for(const r of rows)r.received_at=new Date(Date.now()-1000).toISOString();
    assert.equal((await api.POST(request("11111111-1111-4111-8111-111111111111",{owner:"11111111-1111-4111-8111-111111111111",action:"reset"}))).status,200);const reset=await (await api.GET(request("11111111-1111-4111-8111-111111111111"))).json();assert.equal(reset.reviewCount,0);assert.equal(reset.preferences.enabled,false);
  });
  await t.test("bounded recipe errors are rejected without inserting an event",async()=>{
    await api.POST(request("11111111-1111-4111-8111-111111111111",{owner:"11111111-1111-4111-8111-111111111111",action:"preferences",preferences:{...spec.DEFAULT_CRAFT_PREFERENCES,enabled:true}}));const before=rows.length;
    assert.equal((await api.POST(request("11111111-1111-4111-8111-111111111111",{owner:"11111111-1111-4111-8111-111111111111",action:"review",conceptId:concept.id,rating:"up",reason:"visual_balance",craft:{...concept.craft,panels:Array(10).fill({zone:"face"})}}))).status,400);assert.equal(rows.length,before);
  });
  await t.test("parallel daily claims create one durable claim",async()=>{const options={id:"EV-RESEARCH-DAILY-QA",source:"operator"},result=await Promise.all(Array.from({length:4},()=>ledger.appendCreativeEvent("operator_note",{subtype:"designer_research_run",status:"started"},options)));assert.equal(result.filter(r=>!r.duplicate).length,1);});
  await t.test("scheduler requires its secret and starts paused without paid calls",async()=>{assert.equal((await cron.GET(new Request("https://linen-qa.invalid/api/cron/designer-research"))).status,401);assert.equal((await cron.GET(new Request("https://linen-qa.invalid/api/cron/designer-research",{headers:{authorization:"Bearer incorrect"}}))).status,401);const response=await cron.GET(new Request("https://linen-qa.invalid/api/cron/designer-research",{headers:{authorization:"Bearer creative-qa-cron-secret"}}));assert.equal(response.status,200);assert.equal((await response.json()).status,"paused");});
});
