import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseOperatorQuoteLines} from "../src/lib/designer/operator-quote-lines.ts";

test("empty quote input cannot become an accidental free item",()=>{
  assert.deepEqual(parseOperatorQuoteLines([
    {label:"Shirt fabric",amount:""},
    {label:"Tailoring",amount:""},
  ]),{lineItems:[],valid:false});
  assert.deepEqual(parseOperatorQuoteLines([
    {label:"Shirt fabric",amount:"0"},
    {label:"Tailoring",amount:"2500.50"},
  ]),{lineItems:[{label:"Shirt fabric",amount:0},{label:"Tailoring",amount:2500.5}],valid:true});
});

test("a missing or invalid labeled amount invalidates the full draft even with another valid line",()=>{
  for(const amount of [""," ","-5","abc","1e3","1.234","NaN","Infinity","10000000.01"]){
    const draft=parseOperatorQuoteLines([
      {label:"Fabric",amount},
      {label:"Tailoring",amount:"2000"},
    ]);
    assert.equal(draft.valid,false,amount);
    assert.equal(draft.lineItems.some(x=>x.label==="Tailoring"),true);
    assert.equal(draft.lineItems.some(x=>x.label==="Fabric"),false,amount);
  }
  assert.equal(parseOperatorQuoteLines([{label:"",amount:"100"}]).valid,false);
  assert.deepEqual(parseOperatorQuoteLines([
    {label:"",amount:""},
    {label:"Tailoring",amount:"2500"},
  ]),{lineItems:[{label:"Tailoring",amount:2500}],valid:true});
  assert.equal(parseOperatorQuoteLines([{label:"Fabric",amount:".50"}]).valid,true);
});

test("Production Desk uses explicit quote entry validity instead of Number(empty)",()=>{
  const src=readFileSync("src/app/operator/production/ProductionClient.tsx","utf8");
  assert.match(src,/parseOperatorQuoteLines\(/);
  assert.match(src,/&&quoteEntry\.valid/);
  assert.match(src,/lineItems:quoteItems/);
  assert.doesNotMatch(src,/Number\(quote\.line1Amount\)/);
  assert.doesNotMatch(src,/Number\(quote\.line2Amount\)/);
});
