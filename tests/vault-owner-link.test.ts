import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {linkVaultOwnerBestEffort,resolveVaultStoreOwnerBestEffort,vaultOwnershipWarning} from "../src/lib/vault-owner-link.ts";

test("absent customer does not call the optional owner-link RPC",async()=>{
  let calls=0;
  const status=await linkVaultOwnerBestEffort(undefined,async()=>{calls++;return true;});
  assert.equal(status,"not-requested");
  assert.equal(calls,0);
  assert.equal(vaultOwnershipWarning(status),undefined);
});

test("confirmed owner link preserves account capability",async()=>{
  const status=await linkVaultOwnerBestEffort("account-1",async id=>{
    assert.equal(id,"account-1");return true;
  });
  assert.equal(status,"linked");
  assert.equal(vaultOwnershipWarning(status),undefined);
});

test("false and rejected owner-link results retain recovery-only truth",async()=>{
  for(const attach of [
    async()=>false,
    async()=>{throw new Error("test injected RPC outage");},
  ]){
    const status=await linkVaultOwnerBestEffort("account-1",attach);
    assert.equal(status,"unavailable");
    const warning=vaultOwnershipWarning(status);
    assert.match(warning||"",/could not be confirmed/);
    assert.match(warning||"",/recovery token/);
    assert.match(warning||"",/retrieve, delete or claim/);
    assert.doesNotMatch(warning||"",/account-1|RPC outage/);
  }
});

test("both vault routes retain recovery-token issuance ahead of optional owner-link RPC",()=>{
  for(const [path,token] of [
    ["src/app/api/measurements/vault/route.ts","createMeasurementVaultRecoveryToken(vaultId,accessKey)"],
    ["src/app/api/designer/vault/route.ts","createDesignVaultRecoveryToken(vaultId,accessKey)"],
  ]){
    const route=readFileSync(path,"utf8");
    const issue=route.indexOf("const recoveryToken="+token);
    const owner=route.indexOf("const linkStatus=await linkVaultOwnerBestEffort");
    const response=route.indexOf('ownershipWarning:optionalOwner?.lookupFailed?vaultOwnershipWarning("unavailable"):vaultOwnershipWarning(linkStatus)');
    assert.ok(issue>=0&&owner>issue&&response>owner,path);
    assert.match(route,/accountOwned:linkStatus==="linked"/);
    assert.match(route,/const input:unknown=await readSecureJsonObject\(request,\d+\)/);
    assert.match(route,/secureJsonRequestError\(request,\d+\)/);
    assert.match(route,/SecureJsonBodyInvalid/);
    assert.match(route,/typeof action!=="string"/);
    assert.match(route,/status:400/);
    assert.ok(route.indexOf('["store","listOwned","loadOwned","deleteOwned","claim","load","delete"].includes(action)')>=0);
  }
});

test("measurement UI surfaces optional account-link warning without discarding the token",()=>{
  const ui=readFileSync("src/components/MeasurementStudio.tsx","utf8");
  const s=ui.indexOf("async function saveSecureCopy");
  const e=ui.indexOf("async function loadSecureCopy",s);
  const flow=ui.slice(s,e);
  assert.ok(flow.indexOf("setVaultToken(result.recoveryToken);")>=0);
  const warningMessage=flow.indexOf("setVaultMessage([");
  assert.ok(warningMessage>flow.indexOf("setVaultToken(result.recoveryToken);"));
  assert.match(flow.slice(warningMessage),/result\.ownershipWarning/);
});


test("locked-design studio shows ownership uncertainty alongside its already-visible recovery token",()=>{
  const ui=readFileSync("src/components/DesignerModule.tsx","utf8");
  const start=ui.indexOf("async function saveLockedRevisionToVault()");
  const end=ui.indexOf("return <div className=\"newDesigner\">",start);
  const flow=ui.slice(start,end);
  const token=flow.indexOf("setVaultRecoveryToken(result.recoveryToken);");
  const message=flow.indexOf("setVaultMessage([savedMessage,result.ownershipWarning]");
  assert.ok(start>=0&&end>start&&token>=0&&message>token);
  assert.match(flow,/tokenCopied=true/);
  assert.match(flow,/Copy the recovery token below and keep it private/);
});

test("optional vault store survives missing and failed legacy authentication lookups",async()=>{
  const absent=await resolveVaultStoreOwnerBestEffort(async()=>null);
  assert.deepEqual(absent,{customer:null,lookupFailed:false});
  const signedIn=await resolveVaultStoreOwnerBestEffort(async()=>({id:"account-1",email:null}));
  assert.deepEqual(signedIn,{customer:{id:"account-1",email:null},lookupFailed:false});
  const interrupted=await resolveVaultStoreOwnerBestEffort(async()=>{
    throw new Error("injected auth service timeout");
  });
  assert.deepEqual(interrupted,{customer:null,lookupFailed:true});
  assert.match(vaultOwnershipWarning(interrupted.lookupFailed?"unavailable":"not-requested")||"",/recovery token/);
});

test("vault store routes treat optional auth failures as recovery-only copies, not 503",()=>{
  for(const path of ["src/app/api/measurements/vault/route.ts","src/app/api/designer/vault/route.ts"]){
    const source=readFileSync(path,"utf8");
    const lookup=source.indexOf('const optionalOwner=action==="store"?await resolveVaultStoreOwnerBestEffort(()=>getCustomerIdentity(request)):null');
    const store=source.indexOf('if(action==="store")',lookup);
    const save=source.indexOf('const recoveryToken=create',store);
    assert.ok(lookup>=0&&store>lookup&&save>store,path);
    assert.match(source,/ownershipWarning:optionalOwner\?\.lookupFailed\?vaultOwnershipWarning\("unavailable"\):vaultOwnershipWarning\(linkStatus\)/);
    assert.match(source,/accountOwned:linkStatus==="linked"/);
  }
});


test("design secure store verifies signed-in owner recovery before accountOwned success",()=>{
  const source=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  const store=source.slice(source.indexOf('if(action==="store")'),source.indexOf('if(action==="listOwned")'));
  const token=store.indexOf("const recoveryToken=createDesignVaultRecoveryToken");
  const attach=store.indexOf('"designer_locked_revision_vault_set_owner"');
  const owned=store.indexOf('"designer_locked_revision_vault_get_owned"',attach);
  const selection=store.indexOf("selectVaultReadRow(ownedRows)",owned);
  const integrity=store.indexOf("verifyLockedDesignRevision(ownedRevision)",selection);
  const revision=store.indexOf("ownedRevision.revisionId===revision.revisionId",integrity);
  const hash=store.indexOf("ownedRevision.recipeHash===revision.recipeHash",revision);
  const propagation=store.indexOf('"production_claim_revision_ownership"',hash);
  const result=store.indexOf('accountOwned:linkStatus==="linked"',propagation);
  assert.ok(token>=0&&attach>token&&owned>attach&&selection>owned&&integrity>selection
    &&revision>integrity&&hash>revision&&propagation>hash&&result>propagation);
  assert.match(store,/if\(!attached\)return false/);
  assert.match(store,/linkVaultOwnerBestEffort\(customer\?\.id,async ownerId=>/);
  assert.match(store,/ownershipWarning:optionalOwner\?\.lookupFailed\?vaultOwnershipWarning\("unavailable"\):vaultOwnershipWarning\(linkStatus\)/);
});

test("measurement secure store verifies the actual owner-scoped profile and tailoring data",()=>{
  const source=readFileSync("src/app/api/measurements/vault/route.ts","utf8");
  const store=source.slice(source.indexOf('if(action==="store")'),source.indexOf('if(action==="listOwned")'));
  const token=store.indexOf("const recoveryToken=createMeasurementVaultRecoveryToken");
  const attach=store.indexOf('"measurement_profile_vault_set_owner"');
  const owned=store.indexOf('"measurement_profile_vault_get_owned"',attach);
  const selection=store.indexOf("selectVaultReadRow(ownedRows)",owned);
  const profile=store.indexOf("validStoredMeasurementProfile(ownedRow?.profile)",selection);
  const observations=store.indexOf("validStoredTailorObservationProfile(ownedRow?.observations)",profile);
  const profileMatch=store.indexOf("JSON.stringify(ownedProfile)===JSON.stringify(profile)",observations);
  const observationsMatch=store.indexOf("JSON.stringify(ownedObservations)===JSON.stringify(observations)",profileMatch);
  const result=store.indexOf('accountOwned:linkStatus==="linked"',observationsMatch);
  assert.ok(token>=0&&attach>token&&owned>attach&&selection>owned&&profile>selection
    &&observations>profile&&profileMatch>observations&&observationsMatch>profileMatch&&result>observationsMatch);
  assert.match(store,/if\(!attached\)return false/);
  assert.match(store,/linkVaultOwnerBestEffort\(customer\?\.id,async ownerId=>/);
  assert.match(store,/ownershipWarning:optionalOwner\?\.lookupFailed\?vaultOwnershipWarning\("unavailable"\):vaultOwnershipWarning\(linkStatus\)/);
});

test("owner-link confirmation failure after successful mutation never discards secure recovery",async()=>{
  for(const confirm of [async()=>false,async()=>{throw Error("injected owner read outage");}]){
    const status=await linkVaultOwnerBestEffort("account-1",async()=>{
      const attached=true;
      return attached&&await confirm();
    });
    assert.equal(status,"unavailable");
    assert.match(vaultOwnershipWarning(status)||"",/recovery token/);
  }
});
