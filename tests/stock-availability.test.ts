import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyVerifiedStockAvailability, verifiedStockAvailabilityMap, stockSnapshotHasConfirmedProvenance } from "../src/lib/designer/stock-availability.ts";

const fabric=(id:string,inStock=true)=>({
  id,family:"Linen",line:"Test",colorName:id,hex:"#AAAAAA",swatchImageUrl:"/test.webp",
  suitableFor:["shirt" as const],pattern:"Plain",sourceDocument:"test",sourcePage:1,inStock,
});

test("live stock v2 receipt needs positive exact corroborated manual event counts",()=>{
  const valid={provenance_ready:true,manual_event_count:2,provenance_event_count:2,legacy_unverified_event_count:0};
  assert.equal(stockSnapshotHasConfirmedProvenance(valid),true);
  for(const invalid of [
    {...valid,manual_event_count:0},
    {...valid,manual_event_count:"2"},
    {...valid,manual_event_count:1.5},
    {...valid,provenance_event_count:1},
    {...valid,provenance_event_count:"2"},
    {...valid,legacy_unverified_event_count:1},
    {...valid,legacy_unverified_event_count:"0"},
    {...valid,provenance_ready:"true"},
    {provenance_ready:true},
  ]){
    assert.equal(stockSnapshotHasConfirmedProvenance(invalid),false);
  }
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

test("sub-resolution positive dust never becomes verified sellable stock",()=>{
  // The ledger moves in exact 0.001m units. The numeric rounding tolerance
  // must not classify a tiny nonzero as one available unit.
  const map=verifiedStockAvailabilityMap([
    {fabric_id:"tiny-number",available_metres:1e-12,provenance_ready:true},
    {fabric_id:"tiny-decimal",available_metres:"0.000000000001",provenance_ready:true},
    {fabric_id:"min-number",available_metres:Number.MIN_VALUE,provenance_ready:true},
    {fabric_id:"zero",available_metres:"0.000",provenance_ready:true},
    {fabric_id:"one-unit",available_metres:"0.001",provenance_ready:true},
  ]);
  assert.deepEqual([...map.entries()],[["zero",false],["one-unit",true]]);
  const stock=applyVerifiedStockAvailability([fabric("tiny-number"),fabric("one-unit")],[
    {fabric_id:"tiny-number",available_metres:1e-12,provenance_ready:true},
    {fabric_id:"one-unit",available_metres:0.001,provenance_ready:true},
  ]);
  assert.equal(stock.stock[0].inStock,false);
  assert.equal(stock.stock[0].availabilityVerified,false);
  assert.equal(stock.stock[1].inStock,true);
  assert.equal(stock.stock[1].availabilityVerified,true);
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
  assert.match(source,/fabric_id:typeof record\.fabric_id==="string"\?record\.fabric_id:""/);
  assert.doesNotMatch(source,/fabric_id:String\(record\.fabric_id/);
  assert.match(source,/readBoundedJsonResponse\(response,1024 \* 1024\)/);
  assert.match(source,/Array\.isArray\(row\)/);
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

test("customer stock catalogue response is never publicly cached",()=>{
  const route=readFileSync(new URL("../src/app/api/designer/catalog/route.ts",import.meta.url),"utf8");
  assert.match(route,/loadActiveDesignerCatalogueFabrics\(\)/);
  assert.match(route,/cache-control":"private, no-store"/);
});

test("release readiness guards unique catalogue identity stock semantics",()=>{
  const release=readFileSync(new URL("../scripts/release-readiness.mjs",import.meta.url),"utf8");
  assert.match(release,/uniqueCatalogueIds\.has\(fabric\.id\)&&verified\.has\(fabric\.id\)/);
  assert.match(release,/uniqueCatalogueIds\.has\(fabric\.id\)&&fabric\.inStock&&verified\.get\(fabric\.id\)===true/);
  assert.match(release,/verifiedFabricIds:\[\.\.\.verified\.keys\(\)\]\.filter\(\(id\)=>uniqueCatalogueIds\.has\(id\)\)/);
  assert.doesNotMatch(release,/["']availabilityVerified:verified\.has\(fabric\.id\)["']/);
});
