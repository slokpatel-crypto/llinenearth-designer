import test from "node:test";
import assert from "node:assert/strict";
import {
  PHOTO_SHAPE_NEUTRAL_LUMINANCE,
  neutralizePhotographicLuminance,
  weightedGarmentLuminanceMean,
} from "../src/lib/designer/photo-shading.ts";

function rgba(values:number[],alphas:number[]=values.map(()=>255)) {
  const out:number[]=[];
  values.forEach((value,index)=>out.push(value,value,value,alphas[index]??255));
  return new Uint8ClampedArray(out);
}

test("garment luminance baseline ignores transparent pixels outside the cloth mask",()=>{
  const source=rgba([20,80,100,240]);
  const mask=rgba([0,0,0,0],[0,255,255,0]);
  assert.equal(weightedGarmentLuminanceMean(source,mask),90);
});

test("garment luminance baseline keeps a constant photographed cloth unchanged",()=>{
  const source=rgba([72,72,72,72]);
  const mask=rgba([0,0,0,0],[255,255,255,255]);
  assert.equal(weightedGarmentLuminanceMean(source,mask),72);
});

test("log-average garment baseline resists a small bright highlight",()=>{
  const source=rgba([80,80,250]);
  const mask=rgba([0,0,0],[255,255,255]);
  const baseline=weightedGarmentLuminanceMean(source,mask);
  assert.equal(baseline,119);
  assert.ok(baseline<137);
});

test("shape normalization is invariant to the photographed source cloth baseline",()=>{
  // These pairs represent approximately the same relative illumination around
  // two very different source-cloth baselines after sRGB -> linear conversion.
  const darkMean=50;
  const paleMean=170;
  const dark=[41,50,60].map((value)=>neutralizePhotographicLuminance(value,darkMean));
  const pale=[145,170,198].map((value)=>neutralizePhotographicLuminance(value,paleMean));
  dark.forEach((value,index)=>assert.ok(Math.abs(value-pale[index])<=1));
  assert.deepEqual(dark,[110,128,145]);
});

test("equal source and mean always map to neutral gray",()=>{
  for(const mean of [24,50,96,128,170,230]) {
    assert.equal(neutralizePhotographicLuminance(mean,mean),PHOTO_SHAPE_NEUTRAL_LUMINANCE);
  }
});

test("invalid or empty evidence fails to neutral rather than inventing contrast",()=>{
  assert.equal(weightedGarmentLuminanceMean(new Uint8ClampedArray(),new Uint8ClampedArray()),PHOTO_SHAPE_NEUTRAL_LUMINANCE);
  assert.equal(neutralizePhotographicLuminance(Number.NaN,Number.NaN),PHOTO_SHAPE_NEUTRAL_LUMINANCE);
});

test("extreme photographed highlights and shadows remain bounded",()=>{
  assert.equal(neutralizePhotographicLuminance(0,255),48);
  assert.equal(neutralizePhotographicLuminance(255,0),208);
});
