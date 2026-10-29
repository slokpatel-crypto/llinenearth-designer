import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyVerifiedStockAvailability } from "../src/lib/designer/stock-availability.ts";

const source=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("metadata transport returns explicit availability status, not a success-shaped empty map on failure",()=>{
  const loader=source("../src/lib/designer-fabric-metadata.ts");
  assert.match(loader,/loadDesignerFabricMetadataWithStatus/);
  assert.match(loader,/sourceVerified:false/);
  assert.match(loader,/sourceVerified:true/);
  assert.match(loader,/verifyOperatorMetadataPage\(/);
  assert.match(loader,/verifyOperatorMetadataRowSequence\(rows,previousRow\)/);
  assert.match(loader,/previousRow=lastRow/);
  assert.match(loader,/response\.headers\.get\("content-range"\)/);
  assert.match(loader,/order:"at.desc,id.desc"/);
  assert.match(loader,/offset:String\(offset\)/);
  assert.match(loader,/receipt.status==="complete"/);
  assert.match(loader,/prefer:"count=exact"/);
  assert.match(loader,/AbortSignal\.timeout\(8_000\)/);
  assert.match(loader,/return unavailable\(\)/);
});

test("both public catalogue paths block positive stock when sold-out metadata cannot be checked",()=>{
  const catalogue=source("../src/lib/designer/catalog-stock-server.ts");
  const inventory=source("../src/app/api/inventory/route.ts");
  assert.match(catalogue,/loadDesignerFabricMetadataWithStatus\(\)/);
  assert.match(catalogue,/if\(!sourceVerified\) return \{stock:\[\],calibratedFabrics:0,verifiedStockFabrics:0\}/);
  assert.match(inventory,/loadDesignerFabricMetadataWithStatus\(\)/);
  assert.match(inventory,/sourceVerified\s*\?/);
  assert.match(inventory,/applyVerifiedStockAvailability\(structured,\[\]\)/);
});

test("unknown metadata source never promotes even a positive provenance-backed roll into the legacy API",()=>{
  const stock=[{
    id:"verified-roll-but-metadata-unreachable",inStock:true,
    family:"Linen",line:"Test",colorName:"Test",hex:"#888888",
    swatchImageUrl:"/test.webp",suitableFor:["shirt" as const],pattern:"Plain",
    sourceDocument:"test",sourcePage:1,
  }];
  const trustedPositive=[{fabric_id:stock[0].id,available_metres:"5.000",provenance_ready:true}];
  assert.equal(applyVerifiedStockAvailability(stock,trustedPositive).stock[0]?.inStock,true);
  const fallback=applyVerifiedStockAvailability(stock,[]);
  assert.equal(fallback.stock[0]?.inStock,false);
  assert.equal(fallback.stock[0]?.availabilityVerified,false);
  assert.deepEqual(fallback.verifiedFabricIds,[]);
});
