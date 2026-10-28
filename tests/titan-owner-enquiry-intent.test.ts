import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import type {LockedDesignRevision} from "../src/lib/designer/design-lock.ts";
import {parseEnquiryIntent,sameLockedEnquiryRevision} from "../src/lib/designer/enquiry-intent.ts";

const revision={
  version:"linen-earth-design-lock-v1",
  revisionId:"LE-LOCK-20261029070000-AAAAAAAAAAAA-0000000000000001",
  parentRevisionId:null,
  recipeHash:"a".repeat(64),
  lockedAt:"2026-10-29T07:00:00.000Z",
  garmentSpec:{version:"linen-earth-garment-spec-v1"},
} as unknown as LockedDesignRevision;
const token="lev1.123e4567-e89b-42d3-a456-426614174000."+"a".repeat(43);

test("existing raw locked revisions remain WhatsApp drafts, never audit evidence",()=>{
  const actual=parseEnquiryIntent(revision);
  assert.equal(actual?.revision,revision);
  assert.equal(actual?.mode,"legacy_draft");
  assert.equal(actual?.recoveryToken,null);
});

test("consented enquiry can ask for owner verification only with a literal token",()=>{
  assert.equal(parseEnquiryIntent({revision,consentToContact:true})?.recoveryToken,null);
  assert.equal(parseEnquiryIntent({revision,consentToContact:true,recoveryToken:token})?.recoveryToken,token);
  for(const bad of [
    null,[],{},true,{revision}, {revision,consentToContact:false},
    {revision,consentToContact:"true"},{revision,consentToContact:true,recoveryToken:[token]},
    {revision,consentToContact:true,recoveryToken:{toString:token}},
    {revision,consentToContact:true,recoveryToken:token+" "},
    {revision,consentToContact:true,recoveryToken:"x".repeat(257)},
  ]) assert.equal(parseEnquiryIntent(bad),null,JSON.stringify(bad).slice(0,150));
});

test("authenticated vault and request must preserve locked identity metadata",()=>{
  assert.equal(sameLockedEnquiryRevision(revision,{...revision}),true);
  for(const mismatch of [
    {...revision,version:"unsupported"},
    {...revision,revisionId:revision.revisionId+"-evil"},
    {...revision,recipeHash:"b".repeat(64)},
    {...revision,lockedAt:"2026-10-29T07:00:01.000Z"},
    {...revision,parentRevisionId:"LE-LOCK-CHANGED"},
  ])assert.equal(sameLockedEnquiryRevision(revision,mismatch as LockedDesignRevision),false);
});

test("enquiry handler rejects unsigned audit claims and checks two independent vault authorizations",()=>{
  const source=readFileSync("src/app/api/designer/enquiry/route.ts","utf8");
  assert.match(source,/secureJsonRequestError\(request,ENQUIRY_MAX_BYTES\)/);
  assert.match(source,/readSecureJsonObject\(request,ENQUIRY_MAX_BYTES\)/);
  assert.match(source,/parseDesignVaultRecoveryToken\(intent.recoveryToken\)/);
  assert.match(source,/getCustomerIdentity\(request\)/);
  assert.match(source,/designer_locked_revision_vault_get_owned/);
  assert.match(source,/designer_locked_revision_vault_get/);
  assert.match(source,/selectVaultReadRow\(ownedResult\)/);
  assert.match(source,/selectVaultReadRow\(tokenResult\)/);
  assert.match(source,/sameLockedEnquiryRevision\(intent.revision,owned.payload/);
  assert.match(source,/normalizeVaultId\(await rpc\("design_enquiry_audit_record"/);
  assert.match(source,/if\(!auditId\) return respond/);
  assert.match(source,/audited:false,auditId:null,ownerVerified:false,operatorReceived:false/);
  assert.match(source,/audited:true,auditId,ownerVerified:true/);
  assert.match(source,/operatorReceived:false,status:"intent_recorded"/);
  assert.doesNotMatch(source,/audited=audit\.ok/);
  assert.doesNotMatch(source,/await request\.json\(/);
});

test("Designer requires express contact consent and never claims WhatsApp delivery",()=>{
  const ui=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.match(ui,/checked=\{enquiryConsent\}/);
  assert.match(ui,/disabled=\{enquiryBusy\|\|!enquiryConsent\}/);
  assert.match(ui,/consentToContact:true/);
  assert.match(ui,/vaultAccountOwned&&vaultRecoveryToken/);
  assert.match(ui,/setVaultAccountOwned\(result.accountOwned===true\)/);
  assert.match(ui,/setEnquiryConsent\(false\)/);
  assert.match(ui,/setEnquiryHref\(""\)/);
  assert.match(ui,/WhatsApp still needs to be sent manually/);
  assert.match(ui,/No verified operator receipt or confirmed message delivery/);
  assert.match(ui,/Open the WhatsApp draft manually/);
});
