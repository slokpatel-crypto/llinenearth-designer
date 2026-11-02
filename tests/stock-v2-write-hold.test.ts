import test from "node:test";
import assert from "node:assert/strict";
import {legacyStockWritesEnabled} from "../src/lib/designer/stock-v2-write-hold.ts";

test("legacy physical stock writes are not enabled in any ordinary deployment",()=>{
  for(const flag of [undefined,"","enabled","true","test-v2-only"]){
    assert.equal(legacyStockWritesEnabled(flag,undefined,"http://127.0.0.1:3422",undefined),false);
    assert.equal(legacyStockWritesEnabled(flag,"enabled","https://live.supabase.co",undefined),false);
    assert.equal(legacyStockWritesEnabled(flag,"enabled","http://127.0.0.1:3422","1"),false);
  }
});

test("the legacy write hold opens only to the isolated synthetic localhost HTTP harness",()=>{
  assert.equal(legacyStockWritesEnabled("test-v2-only","enabled","http://127.0.0.1:3422",undefined),true);
  assert.equal(legacyStockWritesEnabled("test-v2-only","enabled","http://localhost:3422",undefined),false);
  assert.equal(legacyStockWritesEnabled("test-v2-only","enabled","http://127.0.0.1:3422/path",undefined),false);
  assert.equal(legacyStockWritesEnabled("test-v2-only","enabled","https://127.0.0.1:3422",undefined),false);
  assert.equal(legacyStockWritesEnabled("test-v2-only","enabled","http://127.0.0.1:3422","1"),false);
  assert.equal(legacyStockWritesEnabled("enabled","enabled","http://127.0.0.1:3422",undefined),false);
});
