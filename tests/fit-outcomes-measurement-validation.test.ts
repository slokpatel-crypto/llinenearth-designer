import test from "node:test";
import assert from "node:assert/strict";
import {fitOutcomeProportionFromMeasurements} from "../src/lib/designer/fit-outcomes.ts";

test("finite in-range centimetre readings populate the intended tailoring learning buckets",()=>{
  assert.deepEqual(
    fitOutcomeProportionFromMeasurements({
      shirt:{chest:105,waist:84},pants:{seat:111,waist:82},
    }),
    {torso:"tapered",seat:"pronounced"},
  );
  assert.deepEqual(fitOutcomeProportionFromMeasurements(null),{torso:"unknown",seat:"unknown"});
});

test("impossible readings never masquerade as real torso or seat proportions",()=>{
  for(const invalid of [Infinity,-Infinity,NaN,-2,0,351,"96",true]){
    assert.equal(
      fitOutcomeProportionFromMeasurements({
        shirt:{chest:invalid as number,waist:83},pants:{seat:invalid as number,waist:79},
      }).torso,"unknown",
    );
    assert.equal(
      fitOutcomeProportionFromMeasurements({
        shirt:{chest:101,waist:invalid as number},pants:{seat:106,waist:invalid as number},
      }).seat,"unknown",
    );
  }
});

test("an invalid garment dimension does not contaminate an independently valid bucket",()=>{
  assert.deepEqual(
    fitOutcomeProportionFromMeasurements({
      shirt:{chest:Infinity,waist:80},
      pants:{waist:82,seat:109},
    }),
    {torso:"unknown",seat:"pronounced"},
  );
});
