import test from "node:test";
import assert from "node:assert/strict";
import { hasCompleteOperatorMetadataPage, OPERATOR_METADATA_PAGE_LIMIT, verifyOperatorMetadataPage } from "../src/lib/designer/metadata-ledger-page.ts";

test("complete PostgREST metadata histories are distinguishable from empty and truncated histories", () => {
  assert.equal(hasCompleteOperatorMetadataPage([], "*/0"), true);
  assert.equal(hasCompleteOperatorMetadataPage([{ at: "x" }], "0-0/1"), true);
  assert.equal(hasCompleteOperatorMetadataPage(Array.from({ length: 1000 }, (_, i) => i), "0-999/1000"), true);
  for (const [rows, range] of [
    [[], null], [[], "*/1"], [[], "0-0/0"],
    [[{ at: "x" }], null], [[{ at: "x" }], "0-0/*"],
    [[{ at: "x" }], "0-0/2"], [[{ at: "x" }], "1-1/1"],
    [[{ at: "x" }], "0-1/1"],
    [Array.from({ length: 1000 }, (_, i) => i), "0-999/1001"],
    [Array.from({ length: 1001 }, (_, i) => i), "0-1000/1001"],
    [null, "*/0"], [{ at: "x" }, "0-0/1"],
  ] as Array<[unknown, string | null]>) {
    assert.equal(hasCompleteOperatorMetadataPage(rows, range), false, String(range));
  }
  assert.equal(OPERATOR_METADATA_PAGE_LIMIT, 1000);
});


test("exact paginated metadata rejects moving, incomplete and uncounted pages",()=>{
  const full=Array(1000).fill({at:"2026-10-29"});
  const first=verifyOperatorMetadataPage(full,"0-999/1202",0,null);
  assert.deepEqual(first,{status:"continue",total:1202});
  assert.deepEqual(verifyOperatorMetadataPage(Array(202).fill({}),"1000-1201/1202",1000,1202),
    {status:"complete",total:1202});
  assert.deepEqual(verifyOperatorMetadataPage(full,"0-999/1000",0,null),{status:"complete",total:1000});
  assert.deepEqual(verifyOperatorMetadataPage([],"*/0",0,null),{status:"complete",total:0});
  for(const [rows,range,offset,previous] of [
    [full,null,0,null],
    [full,"0-999/*",0,null],
    [full,"0-998/1202",0,null],
    [full,"1-1000/1202",0,null],
    [full,"0-999/1203",0,1202],
    [Array(202).fill({}),"1000-1201/1203",1000,1202],
    [Array(202).fill({}),"1000-1201/1400",1000,1400],
    [[], "*/0",1000,1000],
    [Array(1001).fill({}),"0-1000/1001",0,null],
    [false, "*/0",0,null],
  ] as Array<[unknown,string|null,number,number|null]>)
    assert.deepEqual(verifyOperatorMetadataPage(rows,range,offset,previous),{status:"invalid",total:null},String(range));
});
