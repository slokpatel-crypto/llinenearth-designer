import test from "node:test";
import assert from "node:assert/strict";
import {
  PHOTO_SHAPE_NEUTRAL_LUMINANCE,
  neutralizePhotographicFoldDifference,
  neutralizePhotographicLuminance,
  weightedGarmentLuminanceMean,
} from "../src/lib/designer/photo-shading.ts";

function rgba(values:number[],alphas:number[]=values.map(()=>255)) {
  const out:number[]=[];
  values.forEach((value,index)=>out.push(value,value,value,alphas[index]??255));
  return new Uint8ClampedArray(out);
}

test("garment luminance mean ignores transparent pixels outside the cloth mask",()=>{
  const source=rgba([20,80,100,240]);
  const mask=rgba([0,0,0,0],[0,255,255,0]);
  assert.equal(weightedGarmentLuminanceMean(source,mask),90);
});

test("shape normalization is invariant to the photographed source cloth baseline",()=>{
  const darkMean=50;
  const paleMean=170;
  const dark=[30,50,70].map((value)=>neutralizePhotographicLuminance(value,darkMean));
  const pale=[150,170,190].map((value)=>neutralizePhotographicLuminance(value,paleMean));
  assert.deepEqual(dark,pale);
  assert.deepEqual(dark,[112,128,144]);
});

test("invalid or empty evidence fails to neutral rather than inventing contrast",()=>{
  assert.equal(weightedGarmentLuminanceMean(new Uint8ClampedArray(),new Uint8ClampedArray()),PHOTO_SHAPE_NEUTRAL_LUMINANCE);
  assert.equal(neutralizePhotographicLuminance(Number.NaN,Number.NaN),PHOTO_SHAPE_NEUTRAL_LUMINANCE);
});

test("extreme photographed highlights and shadows remain bounded",()=>{
  assert.equal(neutralizePhotographicLuminance(0,255),48);
  assert.equal(neutralizePhotographicLuminance(255,0),208);
});

test("fold-band normalization is invariant to source-cloth baseline",()=>{
  const dark=[40,50,60].map((fine,index)=>neutralizePhotographicFoldDifference(fine,[50,50,50][index]));
  const pale=[160,170,180].map((fine,index)=>neutralizePhotographicFoldDifference(fine,[170,170,170][index]));
  assert.deepEqual(dark,pale);
  assert.deepEqual(dark,[114,128,142]);
});

test("fold-band normalization stays bounded and neutral on invalid input",()=>{
  assert.equal(neutralizePhotographicFoldDifference(Number.NaN,Number.NaN),128);
  assert.equal(neutralizePhotographicFoldDifference(0,255),40);
  assert.equal(neutralizePhotographicFoldDifference(255,0),216);
});
