import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyVerifiedStockAvailability, verifiedStockAvailabilityMap } from "../src/lib/designer/stock-availability.ts";

const fabric=(id:string,inStock=true)=>({
  id,family:"Linen",line:"Test",colorName:id,hex:"#AAAAAA",swatchImageUrl:"/test.webp",
  suitableFor:["shirt" as const],pattern:"Plain",sourceDocument:"test",sourcePage:1,inStock,
});

test("only provenance-ready ledger rows may advertise positive catalogue availability",()=>{
  const result=applyVerifiedStockAvailability([fabric("a"),fabric("b"),fabric("c")],[
    {fabric_id:"a",available_metres:0,provenance_ready:true},
    {fabric_id:"b",available_metres:0,provenance_ready:false},
  ]);
  assert.equal(result.stock.find((item)=>item.id==="a")?.inStock,false);
  assert.equal(result.stock.find((item)=>item.id==="a")?.availabilityVerified,true);
  assert.equal(result.stock.find((item)=>item.id==="b")?.inStock,false);
  assert.equal(result.stock.find((item)=>item.id==="b")?.availabilityVerified,false);
  assert.equal(result.stock.find((item)=>item.id==="c")?.inStock,false);
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


test("conflicting or repeated supplier snapshot IDs must not be treated as verified stock",()=>{
  const map=verifiedStockAvailabilityMap([
    {fabric_id:"shirt",available_metres:4,provenance_ready:true},
    {fabric_id:"shirt",available_metres:0,provenance_ready:true},
    {fabric_id:"trouser",available_metres:1,provenance_ready:true},
  ]);
  assert.equal(map.has("shirt"),false);
  assert.equal(map.get("trouser"),true);
  const result=applyVerifiedStockAvailability([fabric("shirt"),fabric("trouser")],[
    {fabric_id:"shirt",available_metres:4,provenance_ready:true},
    {fabric_id:"shirt",available_metres:0,provenance_ready:true},
    {fabric_id:"trouser",available_metres:1,provenance_ready:true},
  ]);
  assert.deepEqual(result.verifiedFabricIds,["trouser"]);
  assert.equal(result.stock[0].availabilityVerified,false);
});
test("negative, empty and malformed physical quantities cannot certify a fabric as available",()=>{
  const map=verifiedStockAvailabilityMap([
    {fabric_id:"negative",available_metres:-0.3,provenance_ready:true},
    {fabric_id:"empty",available_metres:"",provenance_ready:true},
    {fabric_id:"bad",available_metres:"not-a-number",provenance_ready:true},
    {fabric_id:"zero",available_metres:0,provenance_ready:true},
  ]);
  assert.equal(map.size,1);
  assert.equal(map.get("zero"),false);
  assert.equal(map.has("negative"),false);
  assert.equal(map.has("empty"),false);
});

test("an invalid numeric notation or missing RPC metreage cannot certify supplier stock",()=>{
  const rows=[
    ...["0x10","0b101","1e3","2_000","  ","Infinity","-0.5","1.2345","0.0001"].map((available_metres,i)=>({
      fabric_id:`malformed-${i}`,available_metres,provenance_ready:true,
    })),
    // Runtime RPC values can be null even when an incorrect type assertion says numeric.
    {fabric_id:"missing",available_metres:null as unknown as number,provenance_ready:true},
    {fabric_id:"zero",available_metres:"0.000",provenance_ready:true},
    {fabric_id:"valid",available_metres:"4.250",provenance_ready:true},
  ];
  const map=verifiedStockAvailabilityMap(rows);
  assert.deepEqual([...map.entries()],[["zero",false],["valid",true]]);
});

test("missing or unreachable stock ledger cannot sell bundled catalogue swatches",()=>{
  const result=applyVerifiedStockAvailability([fabric("shirt"),fabric("trouser")],[]);
  assert.deepEqual(result.verifiedFabricIds,[]);
  assert.deepEqual(result.stock.map((item)=>({
    id:item.id,inStock:item.inStock,availabilityVerified:item.availabilityVerified,
  })),[
    {id:"shirt",inStock:false,availabilityVerified:false},
    {id:"trouser",inStock:false,availabilityVerified:false},
  ]);
});

test("a verified positive snapshot cannot resurrect an explicitly unavailable fabric",()=>{
  const result=applyVerifiedStockAvailability([fabric("sold-out",false)],[
    {fabric_id:"sold-out",available_metres:"4.250",provenance_ready:true},
  ]);
  assert.equal(result.stock[0].inStock,false);
  assert.equal(result.stock[0].availabilityVerified,true);
});


test("only literal, unpadded exact fabric IDs can certify physical stock",()=>{
  const rows=[
    {fabric_id:" shirt ",available_metres:"5.000",provenance_ready:true},
    {fabric_id:["trouser"] as unknown as string,available_metres:"5.000",provenance_ready:true},
    {fabric_id:123 as unknown as string,available_metres:"5.000",provenance_ready:true},
    {fabric_id:"valid",available_metres:"2.500",provenance_ready:true},
  ];
  assert.deepEqual([...verifiedStockAvailabilityMap(rows).entries()],[["valid",true]]);
  const result=applyVerifiedStockAvailability([
    fabric("shirt"),fabric("trouser"),fabric("123"),fabric("valid"),
  ],rows);
  assert.deepEqual(result.stock.map((item)=>item.inStock),[false,false,false,true]);
  assert.deepEqual(result.verifiedFabricIds,["valid"]);
});

test("padded duplicate evidence invalidates even an otherwise exact stock row",()=>{
  const rows=[
    {fabric_id:"shirt",available_metres:5,provenance_ready:true},
    {fabric_id:" shirt ",available_metres:5,provenance_ready:true},
  ];
  assert.equal(verifiedStockAvailabilityMap(rows).has("shirt"),false);
});

test("live RPC adapter never coerces non-string fabric IDs to catalogue IDs",()=>{
  const source=readFileSync(new URL("../src/lib/designer/stock-availability-server.ts",import.meta.url),"utf8");
  assert.match(source,/fabric_id:typeof row\.fabric_id==="string"\?row\.fabric_id:""/);
  assert.doesNotMatch(source,/fabric_id:String\(row\.fabric_id/);
});

test("unrequested ledger identities cannot inflate verified catalogue stock metrics",()=>{
  const result=applyVerifiedStockAvailability([fabric("shirt")],[
    {fabric_id:"shirt",available_metres:"3.500",provenance_ready:true},
    {fabric_id:"unexpected-rpc-fabric",available_metres:"9.000",provenance_ready:true},
  ]);
  assert.deepEqual(result.verifiedFabricIds,["shirt"]);
  assert.equal(result.stock.length,1);
  assert.equal(result.stock[0].inStock,true);
  assert.equal(result.stock[0].availabilityVerified,true);
});

test("duplicate catalogue identities cannot inherit one verified physical roll",()=>{
  const result=applyVerifiedStockAvailability([
    {...fabric("same-id"),swatchImageUrl:"/fabric-a.webp"},
    {...fabric("same-id"),swatchImageUrl:"/fabric-b.webp"},
    fabric("unique"),
  ],[
    {fabric_id:"same-id",available_metres:"5.000",provenance_ready:true},
    {fabric_id:"unique",available_metres:"3.000",provenance_ready:true},
  ]);
  assert.deepEqual(result.verifiedFabricIds,["unique"]);
  assert.deepEqual(result.stock.map((item)=>({
    inStock:item.inStock,availabilityVerified:item.availabilityVerified,
  })),[
    {inStock:false,availabilityVerified:false},
    {inStock:false,availabilityVerified:false},
    {inStock:true,availabilityVerified:true},
  ]);
  assert.equal(result.stock[0].swatchImageUrl,"/fabric-a.webp");
  assert.equal(result.stock[1].swatchImageUrl,"/fabric-b.webp");
});
