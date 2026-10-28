import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMeasuredBodyInput } from "../src/lib/designer/measurement-input-validation.ts";

const base={
  version:1,unit:"cm",shirt:{chest:"101.5",sleeve:64},pants:{inseam:"79"},
  updatedAt:"2028-02-29T12:00:00+05:30",
};

test("real tape readings retain their numeric values and valid timestamp",()=>{
  const profile=normalizeMeasuredBodyInput(base);
  assert.equal(profile?.unit,"cm");
  assert.deepEqual(profile?.shirt,{chest:101.5,sleeve:64});
  assert.deepEqual(profile?.pants,{inseam:79});
  assert.equal(profile?.updatedAt,base.updatedAt);
  assert.equal(normalizeMeasuredBodyInput(null),null);
});

test("coerced unit labels cannot silently switch measurement conversion",()=>{
  for(const unit of [["cm"],["in"],{toString:()=>"cm"},null,true,1,"CM","centimetres"]){
    assert.throws(()=>normalizeMeasuredBodyInput({...base,unit}),/display unit/);
  }
});

test("impossible or malformed supplied measurement timestamps are rejected",()=>{
  for(const updatedAt of [
    "2027-02-29T12:00:00Z","2028-02-30T12:00:00Z",
    "2028-02-29T24:00:00Z","2028-02-29T12:60:00Z",
    "2028-02-29T12:00:00+15:00","yesterday","",
    null,0,["2028-02-29T12:00:00Z"],
  ])assert.throws(()=>normalizeMeasuredBodyInput({...base,updatedAt}),/timestamp/);
});

test("legacy omitted timestamps remain compatible without accepting fabricated dates",()=>{
  const {updatedAt:_unused,...withoutTimestamp}=base;
  const result=normalizeMeasuredBodyInput(withoutTimestamp);
  assert.ok(result?.updatedAt);
  assert.ok(Number.isFinite(Date.parse(result.updatedAt)));
});

test("invalid explicit tape readings are never downgraded to missing",()=>{
  for(const chest of ["0x64","1e2","NaN",-1,0,351,Infinity,true]){
    assert.throws(()=>normalizeMeasuredBodyInput({...base,shirt:{chest}}),/measurement/);
  }
});
