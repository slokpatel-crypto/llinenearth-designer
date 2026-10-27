import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {selectVaultReadRow} from "../src/lib/vault-read-integrity.ts";

const now=Date.parse("2026-10-27T12:00:00Z");
const row={expires_at:"2027-04-25T12:00:00+00:00",payload:{version:"linen-earth-design-lock-v1"}};

test("vault recovery accepts one current timestamped RPC record",()=>{
  assert.deepEqual(selectVaultReadRow([row],now),row);
  assert.deepEqual(selectVaultReadRow([{...row,expires_at:"2027-04-25T12:00:00.123456Z"}],now)?.payload,row.payload);
});

test("vault recovery refuses malformed or duplicated RPC payloads",()=>{
  for(const response of [
    null,undefined,{},row,"row",[],[null],[[]],["row"],[row,row],
    [{...row,expires_at:undefined}],
    [{...row,expires_at:null}],
    [{...row,expires_at:4}],
    [{...row,expires_at:"2027-04-25"}],
    [{...row,expires_at:"not-a-date"}],
    [{...row,expires_at:"2027-04-25T12:00:00"}],
    [{...row,expires_at:"2027-04-25T12:00:00+99:99"}],
  ]){
    assert.equal(selectVaultReadRow(response,now),null);
  }
});

test("expired, equal-boundary and nonfinite current times fail closed",()=>{
  const expires=Date.parse("2027-04-25T12:00:00Z");
  assert.equal(selectVaultReadRow([row],expires-1)?.expires_at,row.expires_at);
  assert.equal(selectVaultReadRow([row],expires),null);
  assert.equal(selectVaultReadRow([row],expires+1),null);
  assert.equal(selectVaultReadRow([row],Number.NaN),null);
});

test("both vault routes validate all token and account read RPC envelopes",()=>{
  for(const path of [
    "src/app/api/designer/vault/route.ts",
    "src/app/api/measurements/vault/route.ts",
  ]){
    const code=readFileSync(path,"utf8");
    assert.match(code,/import \{ selectVaultReadRow \} from "@\/lib\/vault-read-integrity"/);
    // Account load + recovery-token load must independently check the RPC row.
    assert.equal((code.match(/const row=selectVaultReadRow\(rows\);/g)||[]).length,2,path);
    assert.doesNotMatch(code,/const row=rows\[0\]/,path);
  }
  const designer=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  assert.match(designer,/const revision=selectVaultReadRow\(rows\)\?\.payload/);
});
