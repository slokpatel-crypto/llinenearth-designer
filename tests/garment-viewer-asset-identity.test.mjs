import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { dirname, resolve } from "node:path";
import {
  parseGarmentViewerAssetIdentity,
  garmentViewerAssetIdentityKey,
  garmentViewerAssetIdentityMatches,
} from "../src/lib/garment-viewer-readiness.ts";

const identity={modelId:"LE-OFFICEWEAR-V1",modelSha256:"a".repeat(64),manifestSha256:"b".repeat(64)};
const malformed=[null,undefined,[],{},false,"identity",
  {...identity,modelId:""},{...identity,modelId:"LE-"},{...identity,modelId:"LE-"+"A".repeat(91)},
  ...["modelSha256","manifestSha256"].flatMap(field=>
    ["",null,123,[],{},"a".repeat(63),"g".repeat(64),"a".repeat(65),identity[field]+"-suffix",identity[field]+"\nextra"]
      .map(value=>({...identity,[field]:value}))),
];

test("asset identity rejects complete malformed values and never aliases their valid prefix",()=>{
  for(const value of malformed){
    assert.equal(parseGarmentViewerAssetIdentity(value),null,JSON.stringify(value));
    assert.equal(garmentViewerAssetIdentityKey(value),"");
    assert.equal(garmentViewerAssetIdentityMatches(value,value),false);
    assert.equal(garmentViewerAssetIdentityMatches(identity,value),false);
    assert.equal(garmentViewerAssetIdentityMatches(value,identity),false);
  }
});

test("canonical SHA hex and surrounding whitespace preserve existing valid evidence identity",()=>{
  const formatted={modelId:` ${identity.modelId} `,modelSha256:` ${identity.modelSha256.toUpperCase()} `,
    manifestSha256:`\n${identity.manifestSha256.toUpperCase()}\n`};
  assert.deepEqual(parseGarmentViewerAssetIdentity(formatted),identity);
  assert.equal(garmentViewerAssetIdentityMatches(identity,formatted),true);
  assert.equal(garmentViewerAssetIdentityKey(formatted),garmentViewerAssetIdentityKey(identity));
  for(const field of Object.keys(identity)){
    const changed={...identity,[field]:field==="modelId"?"LE-OFFICEWEAR-V2":"c".repeat(64)};
    assert.equal(garmentViewerAssetIdentityMatches(identity,changed),false);
    assert.notEqual(garmentViewerAssetIdentityKey(identity),garmentViewerAssetIdentityKey(changed));
  }
});

const require=createRequire(import.meta.url);
const ts=require("typescript");
// Execute the real HTTP handler and database reader with transport/auth/asset
// boundaries stubbed; no network, real credentials or production assets.
function isolatedModule(file,stubs){
  const exports={};
  const localRequire=name=>{
    if(Object.hasOwn(stubs,name)) return stubs[name];
    if(name==="server-only") return {};
    if(name.startsWith("@/")) return isolatedModule("src/"+name.slice(2)+".ts",stubs);
    if(name.startsWith(".")) return isolatedModule(resolve(dirname(file),name),stubs);
    return require(name);
  };
  const source=ts.transpileModule(readFileSync(file,"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  runInNewContext(source,{exports,require:localRequire,Response,Request,URLSearchParams,AbortSignal,
    fetch:(...args)=>stubs.fetch(...args),console,Date,Map,Set,globalThis:{}});
  return exports;
}

const evidence={subtype:"garment_viewer_readiness",version:"linen-earth-garment-viewer-readiness-v1",
  status:"accepted",realismRubricVersion:"linen-earth-garment-viewer-realism-rubric-v1",...identity,
  patternScaleSamples:["stripe","check"].map(pattern=>({fabricId:`cloth-${pattern}`,pattern,verified:true,
    physicalRepeatMm:10,renderedRepeatPx:100,referenceLengthMm:100,referenceLengthPx:1000,
    evidenceReference:`fixture-${pattern}-only`})),
  interactionLatencyMs:Array(12).fill(100),
  realismAssessments:Array.from({length:8},(_,i)=>({viewerId:`viewer-${i}`,rating:5})),
  boundaryChecks:{neck:true,cuffs:true,waist:true,trouserGap:true},
};

test("HTTP evidence ingestion rejects overlong identities before persistence and reload fails closed",async()=>{
  let authorized=true;
  const stored=[];
  const cloud={getSupabaseAdminConfig:()=>({url:"https://qa.invalid"}),supabaseAdminHeaders:()=>({})};
  const api=isolatedModule("src/app/api/memory/event/route.ts",{
    "next/headers":{cookies:async()=>({get:()=>({value:"test-cookie"})})},
    "next/server":{NextResponse:{json:(body,init)=>Response.json(body,init)}},
    "@/lib/operator-session":{OPERATOR_COOKIE:{name:"test"},verifyOperatorSession:async()=>authorized},
    "@/lib/memory-session":{verifyMemorySessionToken:()=>false},
    "@/lib/supabase-admin":cloud,
    fetch:async(url,init)=>{assert.equal(url,"https://qa.invalid/rest/v1/style_events");stored.push(JSON.parse(init.body));return new Response(null,{status:201});},
  });
  const submit=payload=>api.POST(new Request("https://qa.invalid/api/memory/event",{method:"POST",
    headers:{"content-type":"application/json"},body:JSON.stringify({type:"operator_note",sessionId:"qa-only",payload})}));
  for(const value of malformed.filter(value=>value && typeof value==="object" && !Array.isArray(value) && Object.keys(value).length)){
    assert.equal((await submit({...evidence,...value})).status,400);
  }
  assert.equal(stored.length,0);
  authorized=false;
  assert.equal((await submit(evidence)).status,403);
  assert.equal(stored.length,0);
  authorized=true;
  const brokenQAInputs=[
    [...evidence.patternScaleSamples,{...evidence.patternScaleSamples[0],renderedRepeatPx:null}],
    [...evidence.patternScaleSamples,{...evidence.patternScaleSamples[0],evidenceReference:"x".repeat(241)}],
    [...evidence.patternScaleSamples,{...evidence.patternScaleSamples[0],fabricId:"fabric-"+"x".repeat(161)}],
    [...evidence.patternScaleSamples,{fabricId:"legacy",pattern:"stripe",verified:true,errorPct:0}],
    [...evidence.patternScaleSamples,...Array(19).fill(evidence.patternScaleSamples[0])],
  ];
  for(const patternScaleSamples of brokenQAInputs){
    const result=await submit({...evidence,patternScaleSamples});
    assert.equal(result.status,400,"malformed operator evidence should be rejected, not partially persisted");
    assert.equal(stored.length,0);
  }
  const invalidPerformanceOrViewerInputs=[
    {interactionLatencyMs:[...evidence.interactionLatencyMs,null]},
    {interactionLatencyMs:[...evidence.interactionLatencyMs,10001]},
    {interactionLatencyMs:Array(121).fill(100)},
    {realismAssessments:[...evidence.realismAssessments,{viewerId:"bad-rating",rating:0}]},
    {realismAssessments:[...evidence.realismAssessments,{viewerId:"x".repeat(81),rating:5}]},
    {realismAssessments:[...evidence.realismAssessments,{viewerId:"bad-date",rating:5,recordedAt:"x".repeat(81)}]},
    {realismAssessments:Array(51).fill({viewerId:"not-independent",rating:5})},
  ];
  for(const patch of invalidPerformanceOrViewerInputs){
    const result=await submit({...evidence,...patch});
    assert.equal(result.status,400,"all operator measurements must survive persistence");
    assert.equal(stored.length,0);
  }
  assert.equal((await submit({...evidence,modelSha256:identity.modelSha256.toUpperCase()})).status,200);
  assert.equal(stored.length,1);
  assert.equal(stored[0].payload.modelSha256,identity.modelSha256);

  let rows=JSON.parse(JSON.stringify(stored)).reverse();
  const reader=isolatedModule("src/lib/garment-viewer-evidence-server.ts",{
    "@/lib/supabase-admin":cloud,
    "@/lib/garment-viewer-model-server":{loadGarmentViewerProductionAssetStatus:async()=>({
      assetIdentity:identity,model:{contract:{readiness:"contract_ready",physicallyScalable:true}},manifest:{valid:true},
    })},
    fetch:async url=>{assert.equal(new URL(url).hostname,"qa.invalid");return Response.json(rows);},
  });
  const valid=await reader.loadLatestGarmentViewerReadiness();
  assert.equal(valid.latest.identityMatches,true);
  assert.equal(valid.latest.readiness.ready,true);
  for(const patch of [{modelSha256:identity.modelSha256+"suffix"},{manifestSha256:""},{modelId:null},
    {modelSha256:"c".repeat(64)}]){
    rows=[{...stored[0],payload:{...stored[0].payload,...patch}},stored[0]];
    const result=await reader.loadLatestGarmentViewerReadiness();
    assert.equal(result.latest.identityMatches,false);
    assert.equal(result.latest.readiness.ready,false);
    assert.equal(result.latest.readiness.contractReady,false);
    assert.equal(result.latest.readiness.manifestReady,false);
    assert.match(result.latest.readiness.reasons[0],/different or missing/);
  }

  // A pre-existing or tampered stored event must remain inspectable while
  // never becoming a release pass after a failing row is dropped on reload.
  const invalidHistoricalEvidence=[
    {patternScaleSamples:[...evidence.patternScaleSamples,{fabricId:"bad",pattern:"stripe",verified:true,errorPct:0}]},
    {patternScaleSamples:[...evidence.patternScaleSamples,{fabricId:"bad",pattern:"invalid"}]},
    {interactionLatencyMs:[...evidence.interactionLatencyMs,10001]},
    {interactionLatencyMs:Array(121).fill(100)},
    {realismAssessments:[...evidence.realismAssessments,{viewerId:"bad",rating:0}]},
    {realismAssessments:[...evidence.realismAssessments,{viewerId:"x".repeat(81),rating:5}]},
  ];
  for(const patch of invalidHistoricalEvidence){
    rows=[{...stored[0],payload:{...stored[0].payload,...patch}}];
    const result=await reader.loadLatestGarmentViewerReadiness();
    assert.equal(result.latest.identityMatches,true);
    assert.equal(result.latest.readiness.ready,false,"lossy stored records cannot pass release QA");
    assert.match(result.latest.readiness.reasons.join(" "),/lost, malformed or truncated/);
  }
});
