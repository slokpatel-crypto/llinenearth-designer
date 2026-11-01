import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkDesignVaultRateLimit,VAULT_RATE_MAX_SUBJECTS,VAULT_RATE_WINDOW_MS} from "../src/lib/designer/design-vault-rate-limit.ts";

test("vault limiter admits 30 per identity then denies and resets after one minute",()=>{
  const map=new Map();
  const t=1_800_000_000_000;
  for(let n=0;n<30;n++)assert.equal(checkDesignVaultRateLimit(map,"synthetic-ip",t),false);
  assert.equal(checkDesignVaultRateLimit(map,"synthetic-ip",t),true);
  assert.equal(checkDesignVaultRateLimit(map,"another",t),false);
  assert.equal(map.get("synthetic-ip")?.count,31);
  assert.equal(checkDesignVaultRateLimit(map,"synthetic-ip",t+VAULT_RATE_WINDOW_MS),false);
  assert.equal(map.get("synthetic-ip")?.count,1);
});

test("vault limiter never grows an unbounded map under forged identifiers",()=>{
  const map=new Map();
  const t=1_800_000_000_000;
  for(let n=0;n<VAULT_RATE_MAX_SUBJECTS;n++)
    assert.equal(checkDesignVaultRateLimit(map,"untrusted-"+n,t),false);
  assert.equal(map.size,VAULT_RATE_MAX_SUBJECTS);
  for(let n=0;n<256;n++)
    assert.equal(checkDesignVaultRateLimit(map,"overflow-"+n,t),true);
  assert.equal(map.size,VAULT_RATE_MAX_SUBJECTS);
  // Existing slots still obey their own per-subject limit, not full-map denial.
  assert.equal(checkDesignVaultRateLimit(map,"untrusted-0",t),false);
  assert.equal(map.size,VAULT_RATE_MAX_SUBJECTS);
  // Expired slots are swept at capacity, allowing the next minute's identities.
  assert.equal(checkDesignVaultRateLimit(map,"new-client",t+VAULT_RATE_WINDOW_MS),false);
  assert.equal(map.size,1);
  assert.equal(map.has("untrusted-0"),false);
});

test("vault limiter bounds identity length, rejects invalid time and guards clock regressions",()=>{
  const map=new Map();
  const t=1_800_000_000_000;
  assert.equal(checkDesignVaultRateLimit(map," x".repeat(512),t),false);
  const stored=[...map.keys()][0];
  assert.equal(stored.length<=128,true);
  assert.equal(checkDesignVaultRateLimit(map,"",t),false);
  assert.equal(map.has("unknown"),true);
  assert.equal(checkDesignVaultRateLimit(map,"subject",Number.NaN),true);
  assert.equal(checkDesignVaultRateLimit(map,"subject",-1),true);
  assert.equal(map.has("subject"),false);
  assert.equal(checkDesignVaultRateLimit(map,"another",t),false);
  assert.equal(checkDesignVaultRateLimit(map,"another",t-1),false);
  assert.equal(map.get("another")?.at,t-1);
});

test("vault route enforces cardinality bound before customer work and retains no-store denial",()=>{
  const source=readFileSync("src/app/api/designer/vault/route.ts","utf8");
  assert.match(source,/checkDesignVaultRateLimit\(rate,ip,Date\.now\(\)\)/);
  assert.match(source,/__linenDesignVaultRate\?:Map<string,VaultRateEntry>/);
  assert.match(source,/if\(blocked\(request\)\) return jsonNoStore\(\{error:"Too many design-vault requests\."\},\{status:429\}\)/);
  assert.match(source,/private, no-store/);
  assert.doesNotMatch(source,/rate\.set\(ip,/);
});
