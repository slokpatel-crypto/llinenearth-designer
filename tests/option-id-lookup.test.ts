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

test("indexed group and legacy-label selection preserve every original result and first match",async()=>{
  const {optionsFor,legacyOptionByLabel,legacyLabelsFor}=await import(
    "../src/lib/designer/options/library.ts");
  const groups=[...new Set(GARMENT_OPTION_LIBRARY.map((option)=>option.group))];
  for(const group of groups) {
    const original=GARMENT_OPTION_LIBRARY.filter((option)=>option.group===group);
    const chosen=optionsFor(group);
    assert.deepEqual(chosen,original,`group ${group} must retain original order`);
    for(let i=0;i<original.length;i++) assert.equal(chosen[i],original[i]);
    assert.deepEqual(legacyLabelsFor(group),original.filter((option)=>
      option.legacyLabel&&option.legacySelectable!==false).map((option)=>option.legacyLabel));
    for(const option of original) {
      if(option.legacyLabel===undefined) continue;
      assert.equal(legacyOptionByLabel(group,option.legacyLabel),
        original.find((row)=>row.legacyLabel===option.legacyLabel),
        `first exact label must win for ${group}/${option.legacyLabel}`);
    }
    assert.equal(legacyOptionByLabel(group,"NOT_A_REAL_LABEL"),null);
    // The indexed source must not leak a shared mutable collection: earlier
    // .filter() returned a new array for every consumer.
    const safe=optionsFor(group);
    safe.reverse();
    safe.splice(0,safe.length);
    const labels=legacyLabelsFor(group);
    labels.reverse();
    labels.splice(0,labels.length);
    assert.deepEqual(optionsFor(group),original);
    assert.deepEqual(legacyLabelsFor(group),original.filter((option)=>
      option.legacyLabel&&option.legacySelectable!==false).map((option)=>option.legacyLabel));
  }
});
