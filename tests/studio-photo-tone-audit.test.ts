import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import {evaluateStudioPhotoTone,writeStudioPhotoToneAudit} from "../scripts/studio-photo-tone-audit.mjs";

async function fixture(directory,name,width,cloth){
  const height=512;
  const buffer=Buffer.alloc(width*height*3,238);
  const patch=(bounds,rgb,wrinkle=0)=>{
    const [x0,x1,y0,y1]=bounds;
    for(let y=Math.floor(y0*height);y<Math.ceil(y1*height);y++){
      for(let x=Math.floor(x0*width);x<Math.ceil(x1*width);x++){
        const offset=(y*width+x)*3;
        const fold=wrinkle?Math.sin((x+y)*.28)*wrinkle:0;
        for(let k=0;k<3;k++)buffer[offset+k]=Math.min(255,Math.max(0,Math.round(rgb[k]+fold)));
      }
    }
  };
  const origin=name==="reference";
  patch([.47,.53,.07,.13],cloth.head);
  patch([.46,.54,.29,.39],cloth.shirt,origin?12:0);
  patch(origin?[.405,.45,.56,.76]:[.448,.47,.56,.76],cloth.trouser);
  const filename=path.join(directory,name+".png");
  await sharp(buffer,{raw:{width,height,channels:3}}).png().toFile(filename);
  return filename;
}

test("photographic QA reports bad cloth colours, washed-out head and flat shirt without granting approval",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"linen-studio-tone-"));
  try{
    const original=await fixture(dir,"reference",340,{head:[195,186,179],shirt:[84,86,90],trouser:[108,94,87]});
    const candidate=await fixture(dir,"candidate",680,{head:[245,243,242],shirt:[91,100,110],trouser:[182,150,138]});
    const report=await evaluateStudioPhotoTone(original,candidate);
    assert.ok(report.obviousReferenceToneSymptoms.length>=3);
    assert.ok(report.samples.trouserLeft.rgbRmsDifference>30);
    assert.ok(report.samples.shirtChest.candidateDetailStdRatio<.5);
    assert.equal(report.visualMatchApproved,false);
    assert.equal(report.measuredPhysicalColourOrDrape,false);
    const destination=path.join(dir,"receipt.json");
    await writeStudioPhotoToneAudit(original,candidate,destination);
    assert.equal(JSON.parse(await readFile(destination,"utf8")).visualMatchApproved,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test("tone-comparable clothing still requires independent model, drape and physical-colour review",async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"linen-studio-parity-"));
  try{
    const a=await fixture(dir,"reference",340,{head:[200,194,188],shirt:[86,88,92],trouser:[108,94,87]});
    const b=await fixture(dir,"candidate",680,{head:[200,194,188],shirt:[86,88,92],trouser:[108,94,87]});
    const report=await evaluateStudioPhotoTone(a,b);
    assert.equal(report.samples.trouserLeft.rgbRmsDifference,0);
    assert.equal(report.samples.head.lumaDifference,0);
    assert.equal(report.visualMatchApproved,false);
    assert.equal(report.requiresIndependentStudioVisualReview,true);
    assert.equal(report.sameClothingCameraAndLightingCertified,false);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test("real native browser QA preserves unmodified 3D pixels and a separate unapproved tone receipt",async()=>{
  const qa=await readFile(new URL("../scripts/verify-garment-viewer.cjs",import.meta.url),"utf8");
  assert.ok(qa.includes('writeStudioPhotoToneAudit('));
  assert.ok(qa.includes('studio-appearance-diagnostic.json'));
  assert.ok(qa.includes('"studio-original-vs-styled-3d-UNAPPROVED.png"'));
  assert.ok(qa.includes('visualMatchApproved:false'));
});
