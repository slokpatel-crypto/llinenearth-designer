import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import type {LockedDesignRevision} from "../src/lib/designer/design-lock.ts";
import {parseConsentedShareIntent} from "../src/lib/designer/share-intent.ts";

const revision={
  version:"linen-earth-design-lock-v1",
  revisionId:"LE-LOCK-20261029070000-AAAAAAAAAAAA-0000000000000001",
  parentRevisionId:null,
  recipeHash:"a".repeat(64),
  lockedAt:"2026-10-29T07:00:00.000Z",
  garmentSpec:{version:"linen-earth-garment-spec-v1"},
} as unknown as LockedDesignRevision;
const token="lev1.123e4567-e89b-42d3-a456-426614174000."+"a".repeat(43);

test("public share requires a separate explicit consent and literal recovery credential",()=>{
  const valid=parseConsentedShareIntent({revision,consentToShare:true,recoveryToken:token});
  assert.equal(valid?.revision,revision);
  assert.equal(valid?.recoveryToken,token);
  for(const bad of [
    revision,null,{},[],{revision,consentToContact:true,recoveryToken:token},
    {revision,consentToShare:false,recoveryToken:token},
    {revision,consentToShare:"true",recoveryToken:token},
    {revision,consentToShare:true},
    {revision,consentToShare:true,recoveryToken:[token]},
    {revision,consentToShare:true,recoveryToken:{toString:token}},
    {revision,consentToShare:true,recoveryToken:token+" "},
    {revision,consentToShare:true,recoveryToken:"x".repeat(257)},
    {revision:[],consentToShare:true,recoveryToken:token},
  ]) assert.equal(parseConsentedShareIntent(bad),null,JSON.stringify(bad).slice(0,100));
});

test("share route requires authenticated owned AND token-authorized vault revision before audit and token",()=>{
  const source=readFileSync("src/app/api/designer/share/route.ts","utf8");
  for(const required of [
    "readLockedHandoffRequest(request)","parseConsentedShareIntent(parsed.revision)",
    "verifyLockedDesignRevision(revision)","parseDesignVaultRecoveryToken(intent.recoveryToken)",
    "getCustomerIdentity(request)","designer_locked_revision_vault_get_owned",
    "designer_locked_revision_vault_get","selectVaultReadRow(ownedResult)",
    "selectVaultReadRow(tokenResult)","verifyLockedDesignRevision(owned.payload)",
    "verifyLockedDesignRevision(byToken.payload)",
    "sameLockedEnquiryRevision(revision,owned.payload",
    "sameLockedEnquiryRevision(owned.payload as LockedDesignRevision,byToken.payload",
    'verifiedLockedHandoffAuditId(await rpc("design_share_audit_record"',
    "if(!auditId) return privateJson","createDesignShareToken(verified)",
    "audited:true,auditId,ownerVerified:true",
  ]) assert.ok(source.includes(required),required);
  assert.ok(source.indexOf("getCustomerIdentity(request)")<source.indexOf('rpc("design_share_audit_record'));
  assert.ok(source.indexOf("sameLockedEnquiryRevision(revision,owned.payload")<source.indexOf('rpc("design_share_audit_record'));
  assert.ok(source.indexOf("if(!auditId) return privateJson")<source.indexOf("createDesignShareToken(verified)"));
  assert.doesNotMatch(source,/const token=createDesignShareToken\(revision\)/);
  assert.doesNotMatch(source,/await request\.json\(/);
  assert.doesNotMatch(source,/audit\.ok/);
});

test("Studio requires independent share consent, owner recovery and verified audit before exposing a link",()=>{
  const ui=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.match(ui,/checked=\{shareConsent\}/);
  assert.match(ui,/setShareConsent\(false\)/);
  assert.match(ui,/shareGenerationRef\.current\+=1/);
  assert.match(ui,/disabled=\{shareBusy\|\|!shareConsent\|\|!vaultAccountOwned\|\|!vaultRecoveryToken\}/);
  assert.match(ui,/consentToShare:true,recoveryToken:vaultRecoveryToken/);
  assert.match(ui,/result\.ownerVerified!==true/);
  assert.match(ui,/result\.audited!==true/);
  assert.match(ui,/result\.revisionId!==revision\.revisionId/);
  assert.match(ui,/shareGenerationRef\.current!==generation/);
  assert.match(ui,/Anyone with this link can view the locked design/);
  assert.doesNotMatch(ui,/Copy private share link/);
});
