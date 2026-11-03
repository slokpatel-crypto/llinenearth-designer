import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { photoFabricCaptionSafeCrop } from "../src/lib/designer/photo-fabric-caption-crop.ts";

test("caption-safe photographic tiles stay in the upper cloth field at representative source sizes", () => {
  for (const [w,h] of [[64,64],[96,128],[128,128],[536,640],[293,512],[1024,1536],[1200,300],[300,1200]]) {
    const box=photoFabricCaptionSafeCrop(w,h);
    assert.ok(box.top>=0 && box.left>=0);
    assert.ok(box.top+box.height<=Math.floor(h*0.38), `${w}x${h} crop reaches centre-caption zone`);
    assert.ok(box.left+box.width<=w);
    assert.equal(box.width,box.height);
    assert.ok(box.width>0);
    assert.ok(Number.isInteger(box.left) && Number.isInteger(box.top));
    assert.deepEqual(box,photoFabricCaptionSafeCrop(w,h));
  }
});

test("reject malformed source dimensions rather than creating a mis-scaled tile", () => {
  for (const [w,h] of [[0,640],[640,NaN],[Infinity,600],[200,31],[31,200],[200.5,900],[-1,900]]) {
    assert.throws(()=>photoFabricCaptionSafeCrop(w,h),RangeError);
  }
});

test("tile builder uses caption-safe crop for its generated assets and advances the asset version", () => {
  const script=readFileSync("scripts/build-fabric-render-assets.mjs","utf8");
  assert.match(script,/photoFabricCaptionSafeCrop\(width,height\)/);
  // Only actual catalogue source files must meet the higher 150px bar;
  // 64px synthetic QA tiles and browser thumbnails are valid crop inputs.
  assert.match(script,/if\(width<150\|\|height<150\) throw new Error/);
  assert.match(script,/fabric-tile-v3-caption-safe/);
  assert.doesNotMatch(script,/Math\.round\(height\*\.18\)/);
  assert.match(script,/measured\.physicalScaleStatus/);
  assert.match(script,/scaleApproximate:tileRealWidthMm===null/);
});

test("fallback raw photographic swatches use the same caption-safe plain crop", () => {
  const component=readFileSync("src/components/PhotoOutfitPreview.tsx","utf8");
  assert.match(component,/const plainCrop = plain \? photoFabricCaptionSafeCrop\(image\.width,image\.height\) : null/);
  assert.match(component,/const sourceX = plainCrop\?\.left/);
  assert.match(component,/const sourceY = plainCrop\?\.top/);
  assert.match(component,/const sourceWidth = plainCrop\?\.width/);
  assert.match(component,/const sourceHeight = plainCrop\?\.height/);
  assert.doesNotMatch(component,/image\.height \* \(plain \? \.22 : \.16\)/);
});

test("64px synthetic shirt and trouser swatches render a bounded caption-safe source crop", () => {
  const box=photoFabricCaptionSafeCrop(64,64);
  assert.deepEqual(box,{left:22,top:3,width:20,height:20});
  assert.deepEqual(photoFabricCaptionSafeCrop(64,64),box);
});
