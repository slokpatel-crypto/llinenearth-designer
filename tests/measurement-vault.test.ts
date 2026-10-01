import test from "node:test";
import assert from "node:assert/strict";
import {
  createMeasurementVaultAccessKey,
  createMeasurementVaultRecoveryToken,
  hashMeasurementVaultAccessKey,
  parseMeasurementVaultRecoveryToken,
} from "../src/lib/measurement-vault.ts";

test("measurement vault token round-trips with a hashed server credential",()=>{
  const id="123e4567-e89b-12d3-a456-426614174000";
  const key=createMeasurementVaultAccessKey();
  const token=createMeasurementVaultRecoveryToken(id,key);
  const parsed=parseMeasurementVaultRecoveryToken(token);
  assert.ok(parsed);
  assert.equal(parsed?.vaultId,id);
  assert.equal(parsed?.accessHash,hashMeasurementVaultAccessKey(key));
  assert.equal(token.includes(parsed?.accessHash||""),false);
});

test("invalid measurement vault tokens are rejected",()=>{
  assert.equal(parseMeasurementVaultRecoveryToken("lem1.bad.bad"),null);
  assert.equal(parseMeasurementVaultRecoveryToken("lev1.123e4567-e89b-12d3-a456-426614174000."+createMeasurementVaultAccessKey()),null);
});
