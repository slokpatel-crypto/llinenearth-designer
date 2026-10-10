import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {normalizeMeasuredBodyInput}
  from "../src/lib/designer/measurement-input-validation.ts";

const body={
  version:1,unit:"in",
  shirt:{neck:38,chest:99,waist:88,shoulder:44,sleeve:63,bicep:31},
  pants:{waist:84,seat:103,frontRise:28,inseam:76,outseam:106},
  updatedAt:"2026-10-10T00:00:00Z",
};

test("body measurement input preserves exact known centimetre values and does not reconvert when display unit is inches",()=>{
  assert.deepEqual(normalizeMeasuredBodyInput(body),body);
  assert.equal(normalizeMeasuredBodyInput(null),null);
  assert.equal(normalizeMeasuredBodyInput(undefined),null);
  assert.deepEqual(normalizeMeasuredBodyInput({...body,shirt:{chest:"98.7"},pants:{inseam:"75.2"}})?.shirt,{chest:98.7});
});

test("invalid or impossible supplied tape readings must not vanish from server assessment",()=>{
  for(const invalid of [
    {...body,shirt:{...body.shirt,chest:-4}},
    {...body,shirt:{...body.shirt,chest:0}},
    {...body,shirt:{...body.shirt,chest:"NaN"}},
    {...body,shirt:{...body.shirt,chest:Infinity}},
    {...body,pants:{...body.pants,outseam:351}},
    {...body,pants:{...body.pants,frontRise:"oops"}},
    {...body,pants:{...body.pants,waist:[]}},
    {...body,shirt:{...body.shirt,chest:true}},
  ])assert.throws(()=>normalizeMeasuredBodyInput(invalid),/Invalid .* measurement/);
});

test("incorrect measurement schema and unknown tape landmarks are rejected",()=>{
  assert.throws(()=>normalizeMeasuredBodyInput({...body,version:2}),/version or display unit/);
  assert.throws(()=>normalizeMeasuredBodyInput({...body,unit:"yards"}),/version or display unit/);
  assert.throws(()=>normalizeMeasuredBodyInput({...body,shirt:"38"}),/shirt measurements/);
  assert.throws(()=>normalizeMeasuredBodyInput({...body,pants:[]}),/trouser measurements/);
  assert.throws(()=>normalizeMeasuredBodyInput({...body,shirt:{chset:98}}),/Unsupported shirt/);
  assert.throws(()=>normalizeMeasuredBodyInput([]),/Invalid body measurement/);
});

test("blank optional tape readings stay blank; real numeric fields are preserved for tailor validation",()=>{
  const result=normalizeMeasuredBodyInput({...body,shirt:{chest:103,wrist:"",neck:null},pants:{waist:86,hem:undefined}});
  assert.deepEqual(result?.shirt,{chest:103});
  assert.deepEqual(result?.pants,{waist:86});
  assert.equal(result?.unit,"in");
});

test("API clearly rejects invalid advanced cut and invalid measurement independently",()=>{
  const source=readFileSync("src/app/api/designer/assess/route.ts","utf8");
  assert.ok(source.includes("normalizeMeasuredBodyInput(value)"));
  assert.ok(source.includes("measurements=safeMeasurements(body.measurements)"));
  assert.ok(source.includes("Invalid body measurements."));
  assert.ok(source.includes("status:422"));
  assert.ok(source.includes("body.styleSpec!==undefined && body.styleSpec!==null && !styleSpec"));
});
