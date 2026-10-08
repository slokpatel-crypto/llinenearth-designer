import test from "node:test";
import assert from "node:assert/strict";
import {needsVariantMaterialRefresh,needsButtonMaterialRefresh,trimAppearanceKey} from "../src/lib/garment-viewer-material-appearance.ts";

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

test("button materials only refresh when newly visible or material selection changes",()=>{
  assert.equal(needsButtonMaterialRefresh(true,"metal","metal"),false);
  assert.equal(needsButtonMaterialRefresh(false,"metal","metal"),true);
  assert.equal(needsButtonMaterialRefresh(true,"metal","mother_of_pearl"),true);
  assert.equal(needsButtonMaterialRefresh(true,null,"metal"),true);
});
test("collar/cuff cache invalidates for construction, contrast cloth, fabric and finish",()=>{
  const trim={
    collar:"point",collarConstruction:"stiff_fused",collarFinish:"self",
    cuff:"barrel",cuffConstruction:"fused",sleeve:"full",
    shirtId:"linen-sky",textureRevision:3,roughness:.72,shirtDrape:"medium",
  };
  const key=trimAppearanceKey(trim);
  assert.equal(trimAppearanceKey({...trim}),key);
  for(const changed of [
    {collar:"english_spread"},{collarConstruction:"soft_unfused"},
    {collarFinish:"white_collar_cuffs"},{cuff:"cocktail"},
    {cuffConstruction:"soft"},{sleeve:"half"},{shirtId:"linen-white"},
    {textureRevision:4},{roughness:.8},{shirtDrape:"fluid"},
  ]) assert.notEqual(trimAppearanceKey({...trim,...changed}),key);
});
