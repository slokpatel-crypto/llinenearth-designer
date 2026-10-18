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

import {aggregateFitOutcomes,fitOutcomeSignalFor} from "../src/lib/designer/fit-outcomes.ts";

test("unmeasured or corrupt profiles cannot improve a measured customer's fit-learning signal",()=>{
  const event=(id:string,torso:string,seat:string,verdict:string)=>({
    type:"operator_note",source:"operator",payload:{subtype:"designer_fit_outcome",
      recommendationId:id,verdict,occasion:"Formal",shirtFit:"regular",trouser:"straight",torso,seat,areas:[]},
  });
  const book=aggregateFitOutcomes([
    ...Array.from({length:6},(_,i)=>event(`unknown-${i}`,"unknown","unknown","clean_first_fit")),
    event("known-1","straight","balanced","major_alteration"),
    event("known-2","straight","balanced","major_alteration"),
  ]);
  const known=fitOutcomeSignalFor({occasion:"Formal",style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"tapered",seat:"pronounced"}},book);
  assert.equal(known.evidence,2);
  assert.equal(known.score,0);
  const unknown=fitOutcomeSignalFor({occasion:"Formal",style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"unknown",seat:"unknown"}},book);
  assert.equal(unknown.evidence,6);
  assert.ok(unknown.score>0);
});

test("unknown seat data cannot boost a customer with a measured seat proportion",()=>{
  const book=aggregateFitOutcomes(Array.from({length:5},(_,i)=>({
    type:"operator_note",source:"operator",payload:{subtype:"designer_fit_outcome",
      recommendationId:`unknown-seat-${i}`,verdict:"clean_first_fit",occasion:"Formal",
      shirtFit:"regular",trouser:"straight",torso:"tapered",seat:"unknown",areas:[]},
  })));
  const signal=fitOutcomeSignalFor({occasion:"Formal",style:{shirtFit:"regular",trouser:"straight"},
    proportion:{torso:"straight",seat:"balanced"}},book);
  assert.equal(signal.score,0);
  assert.equal(signal.evidence,0);
});

test("seat-waist readings already requiring tailor review never become confident learning labels",()=>{
  const otherwiseValid={shirt:{chest:102,waist:84},pants:{waist:82,seat:158}};
  assert.deepEqual(fitOutcomeProportionFromMeasurements(otherwiseValid),
    {torso:"tapered",seat:"pronounced"});
  const contradictory={...otherwiseValid,pants:{waist:82,seat:158.01}};
  assert.deepEqual(fitOutcomeProportionFromMeasurements(contradictory),
    {torso:"tapered",seat:"unknown"});
  assert.deepEqual(fitOutcomeProportionFromMeasurements({
    shirt:{chest:103,waist:87},pants:{waist:160,seat:84.99},
  }),{torso:"balanced",seat:"unknown"});
});

test("learning cutoff and human measurement-consistency review share one threshold",async()=>{
  const {SEAT_WAIST_REVIEW_DELTA_CM,reviewMeasurementConsistency}=await import(
    "../src/lib/designer/measurement-consistency.ts");
  assert.equal(SEAT_WAIST_REVIEW_DELTA_CM,75);
  const profile={version:1 as const,unit:"cm" as const,
    shirt:{chest:105,waist:85},pants:{waist:80,seat:155.001},updatedAt:"2026-10-18"};
  assert(reviewMeasurementConsistency(profile).some((issue)=>issue.id==="MEASURE-SEAT-WAIST"));
  assert.equal(fitOutcomeProportionFromMeasurements(profile).seat,"unknown");
  const within={...profile,pants:{waist:80,seat:155}};
  assert(!reviewMeasurementConsistency(within).some((issue)=>issue.id==="MEASURE-SEAT-WAIST"));
  assert.equal(fitOutcomeProportionFromMeasurements(within).seat,"pronounced");
});
