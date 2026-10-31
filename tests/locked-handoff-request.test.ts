import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {readLockedHandoffRequest,verifiedLockedHandoffAuditId,LOCKED_HANDOFF_JSON_MAX_BYTES} from "../src/lib/designer/locked-handoff-request.ts";
import {readBoundedJsonResponse} from "../src/lib/designer/bounded-json-response.ts";

const target="https://linenearth.example/api/designer/enquiry";
function req(body:string,headers:Record<string,string>={},route=target){
  return new Request(route,{
    method:"POST",
    headers:{"content-type":"application/json","x-forwarded-for":"qa-handoff-"+(headers["x-qa-key"]||"default"),...headers},
    body,
  });
}

test("locked handoff accepts valid same-origin JSON and preserves the unmodified revision body",async()=>{
  const draft={version:"linen-earth-design-lock-v1",revisionId:"LE-LOCK-TEST",garmentSpec:{version:"linen-earth-garment-spec-v1"}};
  const result=await readLockedHandoffRequest(req(JSON.stringify(draft),{"origin":"https://linenearth.example","x-qa-key":"good"}));
  assert.equal(result.ok,true);
  if(result.ok) assert.deepEqual(result.revision,draft);
});

test("both share and enquiry reject cross-site fetches, wrong media type and malformed bodies",async()=>{
  for(const route of [target,"https://linenearth.example/api/designer/share"]){
    const inputs=[
      [req("{}",{origin:"https://other.example","x-qa-key":"origin"},route),403],
      [req("{}",{"sec-fetch-site":"cross-site","x-qa-key":"site"},route),403],
      [req("{}",{"content-type":"text/plain","x-qa-key":"type"},route),415],
      [req("[]",{"x-qa-key":"array"},route),400],
      [req("{",{"x-qa-key":"malformed"},route),400],
      [req("{}",{"content-length":"999999","x-qa-key":"length"},route),413],
    ] as const;
    for(const [request,status] of inputs){
      const response=await readLockedHandoffRequest(request);
      assert.equal(response.ok,false,route);
      if(!response.ok) assert.equal(response.status,status,route);
    }
  }
});

test("actual streamed payload limit is enforced independently of declared Content-Length",async()=>{
  assert.equal(LOCKED_HANDOFF_JSON_MAX_BYTES,98_304);
  const large=req(JSON.stringify({payload:"x".repeat(LOCKED_HANDOFF_JSON_MAX_BYTES)}),{"x-qa-key":"stream"});
  const result=await readLockedHandoffRequest(large);
  assert.equal(result.ok,false);
  if(!result.ok) assert.equal(result.status,413);
});

test("best-effort handoff request throttle does not treat a repeated write as a success",async()=>{
  const results=[];
  for(let i=0;i<31;i++) results.push(await readLockedHandoffRequest(req("{}",{"x-qa-key":"rate"})));
  assert.equal(results.slice(0,30).every(value=>value.ok),true);
  assert.equal(results[30].ok,false);
  if(!results[30].ok) assert.equal(results[30].status,429);
});

test("HTTP 200 is not proof of a durable share or enquiry audit receipt",()=>{
  const uuid="123e4567-e89b-42d3-a456-426614174000";
  assert.equal(verifiedLockedHandoffAuditId(uuid),uuid);
  assert.equal(verifiedLockedHandoffAuditId(uuid.toUpperCase()),uuid);
  for(const receipt of [null,undefined,false,true,1,{},[],{audit_id:uuid},"",uuid+"junk"," "+uuid,uuid+" ",[uuid]])
    assert.equal(verifiedLockedHandoffAuditId(receipt),null);
});

test("share/enquiry and customer UI retain privacy, lineage and explicit-send contracts",()=>{
  const enquiry=readFileSync("src/app/api/designer/enquiry/route.ts","utf8");
  const share=readFileSync("src/app/api/designer/share/route.ts","utf8");
  const ui=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.match(share,/readLockedHandoffRequest\(request\)/);
  assert.match(share,/verifiedLockedHandoffAuditId\(await rpc\("design_share_audit_record"/);
  assert.match(share,/parseConsentedShareIntent\(parsed.revision\)/);
  assert.match(share,/getCustomerIdentity\(request\)/);
  assert.match(share,/sameLockedEnquiryRevision\(revision,owned.payload/);
  assert.match(enquiry,/readBoundedJsonResponse\(response,256 \* 1024\)/);
  assert.match(enquiry,/verifiedLockedHandoffAuditId\(await rpc\("design_enquiry_audit_record"/);
  assert.doesNotMatch(enquiry,/normalizeVaultId\(await rpc\("design_enquiry_audit_record"/);
  assert.doesNotMatch(enquiry,/response\.json\(\)/);
  assert.doesNotMatch(share,/audit\.json\(\)/);
  assert.match(share,/cache-control":"private, no-store"/);
  assert.match(enquiry,/readLockedHandoffRequest\(request\)/);
  assert.match(enquiry,/parseEnquiryIntent\(parsed.revision\)/);
  assert.match(enquiry,/designer_locked_revision_vault_get_owned/);
  assert.match(enquiry,/sameLockedEnquiryRevision\(intent.revision/);
  assert.match(enquiry,/handoffStatus:"prepared_not_sent"/);
  assert.match(enquiry,/verifyLockedDesignRevision\(intent.revision\)/);
  for(const source of [enquiry,share]) assert.doesNotMatch(source,/await request\.json\(\)/);
  assert.match(share,/verifyLockedDesignRevision\(revision\)/);
  assert.match(ui,/result\.revisionId!==revision\.revisionId/);
  assert.match(ui,/result\.handoffStatus!=="prepared_not_sent"/);
  assert.match(ui,/checked=\{enquiryConsent\}/);
  assert.match(ui,/disabled=\{enquiryBusy\|\|!enquiryConsent\}/);
  assert.match(ui,/hostname!=="wa\.me"/);
  assert.match(ui,/enquiryResult\?\.revisionId===verifiedLockedRevision\.revisionId/);
  assert.match(ui,/Open WhatsApp and send/);
  assert.doesNotMatch(ui,/window\.open\(result\.href/);
});

test("locked customer handoff RPC receipts are bounded, and share receipts require real UUIDs",async()=>{
  const uuid="123e4567-e89b-42d3-a456-426614174000";
  const audit=await readBoundedJsonResponse(new Response(JSON.stringify(uuid)),4*1024);
  assert.equal(verifiedLockedHandoffAuditId(audit),uuid);
  assert.equal(verifiedLockedHandoffAuditId(await readBoundedJsonResponse(new Response(JSON.stringify({audit_id:uuid})),4*1024)),null);
  await assert.rejects(readBoundedJsonResponse(new Response(JSON.stringify("x".repeat(4096))),4*1024),/exceeds/);
  await assert.rejects(readBoundedJsonResponse(new Response("broken"),4*1024),SyntaxError);
  const owned=JSON.stringify([{expires_at:"2099-01-01T00:00:00Z",payload:{revisionId:"original"}}]);
  assert.deepEqual(await readBoundedJsonResponse(new Response(owned),256*1024),JSON.parse(owned));
  await assert.rejects(readBoundedJsonResponse(new Response(" ".repeat(256*1024+1)),256*1024),/exceeds/);
});

test("built Next HTTP enquiry smoke distinguishes composed draft from sent or operator-accepted order",()=>{
  const file=readFileSync("scripts/verify-enquiry-prepared-not-sent-http.cjs","utf8");
  const ci=readFileSync(".github/workflows/ci.yml","utf8");
  assert.ok(ci.includes("node scripts/verify-enquiry-prepared-not-sent-http.cjs"));
  assert.ok(file.includes('new URL("/api/designer/enquiry",base)'));
  assert.ok(file.includes('assert.equal(data.handoffStatus,"prepared_not_sent")'));
  assert.ok(file.includes('assert.equal(data.operatorReceived,false'));
  assert.ok(file.includes('assert.equal(data.audited,false'));
  assert.ok(file.includes('assert.equal(data.auditId,null'));
  assert.ok(file.includes('assert.equal(data.ownerVerified,false'));
  assert.ok(file.includes('assert.equal(data.status,"whatsapp_draft")'));
  assert.ok(file.includes('assert.equal(url.hostname,"wa.me"'));
  assert.ok(file.includes('await prepared({revision,consentToContact:true}'));
  assert.ok(file.includes('await prepared(revision,"legacy locked-revision composition")'));
  assert.ok(file.includes('assert.equal(tampered.status,409'));
  assert.ok(file.includes('assert.equal(token.status,400'));
  assert.ok(file.includes('assert.ok(!Object.hasOwn(data,"orderId")'));
  assert.ok(file.includes('url.searchParams.get("text")'));
  assert.ok(!file.includes('await fetch(data.href'));
});
