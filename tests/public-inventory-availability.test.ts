import test from "node:test";
import assert from "node:assert/strict";
import {requireVerifiedPublicAvailability} from "../src/lib/designer/public-inventory-availability.ts";

const fabric=(id:string,inStock=true)=>({
  id,inStock,family:"Linen",line:"Plain",colorName:id,hex:"#fff",swatchImageUrl:"/a.webp",
  suitableFor:["shirt" as const],pattern:"Plain",sourceDocument:"catalogue",sourcePage:1,
});

test("public inventory fails closed without any verified physical stock",()=>{
  const input=[fabric("catalogue"),fabric("legacy",false)];
  const result=requireVerifiedPublicAvailability(input,[],[]);
  assert.deepEqual(result.map(x=>[x.inStock,x.availabilityVerified]),[[false,false],[false,false]]);
  assert.equal(input[0].inStock,true,"must not mutate catalogue reference");
});

test("only independently verified positive stock is advertised",()=>{
  const result=requireVerifiedPublicAvailability([
    fabric("positive"),fabric("soldout",false),fabric("missing"),fabric("unverified"),
  ],["positive","soldout"],["positive","soldout"]);
  assert.deepEqual(result.map(x=>[x.inStock,x.availabilityVerified]),[
    [true,true],[false,true],[false,false],[false,false],
  ]);
});

test("operator veto or missing operator confirmation overrides positive physical ledger",()=>{
  const result=requireVerifiedPublicAvailability([
    fabric("veto",false),fabric("unknown"),fabric("allowed"),
  ],["veto","unknown","allowed"],["veto","allowed"]);
  assert.deepEqual(result.map(x=>x.inStock),[false,false,true]);
});

test("legacy gallery cannot claim availability even with an unrelated verified ID",()=>{
  const result=requireVerifiedPublicAvailability([fabric("legacy",false)], ["other"],["other"]);
  assert.equal(result[0].inStock,false);
  assert.equal(result[0].availabilityVerified,false);
});

test("public inventory endpoint uses verified ledger for structured fabrics and never certifies legacy scans",async()=>{
  const {readFile}=await import("node:fs/promises");
  const route=await readFile(new URL("../src/app/api/inventory/route.ts",import.meta.url),"utf8");
  assert.match(route,/applyLiveVerifiedStockAvailability\(FABRIC_STOCK\)/);
  assert.match(route,/requireVerifiedPublicAvailability\(verified\.stock, verified\.verifiedFabricIds\)/);
  assert.match(route,/requireVerifiedPublicAvailability\(legacy, \[\]\)/);
  assert.match(route,/inStock: structured\.filter\(\(fabric\) => fabric\.inStock\)\.length/);
  assert.match(route,/cache-control": "no-store"/);
});
