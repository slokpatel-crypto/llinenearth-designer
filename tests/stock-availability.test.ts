import test from "node:test";
import assert from "node:assert/strict";
import { applyVerifiedStockAvailability, verifiedStockAvailabilityMap } from "../src/lib/designer/stock-availability.ts";

const fabric=(id:string,inStock=true)=>({
  id,family:"Linen",line:"Test",colorName:id,hex:"#AAAAAA",swatchImageUrl:"/test.webp",
  suitableFor:["shirt" as const],pattern:"Plain",sourceDocument:"test",sourcePage:1,inStock,
});

test("only provenance-ready ledger rows can override catalogue availability",()=>{
  const result=applyVerifiedStockAvailability([fabric("a"),fabric("b"),fabric("c")],[
    {fabric_id:"a",available_metres:0,provenance_ready:true},
    {fabric_id:"b",available_metres:0,provenance_ready:false},
  ]);
  assert.equal(result.stock.find((item)=>item.id==="a")?.inStock,false);
  assert.equal(result.stock.find((item)=>item.id==="a")?.availabilityVerified,true);
  assert.equal(result.stock.find((item)=>item.id==="b")?.inStock,true);
  assert.equal(result.stock.find((item)=>item.id==="b")?.availabilityVerified,undefined);
  assert.equal(result.stock.find((item)=>item.id==="c")?.inStock,true);
  assert.deepEqual(result.verifiedFabricIds,["a"]);
});

test("verified physical stock never overrides an explicit catalogue unavailability",()=>{
  const result=applyVerifiedStockAvailability([fabric("a",false)],[
    {fabric_id:"a",available_metres:"4.250",provenance_ready:true},
  ]);
  assert.equal(result.stock[0]?.inStock,false);
  assert.equal(result.stock[0]?.availabilityVerified,true);
});

test("invalid ledger quantities never become verified availability",()=>{
  const map=verifiedStockAvailabilityMap([
    {fabric_id:"a",available_metres:"not-a-number",provenance_ready:true},
    {fabric_id:"b",available_metres:2,provenance_ready:false},
  ]);
  assert.equal(map.size,0);
});
