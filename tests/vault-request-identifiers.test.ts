import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseVaultRequestIdentifiers} from "../src/lib/vault-request-identifiers.ts";

test("owned vault actions accept only canonical UUID strings before auth or RPC",()=>{
  for(const action of ["loadOwned","deleteOwned"]){
    assert.deepEqual(parseVaultRequestIdentifiers(action,{vaultId:" 123E4567-E89B-12D3-A456-426614174000 "}),{
      ok:true,vaultId:"123e4567-e89b-12d3-a456-426614174000",recoveryToken:null,
    });
    for(const invalid of [
      undefined,null,0,true,{},["123e4567-e89b-12d3-a456-426614174000"]," \n ",
      "not-a-uuid","123e4567-e89b-02d3-a456-426614174000",
      "123e4567-e89b-12d3-7456-426614174000","123e4567e89b12d3a456426614174000",
      "123e4567-e89b-12d3-a456-426614174000.extra",
    ]){
      assert.deepEqual(parseVaultRequestIdentifiers(action,{vaultId:invalid}),{ok:false,field:"vaultId"},action);
    }
  }
});

test("recovery-token operations reject JSON array/object coercion instead of accepting a valid token",()=>{
  const token="lem1.123e4567-e89b-12d3-a456-426614174000."+"x".repeat(43);
  for(const action of ["claim","load","delete"]){
    assert.deepEqual(parseVaultRequestIdentifiers(action,{recoveryToken:" "+token+" "}),{
      ok:true,vaultId:null,recoveryToken:token,
    });
    for(const invalid of [undefined,null,7,true,{},[token]," \t "]){
      assert.deepEqual(parseVaultRequestIdentifiers(action,{recoveryToken:invalid}),{ok:false,field:"recoveryToken"},action);
    }
  }
});

test("store and list use existing payload validators without requiring a vault identifier",()=>{
  assert.deepEqual(parseVaultRequestIdentifiers("store",{}),{ok:true,vaultId:null,recoveryToken:null});
  assert.deepEqual(parseVaultRequestIdentifiers("listOwned",{}),{ok:true,vaultId:null,recoveryToken:null});
});

test("both API endpoints validate identifier type before customer lookup or RPC",()=>{
  for(const path of ["src/app/api/measurements/vault/route.ts","src/app/api/designer/vault/route.ts"]){
    const source=readFileSync(path,"utf8");
    const guard=source.indexOf("const identifiers=parseVaultRequestIdentifiers(action,body)");
    const auth=source.indexOf("const customer=await getCustomerIdentity(request)");
    assert.ok(guard>=0&&auth>guard,path);
    assert.match(source,/if\(!identifiers\.ok\)/);
    assert.match(source,/status:400/);
    assert.doesNotMatch(source,/String\(body\.(vaultId|recoveryToken)\|\|""\)/);
    assert.match(source,/identifiers\.recoveryToken!/);
    assert.match(source,/identifiers\.vaultId!/);
  }
});
