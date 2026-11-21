import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const {load}=createRequire(import.meta.url)("../scripts/designer-test-loader.cjs");
const {DESIGNER_SHIRTS,DESIGNER_PANTS}=load("src/lib/designer/engine.ts") as typeof import("../src/lib/designer/engine.ts");
const {catalogHandoffPath,readCatalogFabricHandoff}=load("src/lib/designer/catalog-handoff.ts") as typeof import("../src/lib/designer/catalog-handoff.ts");
const {allowLocalFitHydration}=load("src/lib/designer/customer-vault-journey.ts") as typeof import("../src/lib/designer/customer-vault-journey.ts");
const shirt=DESIGNER_SHIRTS[1],pant=DESIGNER_PANTS[1];

test("catalogue link carries exact pair IDs and no credentials or previous revision",()=>{
  const href=catalogHandoffPath(shirt,pant);
  assert.ok(href);
  const params=new URL(href,"https://linen-earth.example").searchParams;
  assert.equal(params.get("from"),"fabric-catalog");
  assert.equal(params.get("shirt"),shirt.id);
  assert.equal(params.get("pant"),pant.id);
  assert.deepEqual([...params.keys()],["from","shirt","pant"]);
  assert.deepEqual(readCatalogFabricHandoff(params,DESIGNER_SHIRTS,DESIGNER_PANTS),{shirtId:shirt.id,pantId:pant.id});
});

test("catalogue handoff rejects forged categories, unknown fabrics and duplicate keys",()=>{
  assert.equal(catalogHandoffPath(pant,shirt),null);
  assert.equal(catalogHandoffPath(null,pant),null);
  assert.equal(catalogHandoffPath({...shirt,id:"bad&redirect=true"},pant),null);
  const base=new URLSearchParams({from:"fabric-catalog",shirt:shirt.id,pant:pant.id});
  for(const edit of [
    (p:URLSearchParams)=>p.append("shirt",pant.id),
    (p:URLSearchParams)=>p.set("shirt",pant.id),
    (p:URLSearchParams)=>p.set("shirt","no-longer-stocked"),
    (p:URLSearchParams)=>p.set("pant",shirt.id),
    (p:URLSearchParams)=>p.append("recoveryToken","private-key"),
    (p:URLSearchParams)=>p.set("from","shared-design"),
    (p:URLSearchParams)=>p.set("pant","x".repeat(500)),
  ]){
    const params=new URLSearchParams(base);edit(params);
    assert.equal(readCatalogFabricHandoff(params,DESIGNER_SHIRTS,DESIGNER_PANTS),null);
  }
});

test("fabric pair is selected only from the current loaded catalogue",()=>{
  const params=new URLSearchParams({from:"fabric-catalog",shirt:shirt.id,pant:pant.id});
  assert.equal(readCatalogFabricHandoff(params,[],DESIGNER_PANTS),null);
  const currentOnly={...shirt,id:"synthetic-live-shirt-001"};
  assert.equal(readCatalogFabricHandoff(new URLSearchParams({from:"fabric-catalog",shirt:currentOnly.id,pant:pant.id}),DESIGNER_SHIRTS,DESIGNER_PANTS),null);
  assert.deepEqual(readCatalogFabricHandoff(new URLSearchParams({from:"fabric-catalog",shirt:currentOnly.id,pant:pant.id}),[...DESIGNER_SHIRTS,currentOnly],DESIGNER_PANTS),{shirtId:currentOnly.id,pantId:pant.id});
});

test("catalogue entry never hydrates local personal fit or shares saved lock lineage",()=>{
  assert.equal(allowLocalFitHydration(new URLSearchParams({from:"fabric-catalog",shirt:shirt.id,pant:pant.id})),false);
  const source=readFileSync("src/components/DesignerModule.tsx","utf8");
  assert.match(source,/if\(fromCatalog\)nextBodyProfile=undefined;/);
  assert.match(source,/!fromCatalog && parsed\?\.creative/);
  assert.match(source,/const pair=readCatalogFabricHandoff\(params,shirtOptions,pantOptions\)/);
  assert.match(source,/setLastLockedRevisionId\(null\)/);
  assert.match(source,/setMeasurementProfile\(null\)/);
  assert.match(source,/setTailorObservations\(null\)/);
});

test("catalogue route is a real fabric discovery page, not a legacy redirect",()=>{
  const source=readFileSync("src/app/catalog/page.tsx","utf8");
  assert.match(source,/fetch\("\/api\/designer\/catalog"/);
  assert.match(source,/catalogHandoffPath\(selectedShirt,selectedPant\)/);
  assert.match(source,/discoverFabrics\(shirts,"shirt"/);
  assert.match(source,/discoverFabrics\(pants,"trouser"/);
  assert.doesNotMatch(source,/redirect\("\/designer-studio"\)/);
});
