import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {garmentGravityFoldDisplacement,studioSleeveRadiusScale} from "../scripts/garment-gravity-drape.mjs";

test("gravity folds vanish exactly at measurement-locked shirt, sleeve and trouser guides",()=>{
  for(const [part,ends,cx] of [
    ["shirt",[1.055,1.465],0],
    ["sleeve",[.883,1.455],-.226],
    ["leg",[.06002,.98498],-.105],
  ] as const){
    for(const y of ends)
      assert.deepEqual(garmentGravityFoldDisplacement(part,{x:cx+.035,y,z:.070},cx,.015),{x:0,z:0});
  }
});
test("outward fabric relief gives visible depth without large unverified body-shape changes",()=>{
  for(const [part,y,cx] of [
    ["shirt",1.17,0],
    ["sleeve",1.18,.226],
    ["leg",.32,-.105],
  ] as const){
    const front=garmentGravityFoldDisplacement(part,{x:cx+.035,y,z:.085},cx,.015);
    const back=garmentGravityFoldDisplacement(part,{x:cx-.025,y,z:-.090},cx,.015);
    assert.ok(front.z>=0 && back.z<=0,part+" must displace cloth away from the skin");
    assert.ok(front.z<=.006&&Math.abs(back.z)<=.006,"procedural folds must stay within 6 mm");
    assert.ok(Math.abs(front.x)<=.002&&Math.abs(back.x)<=.002,"guide silhouette must not be reshaped");
    assert.ok(front.z>0||back.z<0,"a fully flat preview is visually unacceptable");
  }
});
test("preview fold geometry keeps physical UV grain and cannot claim simulated drape",()=>{
  const builder=readFileSync("scripts/build-garment-viewer-model.mjs","utf8");
  assert.ok(builder.includes("previewGravityDrapeGeometry("));
  assert.ok(builder.includes("return recomputeClothSideNormals(draped)"));
  assert.ok(builder.includes("return {...geometry,normals}"),"rebuild geometric shading, preserve UV buffers");
  for(const part of ['"shirt"','"sleeve"','"leg"'])
    assert.ok(builder.includes("previewGravityDrapeGeometry(")&&builder.includes(part));
  assert.ok(builder.includes("Real drape calibration still"));
});
test("fabric relief rejects invalid coordinates or unknown garment types",()=>{
  assert.throws(()=>garmentGravityFoldDisplacement("blazer",{x:0,y:1,z:0}),/Unknown/);
  assert.throws(()=>garmentGravityFoldDisplacement("shirt",{x:NaN,y:1.2,z:0}),/finite/);
});

test("tailored sleeve eases smoothly from cuff to unchanged shoulder geometry",()=>{
  assert.equal(studioSleeveRadiusScale(.925),.895);
  assert.equal(studioSleeveRadiusScale(1.26),1);
  assert.equal(studioSleeveRadiusScale(1.45),1);
  assert.equal(studioSleeveRadiusScale(.88),.895);
  const sample=Array.from({length:100},(_,i)=>studioSleeveRadiusScale(.925+i*.335/99));
  assert.ok(sample.every((scale)=>scale>=.895&&scale<=1));
  assert.ok(sample.every((v,i)=>i===0||v>=sample[i-1]),"lower cuff is smaller than the upper arm");
  assert.throws(()=>studioSleeveRadiusScale(NaN),/finite/);
  assert.throws(()=>studioSleeveRadiusScale(Infinity),/finite/);
  const source=readFileSync("scripts/build-garment-viewer-model.mjs","utf8");
  assert.ok(source.includes("const sleeveTaper=studioSleeveRadiusScale(p.y)"));
  assert.ok(source.includes("x:centerX+(p.x-centerX)*sleeveTaper"));
  assert.ok(source.includes("z:.020+(p.z-.020)*sleeveTaper"));
});
