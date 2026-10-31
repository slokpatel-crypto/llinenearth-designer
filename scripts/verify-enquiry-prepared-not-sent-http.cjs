"use strict";
// Real built Next.js HTTP test. Synthetic self-hashed design is not a
// customer-owned vault record, WhatsApp SEND, operator lead or physical proof.
// No external network calls: the returned wa.me URL is parsed, NEVER opened.
const assert=require("node:assert/strict");
const {createHash}=require("node:crypto");

const base=new URL(process.env.LINEN_BROWSER_QA_URL||"http://127.0.0.1:3000");
assert.ok(base.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(base.hostname),
  "Locked-enquiry HTTP smoke must never hit production or external hosts.");

const garment={
  version:"linen-earth-garment-spec-v1",status:"draft",
  source:{designerRuleSetVersion:"ci-only-rules",fitConstructionVersion:null,
    fitEaseSource:null,fitEaseTableVersion:null,measurementProfileVersion:null,
    blockStrategyVersion:null,styleSchemaVersion:null},
  styleSpec:null,bodyProfile:null,
  context:{occasion:"Semi-Formal",climate:"Not specified",intention:"Balanced"},
  fabrics:{
    shirt:{id:"ci-unverified-shirt",name:"CI Fabric Only",line:"CI Linen",source:"catalogue",verifiedMaterialFacts:0},
    trouser:{id:"ci-unverified-pant",name:"CI Trouser Only",line:"CI Linen",source:"catalogue",verifiedMaterialFacts:0},
  },
  shirt:{fit:"Regular",wear:"Tucked",collar:"Point",collarFinish:"Self-fabric",
    cuff:"Barrel",placket:"Standard",button:"Corozo",finishedTargets:[]},
  trouser:{shape:"Pleated",rise:"Mid Rise",waistband:"Side Adjuster",
    break:"Slight Break",finishedTargets:[]},
  creative:null,
  decision:{designFitScore:0,confidenceScore:0,fitConstructionScore:null,
    brandLanguageScore:null,blockStrategyScore:null},
  blockStrategy:null,constructionChecks:[],unresolved:["CI-only, not real cloth"],
  readiness:{visualization:"visual_review_required",tailoring:"insufficient_measurements",
    materialVerification:"verification_required"},
  caveats:["Synthetic test design; no real physical stock or tailor approval"],
};
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==="object")
    return Object.fromEntries(Object.entries(value)
      .sort(([left],[right])=>left.localeCompare(right))
      .map(([key,item])=>[key,canonical(item)]));
  return value;
}
const spec=canonical(garment);
const recipeHash=createHash("sha256").update(JSON.stringify(spec)).digest("hex");
const lockedAt="2026-10-01T09:00:00.000Z";
const revision={
  version:"linen-earth-design-lock-v1",
  revisionId:"LE-LOCK-20261001090000-"+recipeHash.slice(0,12).toUpperCase()+"-0123456789ABCDEF",
  parentRevisionId:null,recipeHash,lockedAt,garmentSpec:spec,
};

async function send(body){
  return fetch(new URL("/api/designer/enquiry",base),{
    method:"POST",redirect:"manual",cache:"no-store",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body),signal:AbortSignal.timeout(20_000),
  });
}
function assertPrivate(response,where){
  assert.match(response.headers.get("cache-control")||"",/\bprivate\b/i,where+" private");
  assert.match(response.headers.get("cache-control")||"",/\bno-store\b/i,where+" no-store");
}
async function prepared(body,description){
  const response=await send(body);
  assert.equal(response.status,200,description+" must offer a composition draft");
  assertPrivate(response,description);
  const data=await response.json();
  assert.equal(data.audited,false,description+" cannot claim durable enquiry audit");
  assert.equal(data.auditId,null,description+" cannot invent audit UUID");
  assert.equal(data.ownerVerified,false,description+" is not owner authenticated");
  assert.equal(data.operatorReceived,false,description+" cannot claim operator receipt");
  assert.equal(data.status,"whatsapp_draft");
  assert.equal(data.handoffStatus,"prepared_not_sent");
  assert.equal(data.revisionId,revision.revisionId);
  assert.equal(typeof data.href,"string");
  const url=new URL(data.href);
  assert.equal(url.protocol,"https:");
  assert.equal(url.hostname,"wa.me","Only an explicit WhatsApp composition URL is permitted");
  const draft=url.searchParams.get("text")||"";
  assert.ok(draft.includes(revision.revisionId));
  assert.ok(draft.includes(recipeHash.slice(0,12).toUpperCase()));
  assert.ok(draft.includes("CI Fabric Only"));
  assert.ok(!draft.includes("operatorReceived:true"));
  assert.ok(!Object.hasOwn(data,"orderId")&&!Object.hasOwn(data,"productionId"),
    description+" must not invent a production order");
}
async function main(){
  await prepared({revision,consentToContact:true},"explicitly consented unsaved revision");
  // Legacy client compatibility is still draft-only and must not create a
  // durable customer-owned/received enquiry despite a verifiable recipe hash.
  await prepared(revision,"legacy locked-revision composition");

  const changed=structuredClone(revision);
  changed.garmentSpec.fabrics.shirt.id="CI-TAMPERED-CLOTH";
  const tampered=await send({revision:changed,consentToContact:true});
  assert.equal(tampered.status,409,"tampered physical/recipe evidence must fail");
  assertPrivate(tampered,"tampered revision");
  assert.equal(typeof (await tampered.json()).error,"string");

  const token=await send({
    revision,consentToContact:true,
    recoveryToken:"fabricated-vault-capability-without-owner",
  });
  assert.equal(token.status,400,"fake recovery capability cannot imply owner-verified handoff");
  assertPrivate(token,"invalid recovery token");
  const invalid=await token.json();
  assert.equal(typeof invalid.error,"string");
  assert.equal(Object.hasOwn(invalid,"audited"),false);
  console.log("Actual built Next enquiry HTTP PASS: verified synthetic lock remains an unsent composition only; tampered/token claims denied.");
  console.log("No WhatsApp send, saved owner, supplier stock, operator receipt, order, provider charge or production write.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
