import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseVaultTimestamptz,selectVaultReadRow} from "../src/lib/vault-read-integrity.ts";

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

test("Postgres RPC timestamps reject impossible calendar days and clock times",()=>{
  for(const invalid of [
    "2027-02-29T12:00:00Z", // JS Date.parse normalizes nonleap February 29
    "2026-04-31T12:00:00Z",
    "2026-00-01T12:00:00Z",
    "2026-13-01T12:00:00Z",
    "2026-01-00T12:00:00Z",
    "2026-01-01T24:00:00Z", // JS Date.parse accepts 24:00
    "2026-01-01T23:60:00Z",
    "2026-01-01T23:59:60Z",
    "2026-01-01T23:59:59+00:60",
    "2026-01-01T23:59:59+16:00",
    "0000-01-01T00:00:00Z",
  ]){
    assert.equal(parseVaultTimestamptz(invalid),null,invalid);
    assert.equal(selectVaultReadRow([{...row,expires_at:invalid}],now),null,invalid);
  }
  for(const valid of [
    "2028-02-29T12:00:00Z",
    "2000-02-29T12:00:00.123456+05:30",
    "2026-10-27T17:30:00+05:30",
    "2026-10-27T12:00:00Z",
  ])assert.equal(parseVaultTimestamptz(valid),Date.parse(valid),valid);
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
