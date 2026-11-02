import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { composeViewerPreviewStock } from "../src/lib/designer/viewer-preview-stock.ts";
import type { FabricColorway } from "../src/lib/fabric-stock.ts";

const fabric=(id:string,inStock=true,availabilityVerified?:boolean):FabricColorway=>({
  id,inStock,availabilityVerified,
  family:"Linen",line:"Test",colorName:id,hex:"#dddddd",swatchImageUrl:"/test.webp",
  suitableFor:["shirt","trouser"],pattern:"Plain",sourceDocument:"synthetic",sourcePage:1,
});

test("no stock evidence keeps the internal 3D preview reconstructable but explicitly unverified",()=>{
  const source=[fabric("shirt"),fabric("pant")];
  const result=composeViewerPreviewStock(source,[]);
  assert.deepEqual(result.map(({id,inStock,availabilityVerified})=>({id,inStock,availabilityVerified})),[
    {id:"shirt",inStock:false,availabilityVerified:false},
    {id:"pant",inStock:false,availabilityVerified:false},
  ]);
  assert.equal(source[0].inStock,true,"nominal catalogue must remain untouched");
});

test("verified live metadata can enrich the preview without falsely verifying other fabrics",()=>{
  const source=[fabric("shirt"),fabric("pant"),fabric("other")];
  const selected=composeViewerPreviewStock(source,[{...fabric("shirt",true,true),weightGsm:160},fabric("pant",false,true)]);
  assert.deepEqual(selected.map(({id,inStock,availabilityVerified})=>[id,inStock,availabilityVerified]),[
    ["shirt",true,true],["pant",false,false],["other",false,false],
  ]);
  assert.equal(selected[0].weightGsm,160);
});

test("a forged positive flag without physical verification never becomes live stock",()=>{
  const catalogue=[fabric("a"),fabric("b")];
  const selected=composeViewerPreviewStock(catalogue,[fabric("a",true,false),fabric("b",true)]);
  assert.equal(selected.every((x)=>x.inStock===false && x.availabilityVerified===false),true);
});

test("missing and extraneous IDs never change deterministic catalogue ordering",()=>{
  const catalogue=[fabric("c"),fabric("a"),fabric("b")];
  const selected=composeViewerPreviewStock(catalogue,[fabric("evil",true,true),fabric("b",true,true)]);
  assert.deepEqual(selected.map((f)=>f.id),["c","a","b"]);
  assert.deepEqual(selected.map((f)=>f.inStock),[false,false,true]);
});

test("3D lab reuses safe prototype-only stock without changing the live Designer catalogue",async()=>{
  const lab=await readFile(new URL("../src/app/lab/garment-viewer/page.tsx",import.meta.url),"utf8");
  const liveRoute=await readFile(new URL("../src/app/api/designer/catalog/route.ts",import.meta.url),"utf8");
  const viewer=await readFile(new URL("../src/components/GarmentViewer.tsx",import.meta.url),"utf8");
  assert.match(lab,/composeViewerPreviewStock\(FABRIC_STOCK,live\.stock\)/);
  assert.match(lab,/Preview only/);
  assert.match(viewer,/Preview only — confirm stock/);
  assert.match(liveRoute,/loadActiveDesignerFabricStock/);
  assert.doesNotMatch(liveRoute,/composeViewerPreviewStock/);
});
