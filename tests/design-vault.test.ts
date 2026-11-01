import test from "node:test";
import assert from "node:assert/strict";
import {
  createDesignVaultAccessKey,
  createDesignVaultRecoveryToken,
  hashDesignVaultAccessKey,
  parseDesignVaultRecoveryToken,
  requireDesignVaultCreatedId,
} from "../src/lib/designer/design-vault.ts";

test("vault access keys are high-entropy URL-safe values",()=>{
  const a=createDesignVaultAccessKey();
  const b=createDesignVaultAccessKey();
  assert.match(a,/^[A-Za-z0-9_-]{40,80}$/);
  assert.notEqual(a,b);
  assert.equal(hashDesignVaultAccessKey(a).length,64);
});

test("vault recovery token round-trips without exposing the stored hash",()=>{
  const id="123e4567-e89b-12d3-a456-426614174000";
  const key=createDesignVaultAccessKey();
  const token=createDesignVaultRecoveryToken(id,key);
  const parsed=parseDesignVaultRecoveryToken(token);
  assert.ok(parsed);
  assert.equal(parsed?.vaultId,id);
  assert.equal(parsed?.accessKey,key);
  assert.equal(parsed?.accessHash,hashDesignVaultAccessKey(key));
  assert.equal(token.includes(parsed?.accessHash||""),false);
});

test("tampered or malformed recovery token is rejected",()=>{
  const id="123e4567-e89b-12d3-a456-426614174000";
  const key=createDesignVaultAccessKey();
  const token=createDesignVaultRecoveryToken(id,key);
  assert.equal(parseDesignVaultRecoveryToken(token.replace("lev1.","lev2.")),null);
  assert.equal(parseDesignVaultRecoveryToken("lev1.not-a-uuid.bad"),null);
  assert.equal(parseDesignVaultRecoveryToken(token+" extra"),null);
});

test("vault store acknowledgments require a canonicalizable UUID string before owner writes",()=>{
  const uuid="B287E470-0E90-4FD4-B5FB-976EECEBD244";
  assert.equal(requireDesignVaultCreatedId(uuid),uuid.toLowerCase());
  for(const value of [
    undefined,null,false,true,0,1,{},[],[uuid],{vaultId:uuid},"",
    "  "+uuid,uuid+" ","not-a-uuid",
    "b287e470-0e90-0fd4-b5fb-976eecebd244",
    "b287e470-0e90-4fd4-75fb-976eecebd244",
  ]) assert.throws(()=>requireDesignVaultCreatedId(value),/Invalid design vault creation acknowledgment/);
});
