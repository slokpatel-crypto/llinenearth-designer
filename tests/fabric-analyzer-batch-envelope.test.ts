import test from "node:test";
import assert from "node:assert/strict";
import {
  FABRIC_ANALYZER_BATCH_LIMIT,
  FabricAnalyzerBatchInputError,
  parseFabricAnalyzerBatchEnvelope,
} from "../src/lib/fabric-analyzer-batch-envelope.ts";
import { readFileSync } from "node:fs";

test("batch envelope accepts exactly 1 to 12 supplied items without loss or reordering",()=>{
  for(const count of [1,2,FABRIC_ANALYZER_BATCH_LIMIT]) {
    const records=Array.from({length:count},(_,i)=>({fabricId:`fabric-${i+1}`}));
    const parsed=parseFabricAnalyzerBatchEnvelope<{fabricId:string}>({items:records});
    assert.deepEqual(parsed,records);
    assert.equal(parsed.length,count);
  }
});

test("batch endpoint must reject all of an oversized request, never process the first 12 silently",()=>{
  const input={items:Array.from({length:FABRIC_ANALYZER_BATCH_LIMIT+1},(_,i)=>({fabricId:`fabric-${i}`}))};
  assert.throws(()=>parseFabricAnalyzerBatchEnvelope(input),(error:unknown)=>{
    assert.ok(error instanceof FabricAnalyzerBatchInputError);
    assert.match(error.message,/at most 12.*none.*processed/i);
    return true;
  });
});

test("batch envelope rejects empty, malformed or non-object records instead of reporting success",()=>{
  for(const payload of [null,{},[],{items:null},{items:"rows"},{items:[]},{items:[null]},{items:[1]},{items:[[]]},{items:[{fabricId:"a"},false]}]) {
    assert.throws(()=>parseFabricAnalyzerBatchEnvelope(payload),FabricAnalyzerBatchInputError);
  }
});

test("real batch route uses the strict envelope without truncation",()=>{
  const source=readFileSync("src/app/api/operator/fabric-analyzer/batch/route.ts","utf8");
  assert.match(source,/parseFabricAnalyzerBatchEnvelope<BatchItem>\(/);
  assert.doesNotMatch(source,/body\.items\.slice\(0,12\)/);
  assert.match(source,/FabricAnalyzerBatchInputError/);
});
