import test from "node:test";
import assert from "node:assert/strict";
import {normalizeCustomerProductionOutcome} from "../src/lib/designer/customer-production-outcomes.ts";

test("delivered customer outcome accepts evidence after confirmed wear",()=>{
  assert.deepEqual(
    normalizeCustomerProductionOutcome({
      overallRating:"love",
      fitResult:"clean_first_fit",
      wornConfirmed:true,
      note:"Great first fit.",
    }),
    {
      overallRating:"love",
      fitResult:"clean_first_fit",
      wornConfirmed:true,
      note:"Great first fit.",
    },
  );
});

test("fit evidence cannot be claimed before the garment is worn",()=>{
  assert.throws(
    ()=>normalizeCustomerProductionOutcome({
      overallRating:"good",
      fitResult:"minor_alteration",
      wornConfirmed:false,
    }),
    /Confirm the garment was worn/,
  );
});

test("problem outcomes require a usable note",()=>{
  assert.throws(
    ()=>normalizeCustomerProductionOutcome({
      overallRating:"needs_work",
      fitResult:"not_checked",
      wornConfirmed:false,
      note:"",
    }),
    /short note/,
  );
});
