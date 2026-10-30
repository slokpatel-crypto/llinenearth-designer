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
    assert.ok((code.match(/const row=selectVaultReadRow\(rows\);/g)||[]).length>=2,path);
    assert.doesNotMatch(code,/const row=rows\[0\]/,path);
  }
  const designer=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  assert.match(designer,/const revision=selectVaultReadRow\(rows\)\?\.payload/);
});

test("design account claim verifies the recoverable revision before owner mutation",()=>{
  const code=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  const start=code.indexOf('if(action==="claim")');
  const end=code.indexOf('if(action==="load")',start);
  assert.ok(start>=0&&end>start);
  const claim=code.slice(start,end);
  const read=claim.indexOf('"designer_locked_revision_vault_get"');
  const select=claim.indexOf('selectVaultReadRow(rows)?.payload');
  const missing=claim.indexOf('if(!revision) return jsonNoStore');
  const verify=claim.indexOf('if(!await verifyLockedDesignRevision(revision))');
  const attach=claim.indexOf('"designer_locked_revision_vault_set_owner"');
  const production=claim.indexOf('"production_claim_revision_ownership"');
  const success=claim.indexOf('return jsonNoStore({claimed})');
  assert.ok(read>=0&&select>read&&missing>select&&verify>missing
    &&attach>verify&&production>attach&&success>production);
  assert.match(claim,/if\(!revision\) return jsonNoStore\(\{error:"Design not found or recovery token expired\."\},\{status:404\}\)/);
  assert.match(claim,/if\(!await verifyLockedDesignRevision\(revision\)\)/);
  assert.match(claim,/\{error:"Stored design failed integrity verification\."\},\{status:409\}/);
  // A missing, duplicated, expired or invalid revision never reaches set_owner.
  for(const invalid of [[],[row,row],[{...row,expires_at:"2020-01-01T00:00:00Z"}]]){
    assert.equal(selectVaultReadRow(invalid,now),null);
  }
});

test("measurement account claim verifies profile and tailor observations before owner mutation",()=>{
  const code=readFileSync("src/app/api/measurements/vault/route.ts","utf8");
  const start=code.indexOf('if(action==="claim")');
  const end=code.indexOf('if(action==="load")',start);
  assert.ok(start>=0&&end>start);
  const claim=code.slice(start,end);
  const read=claim.indexOf('"measurement_profile_vault_get"');
  const select=claim.indexOf('const row=selectVaultReadRow(rows)');
  const missing=claim.indexOf('if(!row) return jsonNoStore');
  const measurement=claim.indexOf('validStoredMeasurementProfile(row.profile)');
  const observations=claim.indexOf('validStoredTailorObservationProfile(row.observations)');
  const attach=claim.indexOf('"measurement_profile_vault_set_owner"');
  const success=claim.indexOf('return jsonNoStore({claimed})');
  assert.ok(read>=0&&select>read&&missing>select
    &&measurement>missing&&observations>measurement&&attach>observations&&success>attach);
  assert.match(claim,/\{status:404\}/);
  assert.match(claim,/\{error:"Stored measurement profile failed integrity verification\."\},\{status:409\}/);
  // No owner-link call can precede envelope or profile validation.
  for(const invalid of [null,[],[row,row],[{...row,expires_at:"2020-01-01T00:00:00Z"}]]){
    assert.equal(selectVaultReadRow(invalid,now),null);
  }
});
