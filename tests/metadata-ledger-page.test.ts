import test from "node:test";
import assert from "node:assert/strict";
import { hasCompleteOperatorMetadataPage, OPERATOR_METADATA_PAGE_LIMIT, verifyOperatorMetadataPage, verifyOperatorMetadataRowSequence, validateOperatorMetadataAvailability } from "../src/lib/designer/metadata-ledger-page.ts";

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

test("operator metadata page identities must be strictly ordered across page boundaries",()=>{
  const first=[
    {at:"2026-10-29T20:20:03.000Z",id:"z"},
    {at:"2026-10-29T20:20:02.000Z",id:"x"},
  ];
  const cursor=verifyOperatorMetadataRowSequence(first,null);
  assert.deepEqual(cursor,{at:"2026-10-29T20:20:02.000Z",id:"x"});
  assert.deepEqual(verifyOperatorMetadataRowSequence([
    {at:"2026-10-29T20:20:02.000Z",id:"w"},
    {at:"2026-10-29T20:20:01.000Z",id:"q"},
  ],cursor),{at:"2026-10-29T20:20:01.000Z",id:"q"});
  for(const rows of [
    [first[1]], // duplicate at the next offset page despite matching total
    [{at:"2026-10-29T20:20:02.000Z",id:"z"}], // wrong tie-break order
    [{at:"2026-10-29T20:20:04.000Z",id:"a"}], // newer event shifted into next page
    [{at:"not-a-timestamp",id:"a"}],
    [{at:"2026-10-29T20:20:01.000Z",id:"  a"}],
    [{at:"2026-10-29T20:20:01.000Z",id:null}],
    [null],
  ]) assert.equal(verifyOperatorMetadataRowSequence(rows,cursor),null,JSON.stringify(rows));
  assert.equal(verifyOperatorMetadataRowSequence([
    {at:"2026-10-29T20:20:01.000Z",id:"z"},
    {at:"2026-10-29T20:20:01.000Z",id:"z"},
  ],null),null);
});


test("operator availability evidence rejects JSON-coerced overrides that could hide an older sold-out veto",()=>{
  const ids=new Set(["linen-plain-60-sky-blue"]);
  const valid={subtype:"designer_fabric_metadata",fabricId:"linen-plain-60-sky-blue",availability:"unavailable"};
  for(const availability of ["unknown","available","unavailable"])
    assert.equal(validateOperatorMetadataAvailability({...valid,availability},ids),"valid");
  for(const availability of [["available"],["unknown"],{},null,true,false,0,undefined,"AVAILABLE",""])
    assert.equal(validateOperatorMetadataAvailability({...valid,availability},ids),"invalid",JSON.stringify(availability));
  for(const fabricId of [["linen-plain-60-sky-blue"]," linen-plain-60-sky-blue",
    "linen-plain-60-sky-blue ",null,{},true])
    assert.equal(validateOperatorMetadataAvailability({...valid,fabricId},ids),"invalid",JSON.stringify(fabricId));
  assert.equal(validateOperatorMetadataAvailability({...valid,subtype:["designer_fabric_metadata"]},ids),"invalid");
  assert.equal(validateOperatorMetadataAvailability({...valid,fabricId:"retired-catalogue-fabric"},ids),"unrelated");
  assert.equal(validateOperatorMetadataAvailability({subtype:"other_note",fabricId:valid.fabricId},ids),"unrelated");
  assert.equal(validateOperatorMetadataAvailability({note:"operator"},ids),"unrelated");
  assert.equal(validateOperatorMetadataAvailability(null,ids),"unrelated");
});
