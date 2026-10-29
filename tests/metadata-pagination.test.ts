import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { metadataPageDisposition } from "../src/lib/designer/metadata-pagination.ts";

test("metadata history cannot count a full 1000-row page as complete",()=>{
  assert.equal(metadataPageDisposition(Array(999).fill({}),1000),"complete");
  assert.equal(metadataPageDisposition([],1000),"complete");
  assert.equal(metadataPageDisposition(Array(1000).fill({}),1000),"continue");
  assert.equal(metadataPageDisposition(Array(1001).fill({}),1000),"invalid");
  for(const invalid of [null,{},false,"[]",new Map()])
    assert.equal(metadataPageDisposition(invalid,1000),"invalid");
  for(const size of [0,-1,NaN,Infinity,1.5])
    assert.equal(metadataPageDisposition([],size),"invalid");
});

test("customer metadata read uses stable complete bounded pagination, not an arbitrary first page",()=>{
  const source=readFileSync(new URL("../src/lib/designer-fabric-metadata.ts",import.meta.url),"utf8");
  assert.match(source,/const PAGE_SIZE=1_000/);
  assert.match(source,/const MAX_PAGES=5/);
  assert.match(source,/order:"at.desc,id.desc"/);
  assert.match(source,/offset:String\(page\*PAGE_SIZE\)/);
  assert.match(source,/metadataPageDisposition\(rows,PAGE_SIZE\)==="complete"/);
  assert.match(source,/operator history exceeds bounded read/);
  assert.match(source,/return unavailable\(\)/);
  assert.match(source,/const signal=AbortSignal\.timeout\(8_000\)/);
});
