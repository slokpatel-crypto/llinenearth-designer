import test from "node:test";
import assert from "node:assert/strict";
import {
  createDesignVaultAccessKey,
  createDesignVaultRecoveryToken,
  hashDesignVaultAccessKey,
  parseDesignVaultRecoveryToken,
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
