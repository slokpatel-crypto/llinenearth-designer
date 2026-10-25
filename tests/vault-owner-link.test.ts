import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {linkVaultOwnerBestEffort,vaultOwnershipWarning} from "../src/lib/vault-owner-link.ts";

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
    const response=route.indexOf("ownershipWarning:vaultOwnershipWarning(linkStatus)");
    assert.ok(issue>=0&&owner>issue&&response>owner,path);
    assert.match(route,/accountOwned:linkStatus==="linked"/);
    assert.match(route,/const input:unknown=await request\.json\(\)\.catch\(\(\)=>null\)/);
    assert.match(route,/Array\.isArray\(input\)/);
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
  assert.ok(flow.indexOf("setVaultToken(result.recoveryToken);")<flow.indexOf("setVaultMessage([savedMessage,result.ownershipWarning]"));
});
