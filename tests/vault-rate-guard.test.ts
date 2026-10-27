import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MAX_VAULT_RATE_KEYS,vaultRateBlocked,type VaultRateStore} from "../src/lib/vault-rate-guard.ts";

test("existing one-minute 30-request per identity limit stays unchanged",()=>{
  const entries:VaultRateStore=new Map();
  for(let i=0;i<30;i++) assert.equal(vaultRateBlocked(entries,"203.0.113.8",1_000),false);
  assert.equal(vaultRateBlocked(entries,"203.0.113.8",1_000),true);
  assert.equal(vaultRateBlocked(entries,"198.51.100.9",1_000),false);
  assert.equal(vaultRateBlocked(entries,"203.0.113.8",61_001),false);
  assert.equal(entries.get("203.0.113.8")?.count,1);
});

test("many unique identities never grow the process cache without bound",()=>{
  const entries:VaultRateStore=new Map();
  for(let i=0;i<MAX_VAULT_RATE_KEYS*3;i++){
    assert.equal(vaultRateBlocked(entries,`ip-${i}`,1_000),false);
    assert.ok(entries.size<=MAX_VAULT_RATE_KEYS);
  }
  assert.equal(entries.size,MAX_VAULT_RATE_KEYS);
});

test("expired records are collected at capacity before recent identities are evicted",()=>{
  const entries:VaultRateStore=new Map([["expired",{at:0,count:99}]]);
  for(let i=1;i<MAX_VAULT_RATE_KEYS;i++){
    entries.set(`current-${i}`,{at:120_000,count:1});
  }
  assert.equal(vaultRateBlocked(entries,"new",120_000),false);
  assert.equal(entries.has("expired"),false);
  assert.equal(entries.has("current-1"),true);
  assert.equal(entries.size,MAX_VAULT_RATE_KEYS);
});

test("malformed huge forwarded identities cannot create huge cache keys",()=>{
  const entries:VaultRateStore=new Map();
  assert.equal(vaultRateBlocked(entries,"x".repeat(100_000),1_000),false);
  assert.deepEqual([...entries.keys()],["unknown"]);
  assert.equal(vaultRateBlocked(entries,"",1_000),false);
  assert.equal(entries.get("unknown")?.count,2);
  assert.equal(vaultRateBlocked(entries,"unknown",0),false); // backwards clock resets safely
});

test("both recovery vault routes use the same bounded process-local limiter",()=>{
  for(const path of ["src/app/api/measurements/vault/route.ts","src/app/api/designer/vault/route.ts"]){
    const code=readFileSync(path,"utf8");
    assert.match(code,/import \{ vaultRateBlocked \} from "@\/lib\/vault-rate-guard";/);
    assert.match(code,/return vaultRateBlocked\(rate,ip\);/);
    assert.doesNotMatch(code,/current\.count\+=1/);
  }
});

test("active throttled identities outlive cold keys when a full cache evicts",()=>{
  const entries:VaultRateStore=new Map([["hot",{at:1_000,count:30}]]);
  for(let i=1;i<MAX_VAULT_RATE_KEYS;i++) entries.set(`cold-${i}`,{at:1_000,count:1});
  assert.equal(vaultRateBlocked(entries,"hot",1_000),true);
  assert.equal(vaultRateBlocked(entries,"new",1_000),false);
  assert.equal(entries.has("hot"),true);
  assert.equal(entries.get("hot")?.count,31);
  assert.equal(entries.has("cold-1"),false);
  assert.equal(entries.size,MAX_VAULT_RATE_KEYS);
});
