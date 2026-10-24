import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {describeMeasurementVaultSaveOutcome} from "../src/lib/measurement-vault-save-outcome.ts";

test("server success with denied browser storage retains truthful remote-save status",()=>{
  const text=describeMeasurementVaultSaveOutcome({localSaved:false,tokenCopied:false,expiresInDays:180});
  assert.match(text,/Secure copy saved on the server, but browser storage failed/);
  assert.match(text,/recovery token shown here/);
  assert.match(text,/required to retrieve or delete/);
  assert.match(text,/180 days/);
});

test("successful clipboard copy never hides browser storage failure",()=>{
  const text=describeMeasurementVaultSaveOutcome({localSaved:false,tokenCopied:true});
  assert.match(text,/server, but browser storage failed/);
  assert.match(text,/Recovery token copied/);
  assert.doesNotMatch(text,/Expires in/);
});

test("normal successful remote and local saves retain clear clipboard alternatives",()=>{
  assert.match(describeMeasurementVaultSaveOutcome({localSaved:true,tokenCopied:true,expiresInDays:120}),/Recovery token copied.*Secure copy saved.*120 days/);
  assert.match(describeMeasurementVaultSaveOutcome({localSaved:true,tokenCopied:false}),/Copy the recovery token shown here/);
});

test("secure measurement copy exposes token before attempting local writes",()=>{
  const source=readFileSync("src/components/MeasurementStudio.tsx","utf8");
  const start=source.indexOf("  async function saveSecureCopy()");
  const end=source.indexOf("  async function loadSecureCopy()",start);
  const store=source.slice(start,end);
  const responseCheck=store.indexOf("if(!response.ok||!result.recoveryToken)");
  const token=store.indexOf("setVaultToken(result.recoveryToken);");
  const local=store.indexOf("localStorage.setItem(MEASUREMENT_STORAGE_KEY");
  assert.ok(responseCheck>=0&&token>responseCheck&&local>token);
  assert.match(store,/try\{\s*localStorage\.setItem\(MEASUREMENT_STORAGE_KEY/);
  assert.match(store,/catch\{\s*\/\/ Server copy still exists/);
  assert.match(store,/let tokenCopied=false/);
  assert.match(store,/describeMeasurementVaultSaveOutcome\(/);
});
