import test from "node:test";
import assert from "node:assert/strict";
import {
  GARMENT_OPTION_LIBRARY, optionById, validateGarmentOptionLibrary,
} from "../src/lib/designer/options/library.ts";

test("indexed designer option lookup keeps the original first-match identity and metadata",()=>{
  const originalFirstMatches=new Map<string,(typeof GARMENT_OPTION_LIBRARY)[number]>();
  for(const option of GARMENT_OPTION_LIBRARY) {
    if(!originalFirstMatches.has(option.id)) originalFirstMatches.set(option.id,option);
  }
  for(const [id,expected] of originalFirstMatches) {
    assert.equal(optionById(id),expected,"All indexed options must resolve to existing exact objects");
  }
  assert.equal(optionById("does_not_exist"),null);
  assert.equal(optionById(""),null);
  assert.deepEqual(validateGarmentOptionLibrary(),[]);
});

test("rapid repeated option lookups do not change the deterministic option catalog",()=>{
  const ids=GARMENT_OPTION_LIBRARY.map((option)=>option.id);
  const before=ids.map((id)=>optionById(id));
  for(let iteration=0;iteration<100;iteration++) {
    for(const id of ids) assert.ok(optionById(id));
  }
  assert.deepEqual(ids.map((id)=>optionById(id)),before);
});
