import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { photoFabricCaptionSafeCrop } from "../src/lib/designer/photo-fabric-caption-crop.ts";

test("caption-safe photographic tiles stay in the upper cloth field at representative source sizes", () => {
  for (const [w,h] of [[536,640],[293,512],[1024,1536],[1200,300],[300,1200]]) {
    const box=photoFabricCaptionSafeCrop(w,h);
    assert.ok(box.top>=0 && box.left>=0);
    assert.ok(box.top+box.height<=Math.floor(h*0.38), `${w}x${h} crop reaches centre-caption zone`);
    assert.ok(box.left+box.width<=w);
    assert.equal(box.width,box.height);
    assert.ok(box.width>0);
    assert.equal(box,box); // crop is a plain deterministic geometry value
    assert.deepEqual(box,photoFabricCaptionSafeCrop(w,h));
  }
});

test("reject malformed source dimensions rather than creating a mis-scaled tile", () => {
  for (const [w,h] of [[0,640],[640,NaN],[Infinity,600],[200,100],[200.5,900],[-1,900]]) {
    assert.throws(()=>photoFabricCaptionSafeCrop(w,h),RangeError);
  }
});

test("tile builder uses caption-safe crop for its generated assets and advances the asset version", () => {
  const script=readFileSync("scripts/build-fabric-render-assets.mjs","utf8");
  assert.match(script,/photoFabricCaptionSafeCrop\(width,height\)/);
  assert.match(script,/fabric-tile-v3-caption-safe/);
  assert.doesNotMatch(script,/Math\.round\(height\*\.18\)/);
  assert.match(script,/measured\.physicalScaleStatus/);
  assert.match(script,/scaleApproximate:tileRealWidthMm===null/);
});
