import test from "node:test";
import assert from "node:assert/strict";
import {normalizeFabricPhysicalEvidenceProvenance,hasFabricPhysicalEvidenceProvenance} from "../src/lib/fabric-physical-provenance.ts";

const valid={sourceType:"physical_roll",reference:"Roll B-21 measured with a ruler",checkedBy:"Operator A",evidenceDate:"2026-10-27",sourceUrl:"https://supplier.example/roll/B-21"};

test("real roll provenance retains exact source fields",()=>{
  assert.deepEqual(normalizeFabricPhysicalEvidenceProvenance(valid),valid);
  assert.equal(hasFabricPhysicalEvidenceProvenance(valid),true);
  assert.deepEqual(normalizeFabricPhysicalEvidenceProvenance({...valid,sourceUrl:""}),{sourceType:valid.sourceType,reference:valid.reference,checkedBy:valid.checkedBy,evidenceDate:valid.evidenceDate});
});

test("impossible, noncanonical, and future physical inspection dates are rejected",()=>{
  for(const evidenceDate of ["2026-02-30","2026-13-01","2026-00-10","2026-2-1","2027-01-01","not a date",42]){
    assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,evidenceDate}),null,String(evidenceDate));
  }
});

test("physical evidence links require HTTPS without embedded credentials",()=>{
  for(const sourceUrl of ["http://supplier.example/roll","javascript:alert(1)","https://user:secret@supplier.example/path","https://","data:text/html,hi",{}]){
    assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,sourceUrl}),null,String(sourceUrl));
  }
});

test("coerced, truncated, and missing provenance cannot certify physical facts",()=>{
  for(const change of [
    {checkedBy:{toString:()=>"Inspector"}},
    {reference:123456},
    {sourceType:["physical_roll"]},
    {checkedBy:"A".repeat(121)},
    {reference:"R".repeat(221)},
    {sourceUrl:"https://supplier.example/"+"a".repeat(600)},
  ]) assert.equal(normalizeFabricPhysicalEvidenceProvenance({...valid,...change}),null,JSON.stringify(change));
});
