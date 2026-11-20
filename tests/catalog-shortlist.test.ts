import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";

const {load}=createRequire(import.meta.url)("../scripts/designer-test-loader.cjs");
const {DESIGNER_SHIRTS,DESIGNER_PANTS}=load("src/lib/designer/engine.ts") as typeof import("../src/lib/designer/engine.ts");
const {
  CATALOG_SHORTLIST_LIMIT,toggleCatalogShortlist,reconcileCatalogShortlist,catalogFabricCompareRows,
}=load("src/lib/designer/catalog-shortlist.ts") as typeof import("../src/lib/designer/catalog-shortlist.ts");

test("customer shirt shortlist accepts three distinct current category IDs, no more",()=>{
  let chosen:string[]=[];
  for(const fabric of DESIGNER_SHIRTS.slice(0,3))
    chosen=toggleCatalogShortlist(chosen,fabric.id,DESIGNER_SHIRTS,"shirt");
  assert.equal(CATALOG_SHORTLIST_LIMIT,3);
  assert.deepEqual(chosen,DESIGNER_SHIRTS.slice(0,3).map(f=>f.id));
  const blocked=toggleCatalogShortlist(chosen,DESIGNER_SHIRTS[3].id,DESIGNER_SHIRTS,"shirt");
  assert.deepEqual(blocked,chosen);
  assert.deepEqual(toggleCatalogShortlist(chosen,chosen[1],DESIGNER_SHIRTS,"shirt"),[chosen[0],chosen[2]]);
  assert.deepEqual(toggleCatalogShortlist([],DESIGNER_PANTS[0].id,DESIGNER_SHIRTS,"shirt"),[]);
  assert.deepEqual(toggleCatalogShortlist([],"not-in-stock",DESIGNER_SHIRTS,"shirt"),[]);
});

test("trouser shortlist stays independent, duplicate-free and garment-scoped",()=>{
  const a=DESIGNER_PANTS[0].id,b=DESIGNER_PANTS[1].id;
  assert.deepEqual(reconcileCatalogShortlist([a,a,b,"stale",DESIGNER_SHIRTS[0].id],DESIGNER_PANTS,"pant"),[a,b]);
  assert.deepEqual(toggleCatalogShortlist([a],b,DESIGNER_PANTS,"pant"),[a,b]);
  assert.deepEqual(toggleCatalogShortlist([a],DESIGNER_SHIRTS[0].id,DESIGNER_PANTS,"pant"),[a]);
});

test("catalogue refresh prunes removed fabric IDs and does not invent replacement choices",()=>{
  const first=DESIGNER_SHIRTS[0],second=DESIGNER_SHIRTS[1],third=DESIGNER_SHIRTS[2];
  const newStock=[first,third];
  const result=reconcileCatalogShortlist([first.id,second.id,third.id],newStock,"shirt");
  assert.deepEqual(result,[first.id,third.id]);
  assert.equal(result.includes(second.id),false);
});

test("catalogue comparison preserves missing physical evidence and verification provenance",()=>{
  const original=DESIGNER_SHIRTS[0];
  const unknown={...original,fiberContent:null,fiberContentVerified:false,weightGsm:null,
    availabilityVerified:false,colorVerified:false,patternScaleVerified:false};
  const rows=catalogFabricCompareRows(unknown);
  const byLabel=Object.fromEntries(rows.map(x=>[x.label,x.value]));
  assert.equal(byLabel["Material"],"Composition not verified");
  assert.equal(byLabel["Fabric weight"],"Weight not measured");
  assert.equal(byLabel["Availability"],"Confirm stock");
  assert.equal(byLabel["Pattern scale"],"Scale not measured");
  assert.equal(byLabel["Colour accuracy"],"Colour is a screen estimate");
  assert.equal(byLabel["Colour family"],unknown.colorFamily||"Not classified");
  const unreviewed={...unknown,fiberContent:"linen and cotton"};
  assert.match(catalogFabricCompareRows(unreviewed).find(x=>x.label==="Material")!.value,/unverified catalogue description/);
  const reviewed={...unknown,fiberContent:"100% linen",fiberContentVerified:true};
  assert.match(catalogFabricCompareRows(reviewed).find(x=>x.label==="Material")!.value,/verified/);
});

test("shortlisting never mutates the primary exact-fabric-pair navigation",()=>{
  const page=readFileSync("src/app/catalog/page.tsx","utf8");
  assert.match(page,/catalogHandoffPath\(selectedShirt,selectedPant\)/);
  assert.match(page,/toggleCatalogShortlist\(old,id,shirts,"shirt"\)/);
  assert.match(page,/toggleCatalogShortlist\(old,id,pants,"pant"\)/);
  assert.match(page,/setShirtCompareIds\(old=>reconcileCatalogShortlist\(old,nextShirts,"shirt"\)\)/);
  assert.match(page,/setPantCompareIds\(old=>reconcileCatalogShortlist\(old,nextPants,"pant"\)\)/);
  assert.match(page,/aria-pressed=\{compared.includes\(fabric.id\)\}/);
  assert.match(page,/disabled=\{!compared.includes\(fabric.id\)&&compared.length>=CATALOG_SHORTLIST_LIMIT\}/);
  assert.match(page,/catalogFabricCompareRows\(fabric\)/);
  assert.match(page,/onClick=\{\(\)=>choose\(fabric.id\)\}/);
});
