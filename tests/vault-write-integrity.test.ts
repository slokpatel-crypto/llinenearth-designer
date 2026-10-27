import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireVaultBooleanResult} from "../src/lib/vault-write-integrity.ts";

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
    assert.match(source,/import \{ requireVaultBooleanResult \} from "@\/lib\/vault-write-integrity"/,path);
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
