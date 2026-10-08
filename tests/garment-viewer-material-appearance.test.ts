import test from "node:test";
import assert from "node:assert/strict";
import {needsVariantMaterialRefresh} from "../src/lib/garment-viewer-material-appearance.ts";

const base={textureRevision:3,roughness:.72,shirtId:"linen-sky",trouserId:"linen-beige"};

test("style-only changes do not re-upload unchanged visible WebGL materials",()=>{
  assert.equal(needsVariantMaterialRefresh(true,base,{...base}),false);
});
test("newly selected or initial materials must hydrate",()=>{
  assert.equal(needsVariantMaterialRefresh(false,base,{...base}),true);
  assert.equal(needsVariantMaterialRefresh(true,null,{...base}),true);
});
test("fabric, normal texture revision or finish changes still refresh",()=>{
  assert.equal(needsVariantMaterialRefresh(true,base,{...base,shirtId:"linen-white"}),true);
  assert.equal(needsVariantMaterialRefresh(true,base,{...base,trouserId:"linen-navy"}),true);
  assert.equal(needsVariantMaterialRefresh(true,base,{...base,textureRevision:4}),true);
  assert.equal(needsVariantMaterialRefresh(true,base,{...base,roughness:.78}),true);
});
