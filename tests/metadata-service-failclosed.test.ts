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


test("malformed newest operator availability cannot mask an older sold-out veto",()=>{
  const loader=source("../src/lib/designer-fabric-metadata.ts");
  assert.match(loader,/validateOperatorMetadataAvailability\(row\.payload,CATALOGUE_FABRIC_IDS\)/);
  assert.match(loader,/if\(status==="invalid"\)\{[\s\S]*?return unavailable\(\)/);
  assert.match(loader,/if\(status==="unrelated"\) continue/);
  assert.match(loader,/payload\.subtype !== "designer_fabric_metadata"/);
  assert.match(loader,/availability !== "unknown" && availability !== "available" && availability !== "unavailable"/);
  assert.doesNotMatch(loader,/safe\(payload\.availability/);
  assert.doesNotMatch(loader,/safe\(payload\.fabricId/);
});


test("verified physical fabric metadata cannot be coerced from JSON arrays or numeric strings",()=>{
  const loader=source("../src/lib/designer-fabric-metadata.ts");
  assert.match(loader,/literalOperatorPhysicalNumber\(payload\.weightGsm,40,1000\)/);
  assert.match(loader,/literalOperatorPhysicalEnum\(payload\.drape,/);
  assert.match(loader,/literalOperatorPhysicalEnum\(payload\.weightClass,/);
  assert.match(loader,/typeof payload\.weave==="string"/);
  assert.match(loader,/typeof payload\.texture==="string"/);
  assert.doesNotMatch(loader,/Number\(payload\.weightGsm\)/);
  assert.doesNotMatch(loader,/Number\(payload\.formalityScore\)/);
});


test("metadata parser never manufactures seasonal suitability or clipped textile details",()=>{
  const loader=source("../src/lib/designer-fabric-metadata.ts");
  assert.match(loader,/literalOperatorTags\(payload\.seasonTags,/);
  assert.match(loader,/literalOperatorTags\(payload\.roleTags,/);
  assert.match(loader,/literalOperatorText\(payload\.weave,100\)/);
  assert.match(loader,/literalOperatorText\(payload\.texture,100\)/);
  assert.match(loader,/literalOperatorText\(payload\.note,500\)/);
  assert.doesNotMatch(loader,/String\(value/);
  assert.doesNotMatch(loader,/\.slice\(0,max\)/);
});
