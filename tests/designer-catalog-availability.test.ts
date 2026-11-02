import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyVerifiedStockAvailability } from "../src/lib/designer/stock-availability.ts";
import { verifiedDesignerCatalogueStock } from "../src/lib/designer/public-inventory-availability.ts";
import { parseLiteralOperatorAvailability } from "../src/lib/designer/operator-availability-literal.ts";
import type { FabricColorway } from "../src/lib/fabric-stock.ts";
import type { DesignerFabricMetadataMap } from "../src/lib/designer-fabric-metadata-types.ts";
import type { VerifiedStockSnapshotRow } from "../src/lib/designer/stock-availability.ts";

const fabric = (id:string):FabricColorway => ({
  id,family:"Linen",line:"Plain",colorName:id,hex:"#eeeeee",swatchImageUrl:"/fabric.webp",
  suitableFor:["shirt"],pattern:"Plain",sourceDocument:"synthetic",sourcePage:1,inStock:true,
});
const operator = (id:string,availability:"available"|"unavailable"|"unknown"="available") => ({
  fabricId:id,availability,
});
const ledger = (id:string,metres:number|string,provenance_ready=true):VerifiedStockSnapshotRow => ({
  fabric_id:id,available_metres:metres,provenance_ready,
});
function catalogue(stock:FabricColorway[],rows:VerifiedStockSnapshotRow[],metadata:DesignerFabricMetadataMap) {
  const live=applyVerifiedStockAvailability(stock,rows);
  return verifiedDesignerCatalogueStock(live.stock,live.verifiedFabricIds,metadata);
}

test("Designer catalogue requires independently verified positive ledger and operator consent",()=>{
  const source=["positive","zero","missing","unprovenanced","vetoed"].map(fabric);
  const selected=catalogue(source,[
    ledger("positive","3.250"),ledger("zero",0),ledger("unprovenanced",2,false),ledger("vetoed",4),
  ],{
    positive:operator("positive"),zero:operator("zero"),missing:operator("missing"),
    unprovenanced:operator("unprovenanced"),vetoed:operator("vetoed","unavailable"),
  });
  assert.deepEqual(selected.map((item)=>item.id),["positive"]);
  assert.equal(selected[0].availabilityVerified,true);
  assert.equal(source.every((item)=>item.inStock===true),true,"original catalogue remains untouched");
});

test("missing metadata, unavailable and unknown operator statuses fail closed even with ledger",()=>{
  const source=["missing","unavailable","unknown","available"].map(fabric);
  const selected=catalogue(source,source.map((item)=>ledger(item.id,5)),{
    unavailable:operator("unavailable","unavailable"),
    unknown:operator("unknown","unknown"),available:operator("available"),
  });
  assert.deepEqual(selected.map((item)=>item.id),["available"]);
});

test("no ledger, duplicate ledger IDs or invalid physical quantities can certify stock",()=>{
  const source=["none","duplicate","invalid","fractional"].map(fabric);
  const selected=catalogue(source,[
    ledger("duplicate",3),ledger("duplicate",3),
    ledger("invalid","0x10"),ledger("fractional","2.0009"),
  ],Object.fromEntries(source.map((item)=>[item.id,operator(item.id)])));
  assert.deepEqual(selected,[]);
});

test("JSON-coerced operator approval and mismatched metadata keys cannot certify stock",()=>{
  const raw=parseLiteralOperatorAvailability({
    subtype:"designer_fabric_metadata",fabricId:"fabric-a",availability:["available"],
  },["fabric-a"]);
  assert.equal(raw?.availability,"unknown");
  const result=catalogue([fabric("fabric-a"),fabric("fabric-b")],[
    ledger("fabric-a",6),ledger("fabric-b",6),
  ],{
    "fabric-a":operator("fabric-a",raw?.availability ?? "unknown"),
    "fabric-b":operator("fabric-a"),
  });
  assert.deepEqual(result,[]);
});

test("Designer endpoint uses verified AND operator-approved stock with no public cache",async()=>{
  const server=await readFile(new URL("../src/lib/designer/catalog-stock-server.ts",import.meta.url),"utf8");
  const route=await readFile(new URL("../src/app/api/designer/catalog/route.ts",import.meta.url),"utf8");
  assert.match(server,/verifiedDesignerCatalogueStock\(liveStock\.stock,liveStock\.verifiedFabricIds,metadata\)/);
  assert.doesNotMatch(server,/stock:liveStock\.stock\.filter\(\(fabric\)=>fabric\.inStock\)/);
  assert.match(route,/loadActiveDesignerFabricStock\(\)/);
  assert.match(route,/export const dynamic = "force-dynamic"/);
  assert.match(route,/"cache-control": "no-store"/);
});

test("static Designer fallback cannot inherit live physical stock evidence",async()=>{
  const engine=await readFile(new URL("../src/lib/designer/engine.ts",import.meta.url),"utf8");
  const ui=await readFile(new URL("../src/components/DesignerModule.tsx",import.meta.url),"utf8");
  const discovery=await readFile(new URL("../src/lib/designer/fabric-discovery.ts",import.meta.url),"utf8");
  assert.match(engine,/availabilityVerified:fabric\.availabilityVerified===true/);
  assert.match(ui,/data\.shirts\.length \? data\.shirts : DESIGNER_SHIRTS/);
  assert.match(ui,/data\.pants\.length \? data\.pants : DESIGNER_PANTS/);
  assert.match(discovery,/availabilityVerified===true\?"Stock checked":"Confirm stock"/);
});
