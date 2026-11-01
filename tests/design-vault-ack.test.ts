import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requireDesignVaultBooleanAck} from "../src/lib/designer/design-vault-ack.ts";

test("design vault mutation acknowledges only literal JSON booleans",()=>{
  assert.equal(requireDesignVaultBooleanAck(true),true);
  assert.equal(requireDesignVaultBooleanAck(false),false);
  for(const value of [null,undefined,"true","false","0","",0,1,[],[false],{}, {deleted:false},{claimed:false}]){
    assert.throws(()=>requireDesignVaultBooleanAck(value),/Invalid design vault acknowledgment/);
  }
});

test("every vault owner/deletion mutation rejects false-success HTTP 200 envelopes",()=>{
  const src=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  for(const name of [
    "designer_locked_revision_vault_set_owner",
    "designer_locked_revision_vault_delete_owned",
    "designer_locked_revision_vault_delete",
  ]){
    const occurrences=src.split('rpc<unknown>("'+name+'"').length-1;
    assert.equal(occurrences,name==="designer_locked_revision_vault_set_owner"?2:1,name);
    assert.doesNotMatch(src,new RegExp('rpc<boolean>\\("'+name+'"'));
  }
  assert.equal((src.match(/requireDesignVaultBooleanAck\(await rpc<unknown>/g)||[]).length,4);
  assert.doesNotMatch(src,/Boolean\(deleted\)|Boolean\(claimed\)|accountOwned=Boolean/);
  assert.match(src,/return jsonNoStore\(\{deleted\}\)/);
  assert.match(src,/return jsonNoStore\(\{claimed\}\)/);
});
