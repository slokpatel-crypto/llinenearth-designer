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

test("quote total reconciles with persisted rounded line items and adjustment",()=>{
  for(const adjustment of [0.145,0.285,-0.545,1.005,-1.005]){
    const quote=normalizeProductionQuoteDraft({
      lineItems:[{label:"Fabric",amount:10.01},{label:"Tailoring",amount:0.145}],
      adjustment,
    });
    const linePaise=quote.lineItems.reduce((sum,item)=>sum+Math.round(item.amount*100),0);
    assert.equal(Math.round(quote.subtotal*100),linePaise);
    assert.equal(Math.round(quote.total*100),linePaise+Math.round(quote.adjustment*100));
    assert.deepEqual(normalizeProductionQuoteDraft(quote),quote,"saved quote can be normalized without changing its total");
  }
});

test("quote helper never allows an adjustment to make the total negative",()=>{
  assert.throws(()=>normalizeProductionQuoteDraft({
    lineItems:[{label:"Fabric",amount:500}],
    adjustment:-501,
  }),/cannot be negative/);
});

test("operator quote amounts never coerce null, booleans, arrays or nondecimal strings into money",()=>{
  for(const invalid of [null,false,true,[],{},undefined,""," ","0x20","0b100","1e3","-3",Infinity,NaN]){
    assert.throws(()=>normalizeProductionQuoteDraft({
      lineItems:[{label:"Fabric",amount:invalid}],
    }),/Invalid quote line item amount/,String(invalid));
  }
  for(const invalid of [null,false,true,[],{},""," ","0x10","1e3","--3",Infinity,NaN]){
    assert.throws(()=>normalizeProductionQuoteDraft({
      lineItems:[{label:"Fabric",amount:300}],adjustment:invalid,
    }),/Invalid quote adjustment/,String(invalid));
  }
});

test("decimal text from a quote form remains supported without JS numeric coercion",()=>{
  const result=normalizeProductionQuoteDraft({
    currency:"INR",
    lineItems:[{label:"Fabric",amount:"1499.995"},{label:"Tailoring",amount:".25"}],
    adjustment:-25,
  });
  assert.equal(result.subtotal,1500.25);
  assert.equal(result.adjustment,-25);
  assert.equal(result.total,1475.25);
});

test("operator form cannot silently quote unentered fabric and tailoring prices as zero",async()=>{
  const {readFileSync}=await import("node:fs");
  const source=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(source,/amountText:quote\.line1Amount\.trim\(\)/);
  assert.match(source,/amountText:quote\.line2Amount\.trim\(\)/);
  assert.match(source,/quoteRows\.every\(/);
  assert.match(source,/Boolean\(row\.label\)&&decimalPrice\(row\.amountText\)/);
  assert.match(source,/&&quoteRowsValid&&adjustmentValid/);
  assert.ok(!source.includes("amount:Number(quote.line1Amount)"));
  assert.ok(!source.includes("amount:Number(quote.line2Amount)"));
});

test("quote currency is a literal operator choice, never a coerced JSON value",()=>{
  const valid=normalizeProductionQuoteDraft({
    currency:" inr ",lineItems:[{label:"Fabric",amount:100}],
  });
  assert.equal(valid.currency,"INR");
  assert.equal(normalizeProductionQuoteDraft({lineItems:[{label:"Fabric",amount:100}]}).currency,"INR");
  for(const invalid of [null,false,true,0,["INR"],{value:"INR"},"","  ","INR1"]){
    assert.throws(()=>normalizeProductionQuoteDraft({
      currency:invalid,lineItems:[{label:"Fabric",amount:100}],
    }),/Invalid quote currency/,JSON.stringify(invalid));
  }
});

test("quote labels reject coerced, control-bearing or silently truncated operator instructions",()=>{
  const base={currency:"INR",adjustment:0};
  const good=normalizeProductionQuoteDraft({...base,lineItems:[{label:"  Hand-loom tailoring  ",amount:100}]});
  assert.equal(good.lineItems[0].label,"Hand-loom tailoring");
  for(const invalid of [
    null,false,true,0,["Fabric"],{label:"Fabric"},[],{},undefined,
    "","   ","X".repeat(161),"Fabric\nDiscount","Tailor\tInstruction","Fabric\u0000",
  ]){
    assert.throws(()=>normalizeProductionQuoteDraft({
      ...base,lineItems:[{label:invalid,amount:100}],
    }),/line item label/,JSON.stringify(invalid));
  }
  assert.equal(normalizeProductionQuoteDraft({
    lineItems:[{label:"X".repeat(160),amount:100}],
  }).lineItems[0].label.length,160);
});
