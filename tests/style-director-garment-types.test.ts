import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { StyleDirectorAnswers, StyleDirectorLook } from "../src/lib/style-director-agent.ts";

const require=createRequire(import.meta.url);
const {load}=require("../scripts/designer-test-loader.cjs");
const {createStyleDirectorLooks}=load("src/lib/style-director-agent.ts");
const {mergeLegacyIntoStyleSpec,validateStyleSpecV2}=load("src/lib/designer/style-spec-v2.ts");
const Module=require("node:module"),nativeLoad=Module._load;
let handoff:typeof import("../src/lib/designer/style-director-handoff.ts");
let handoffApi:typeof import("../src/app/api/style-director/handoff/route.ts");
try {
  Module._load=function(name:string,...args:unknown[]){return name==="server-only"?{}:nativeLoad.call(this,name,...args);};
  handoff=load("src/lib/designer/style-director-handoff.ts");
  load("src/lib/supabase-admin.ts").getSupabaseAdminConfig=()=>null;
  handoffApi=load("src/app/api/style-director/handoff/route.ts");
} finally {Module._load=nativeLoad;}

const answers:StyleDirectorAnswers={occasion:"Work",mood:"Quiet",time:"Day",climate:"Indoor",garment:"shirt",colorDirection:"Light"};
const looks:StyleDirectorLook[]=createStyleDirectorLooks(answers);
const model=looks[0].realModel!;
const payload={sourceLookId:looks[0].id,shirtId:model.shirtId,pantId:model.pantId,occasion:model.occasion,climate:model.climate,intention:model.intention,style:model.style,styleSpec:model.styleSpec};

async function withSigningKey(run:()=>unknown|Promise<unknown>){
  const prior=process.env.LINEN_MEMORY_SESSION_SECRET;
  process.env.LINEN_MEMORY_SESSION_SECRET="synthetic-handoff-unit-test-signing-key-only";
  try {await run();} finally {
    if(prior===undefined) delete process.env.LINEN_MEMORY_SESSION_SECRET;
    else process.env.LINEN_MEMORY_SESSION_SECRET=prior;
  }
}

test("generated garment recipes survive URL serialization and Designer restoration",()=>{
  const observed=new Set<string>();
  for(const occasion of ["Wedding","Work","Date","Celebration","Travel","Everyday"] as const){
    for(const mood of ["Quiet","Sharp","Relaxed","Statement"] as const){
      for(const garment of ["shirt","trouser"] as const){
        const results:StyleDirectorLook[]=createStyleDirectorLooks({...answers,occasion,mood,garment});
        assert.equal(results.length,3);
        for(const look of results){
          assert.ok(look.realModel);
          const real=look.realModel;
          const url=new URLSearchParams({styleSpec:JSON.stringify(real.styleSpec)});
          const restored=JSON.parse(url.get("styleSpec")!);
          assert.equal(validateStyleSpecV2(restored),true);
          assert.deepEqual(mergeLegacyIntoStyleSpec(restored,real.style),real.styleSpec,"Restoring legacy controls must not change the signed recipe");
          assert.deepEqual(restored.legacy,real.style);
          observed.add(restored.shirt.type);
          observed.add(restored.pant.type);
        }
      }
    }
  }
  for(const type of ["dress_shirt","casual_shirt","band_collar_shirt","camp_collar_resort","formal_flat_front","pleated_trouser","wide_leg_relaxed_drape"])assert.ok(observed.has(type),type);
});

test("v2 signatures bind garment types and nested construction independently of JSON key order",()=>withSigningKey(()=>{
  const now=1_800_000_000_000;
  const token=handoff.createStyleDirectorHandoffToken(payload,now)!;
  const verified=handoff.verifyStyleDirectorHandoffToken(token,now)!;
  assert.ok(verified);
  assert.equal(handoff.styleDirectorHandoffMatches(verified,JSON.parse(JSON.stringify(payload))),true);
  const reordered={...payload,styleSpec:Object.fromEntries(Object.entries(payload.styleSpec).reverse())} as typeof payload;
  assert.equal(handoff.styleDirectorHandoffMatches(verified,reordered),true);
  for(const edit of [
    (spec:typeof model.styleSpec)=>{spec.shirt.type="overshirt";},
    (spec:typeof model.styleSpec)=>{spec.pant.type="chinos";},
    (spec:typeof model.styleSpec)=>{spec.shirt.sleeve="short_sleeve";},
  ]){
    const edited=structuredClone(payload);
    edit(edited.styleSpec);
    assert.equal(handoff.styleDirectorHandoffMatches(verified,edited),false);
  }
  const [version,body,signature]=token.split(".");
  const modified=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
  modified.styleSpec.shirt.type="overshirt";
  const modifiedBody=Buffer.from(JSON.stringify(modified)).toString("base64url");
  assert.equal(handoff.verifyStyleDirectorHandoffToken(`${version}.${modifiedBody}.${signature}`,now),null);
}));

test("expired and legacy unsigned-type handoffs cannot claim v2 verification",()=>withSigningKey(()=>{
  const now=1_800_000_000_000;
  const token=handoff.createStyleDirectorHandoffToken(payload,now)!;
  assert.equal(handoff.verifyStyleDirectorHandoffToken(token,now+2*60*60*1000+1),null);
  assert.equal(handoff.verifyStyleDirectorHandoffToken(token.replace(/^v2\./,"v1."),now),null);
  assert.equal(handoff.verifyStyleDirectorHandoffToken(token+".extra",now),null);
}));

test("handoff HTTP boundary accepts exact types and rejects changed or missing specs",()=>withSigningKey(async()=>{
  const token=handoff.createStyleDirectorHandoffToken(payload)!;
  const post=(body:unknown)=>handoffApi.POST(new Request("http://localhost/api/style-director/handoff",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}));
  const exact=await post({...payload,token});
  assert.equal(exact.status,200);
  assert.deepEqual(await exact.json(),{verified:true,audited:false,auditId:null,sourceLookId:payload.sourceLookId});
  const edited=structuredClone(payload);
  edited.styleSpec.shirt.type="overshirt";
  assert.equal((await post({...edited,token})).status,409);
  assert.equal((await post({...payload,styleSpec:undefined,token})).status,400);
}));

test("Style Director real-model contract carries canonical garment types",()=>{
  const agent=readFileSync("src/lib/style-director-agent.ts","utf8");
  for(const token of [
    "styleSpec: StyleSpecV2",
    "styleSpecForDirectorCandidate",
    'spec.shirt.type="camp_collar_resort"',
    'spec.shirt.type="band_collar_shirt"',
    'spec.shirt.type="casual_shirt"',
    'spec.shirt.type="dress_shirt"',
    'spec.pant.type="wide_leg_relaxed_drape"',
    'spec.pant.type="pleated_trouser"',
    'spec.pant.type="formal_flat_front"',
    "styleSpec=styleSpecForDirectorCandidate(candidate,best.style)",
  ]) assert.ok(agent.includes(token),token);
});

test("Style Director handoff signs and verifies StyleSpec rather than legacy style alone",()=>{
  const handoff=readFileSync("src/lib/designer/style-director-handoff.ts","utf8");
  const api=readFileSync("src/app/api/style-director/handoff/route.ts","utf8");
  const page=readFileSync("src/app/style-director/page.tsx","utf8");
  const designer=readFileSync("src/components/DesignerModule.tsx","utf8");

  assert.ok(handoff.includes('const VERSION="v2"'));
  assert.ok(handoff.includes('version:"linen-earth-style-director-handoff-v2"'));
  assert.ok(handoff.includes("styleSpec:StyleSpecV2"));
  assert.ok(handoff.includes("canonical(payload.styleSpec)===canonical(observed.styleSpec)"));
  assert.ok(api.includes("validateStyleSpecV2(body.styleSpec)"));
  assert.ok(page.includes("styleSpec:JSON.stringify(selectedLook.realModel.styleSpec)"));
  assert.ok(page.includes("styleSpec:selectedLook.realModel.styleSpec"));
  assert.ok(designer.includes('const routedStyleSpec = params.get("styleSpec")'));
  assert.ok(designer.includes("styleSpec:nextStyleSpec || fromLegacyStyle(nextStyle)"));
});

test("Style Director result visibly names the selected garment types",()=>{
  const page=readFileSync("src/app/style-director/page.tsx","utf8");
  assert.ok(page.includes("optionById(selectedLook.realModel.styleSpec.shirt.type)"));
  assert.ok(page.includes("optionById(selectedLook.realModel.styleSpec.pant.type)"));
});
