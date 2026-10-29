import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireVaultBooleanResult,requireVaultStoreId} from "../src/lib/vault-write-integrity.ts";

test("vault write preserves real boolean acknowledgements",()=>{
  assert.equal(requireVaultBooleanResult(true),true);
  assert.equal(requireVaultBooleanResult(false),false);
});

test("vault write rejects malformed RPC acknowledgements rather than coercing truthy JSON",()=>{
  for(const value of [
    null,undefined,0,1,"true","false","",[],[true],[false],{},
    {claimed:true},{deleted:false},{error:"unavailable"},
  ]){
    assert.throws(()=>requireVaultBooleanResult(value),/Malformed vault mutation RPC acknowledgement/);
  }
});

test("both vault routes validate owned delete, token claim and token delete replies",()=>{
  for(const path of [
    "src/app/api/measurements/vault/route.ts",
    "src/app/api/designer/vault/route.ts",
  ]){
    const source=readFileSync(path,"utf8");
    assert.ok(source.includes('import { requireVaultBooleanResult, requireVaultStoreId } from "@/lib/vault-write-integrity"'),path);
    assert.equal((source.match(/=requireVaultBooleanResult\(await rpc<unknown>\(/g)||[]).length,3,path);
    assert.doesNotMatch(source,/Boolean\((?:claimed|deleted)\)/,path);
    assert.match(source,/return jsonNoStore\(\{claimed\}\)/,path);
    assert.equal((source.match(/return jsonNoStore\(\{deleted\}\)/g)||[]).length,2,path);
  }
  const design=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  const claim=design.slice(design.indexOf('if(action==="claim")'),design.indexOf('if(action==="load")'));
  assert.match(claim,/const claimed=requireVaultBooleanResult\(await rpc<unknown>/);
  assert.match(claim,/if\(claimed\)\{/);
});


test("vault store accepts only literal PostgreSQL UUID receipts",()=>{
  const id="123e4567-e89b-12d3-a456-426614174000";
  assert.equal(requireVaultStoreId(id),id);
  assert.equal(requireVaultStoreId(id.toUpperCase()),id);
  for(const invalid of [
    null,undefined,0,1,true,false,[],[id],{id},
    "",` ${id}`,`${id} `,`${id}\\n`,`${id}.extra`,
    "123e4567-e89b-02d3-a456-426614174000",
    "123e4567-e89b-12d3-7456-426614174000",
  ]){
    assert.throws(()=>requireVaultStoreId(invalid),/Malformed vault store RPC acknowledgement/);
  }
});

test("both vault stores validate literal receipt before returning a recovery token or linking owner",()=>{
  for(const [path,store] of [
    ["src/app/api/designer/vault/route.ts","designer_locked_revision_vault_store"],
    ["src/app/api/measurements/vault/route.ts","measurement_profile_vault_store"],
  ]){
    const source=readFileSync(path,"utf8");
    assert.ok(source.includes('import { requireVaultBooleanResult, requireVaultStoreId } from "@/lib/vault-write-integrity"'),path);
    assert.ok(source.includes(`const vaultId=requireVaultStoreId(await rpc<unknown>("${store}",`),path);
    const verified=source.indexOf(`const vaultId=requireVaultStoreId(await rpc<unknown>("${store}",`);
    const token=source.indexOf("const recoveryToken=create",verified);
    const owner=source.indexOf("const linkStatus=await linkVaultOwnerBestEffort",verified);
    assert.ok(verified>=0&&token>verified&&owner>token,path);
    assert.doesNotMatch(source,/const vaultId=await rpc<string>/,path);
  }
});
