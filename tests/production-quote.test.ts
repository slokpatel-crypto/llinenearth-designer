import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProductionQuoteDraft } from "../src/lib/designer/production-quote.ts";

test("quote totals are deterministic and rounded to paise",()=>{
  const quote=normalizeProductionQuoteDraft({
    currency:"inr",
    lineItems:[
      {label:"Fabric",amount:1499.995},
      {label:"Tailoring",amount:2500},
    ],
    adjustment:-100,
  });
  assert.equal(quote.currency,"INR");
  assert.equal(quote.subtotal,4000);
  assert.equal(quote.adjustment,-100);
  assert.equal(quote.total,3900);
});

test("quote helper refuses missing or negative operator-entered values",()=>{
  assert.throws(()=>normalizeProductionQuoteDraft({lineItems:[]}),/1 to 30/);
  assert.throws(()=>normalizeProductionQuoteDraft({lineItems:[{label:"Fabric",amount:-1}]}),/Invalid quote line/);
  assert.throws(()=>normalizeProductionQuoteDraft({lineItems:[{label:"",amount:1}]}),/label is required/);
});

test("quote helper never allows an adjustment to make the total negative",()=>{
  assert.throws(()=>normalizeProductionQuoteDraft({
    lineItems:[{label:"Fabric",amount:500}],
    adjustment:-501,
  }),/cannot be negative/);
});
