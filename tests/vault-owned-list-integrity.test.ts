import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isVaultListRowEnvelope,ownedDesignVaultRowMatchesPayload,requireCompleteOwnedVaultRows} from "../src/lib/vault-owned-list-integrity.ts";

const row={
  vault_id:"123e4567-e89b-12d3-a456-426614174000",
  revision_id:"LE-LOCK-20261027180000-ABCDEF123456",
  recipe_hash:"a".repeat(64),
  payload:{
    revisionId:"LE-LOCK-20261027180000-ABCDEF123456",
    recipeHash:"a".repeat(64),
  },
  created_at:"2026-10-27T12:00:00Z",
  expires_at:"2027-04-25T12:00:00Z",
};

test("owned design list accepts matching index and revision identities",()=>{
  assert.equal(isVaultListRowEnvelope(row),true);
  assert.equal(ownedDesignVaultRowMatchesPayload(row),true);
});

test("owned design list rejects mismatched hashes, revision IDs or malformed RPC rows",()=>{
  for(const value of [
    null,{},[],{...row,vault_id:["123e4567-e89b-12d3-a456-426614174000"]},
    {...row,vault_id:"bad-id"},
    {...row,created_at:"not-a-date"},
    {...row,expires_at:null},
    {...row,payload:null},
    {...row,payload:{...row.payload,recipeHash:"b".repeat(64)}},
    {...row,payload:{...row.payload,revisionId:"another-order"}},
    {...row,recipe_hash:"b".repeat(64)},
    {...row,revision_id:"another-order"},
  ]){
    assert.equal(ownedDesignVaultRowMatchesPayload(value),false);
  }
});

test("measurement list shares the same null, UUID and date validation without requiring design metadata",()=>{
  const minimal={vault_id:row.vault_id,created_at:row.created_at,expires_at:row.expires_at};
  assert.equal(isVaultListRowEnvelope(minimal),true);
  assert.equal(ownedDesignVaultRowMatchesPayload(minimal),false);
  assert.equal(isVaultListRowEnvelope(null),false);
  assert.equal(isVaultListRowEnvelope({...minimal,created_at:42}),false);
});


test("owned list excludes expired, impossible and ambiguous timestamped RPC rows",()=>{
  const now=Date.parse("2026-10-27T12:10:00Z");
  assert.equal(isVaultListRowEnvelope(row,now),true);
  assert.equal(ownedDesignVaultRowMatchesPayload(row,now),true);
  for(const record of [
    {...row,expires_at:"2026-10-27T12:10:00Z"}, // equality expires
    {...row,expires_at:"2026-10-27T12:09:59Z"}, // expired
    {...row,expires_at:"2026-10-27T11:59:59Z"}, // expiry before creation
    {...row,created_at:"2027-04-26T12:00:00Z"}, // creation after expiry
    {...row,created_at:"2026-10-27"}, // not an offset-bearing instant
    {...row,expires_at:"2027-04-25"}, // previously accepted by Date.parse
    {...row,expires_at:"2027-04-25T12:00:00"}, // ambiguous local time
    {...row,created_at:42},
  ]){
    assert.equal(isVaultListRowEnvelope(record,now),false);
    assert.equal(ownedDesignVaultRowMatchesPayload(record,now),false);
  }
  assert.equal(isVaultListRowEnvelope(row,Number.NaN),false);
  assert.equal(ownedDesignVaultRowMatchesPayload(row,Number.POSITIVE_INFINITY),false);
  // Server and Vercel JS may use a different TZ; explicit offsets normalize.
  assert.equal(isVaultListRowEnvelope({...row,created_at:"2026-10-27T17:30:00+05:30"},now),true);
});

test("both owned-list endpoints validate untrusted row envelopes before UI serialization",()=>{
  const designer=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  const measurements=readFileSync("src/app/api/measurements/vault/route.ts","utf8");
  assert.match(designer,/requireCompleteOwnedVaultRows\(rows,100\)/);
  assert.match(designer,/if\(!ownedDesignVaultRowMatchesPayload\(row\)\|\|!await verifyLockedDesignRevision\(row\.payload\)\)/);
  assert.match(measurements,/requireCompleteOwnedVaultRows\(rows\)/);
  assert.match(measurements,/if\(!profile\|\|!observations\) throw new Error\("Invalid owned measurement vault row\."\)/);
  // The positive guard above checks that corrupt rows throw before serialization.
  // A valid designs.push followed by loop closure must remain allowed.
  assert.doesNotMatch(measurements,/rows\.filter\(/);
});

test("owned vault lists reject malformed, repeated and padded identities instead of silently hiding rows",()=>{
  const id=row.vault_id;
  assert.doesNotThrow(()=>requireCompleteOwnedVaultRows([]));
  assert.doesNotThrow(()=>requireCompleteOwnedVaultRows([row]));
  assert.doesNotThrow(()=>requireCompleteOwnedVaultRows([{...row,vault_id:id.toUpperCase()}]));
  for(const invalid of [
    null,{},[null],[[]],[{...row,vault_id:` ${id}`}],
    [{...row,vault_id:`${id} `}],
    [row,{...row,vault_id:id.toUpperCase()}],
    [{...row,expires_at:"2020-01-01T00:00:00Z"}],
    [{...row,created_at:"not-a-date"}],
  ])assert.throws(()=>requireCompleteOwnedVaultRows(invalid),/Malformed owned vault list acknowledgement/);
});
