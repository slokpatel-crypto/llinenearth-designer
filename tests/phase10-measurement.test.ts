import test from "node:test";
import assert from "node:assert/strict";
import { assessImageQuality, measuredPalette, measurePattern } from "../src/lib/fabric-measurement-core.ts";

function solid(width:number,height:number,r:number,g:number,b:number){
  const data=new Uint8Array(width*height*3);
  for(let i=0;i<data.length;i+=3){data[i]=r;data[i+1]=g;data[i+2]=b;}
  return data;
}
function grayFromRgb(rgb:Uint8Array){
  const gray=new Uint8Array(rgb.length/3);
  for(let i=0,j=0;i<rgb.length;i+=3,j++) gray[j]=Math.round(.2126*rgb[i]+.7152*rgb[i+1]+.0722*rgb[i+2]);
  return gray;
}

test("measured palette maps a blue swatch without model judgement",()=>{
  const rgb=solid(64,64,32,72,126);
  const result=measuredPalette(rgb,64,64,3,3);
  assert.equal(result.mappedColorFamily,"blue_family");
  assert(result.dominant.coverage>.9);
  assert.match(result.dominant.hex,/^#[0-9A-F]{6}$/);
});

test("vertical stripe periodicity is measured in pixels and only becomes mm with declared scale",()=>{
  const w=128,h=128;
  const gray=new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) gray[y*w+x]=(x%16<8)?40:220;
  const palette=[
    {hex:"#282828",lab:{l:16,a:0,b:0},coverage:.5},
    {hex:"#DCDCDC",lab:{l:88,a:0,b:0},coverage:.5},
  ];
  const px=measurePattern(gray,w,h,palette);
  assert.equal(px.orientation,"vertical");
  assert.equal(px.repeatPeriodPx,16);
  assert.equal(px.repeatMm,null);
  assert.equal(px.physicalScaleStatus,"unknown");

  const mm=measurePattern(gray,w,h,palette,{swatchRealWidthMm:256,originalWidthPx:512});
  assert.equal(mm.physicalScaleStatus,"declared_swatch_width");
  assert.equal(mm.repeatMm,32);
});

test("a smooth lighting gradient cannot supply a stripe repeat measurement",()=>{
  const w=128,h=128;
  const gray=new Uint8Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) gray[y*w+x]=30+x;
  const result=measurePattern(gray,w,h,[]);
  assert.equal(result.repeatPeriodPx,null);
  assert.equal(result.repeatMm,null);
});

test("image quality reports low resolution and flat blur explicitly",()=>{
  const rgb=solid(64,64,120,120,120);
  const gray=grayFromRgb(rgb);
  const quality=assessImageQuality(rgb,gray,64,64,3,220,220);
  assert(quality.issues.includes("resolution_low"));
  assert(quality.issues.includes("blur_high"));
  assert(quality.score<60);
});

test("saturated fabric colour is not misclassified as an illumination colour cast",()=>{
  const rgb=solid(128,128,20,55,185);
  const gray=grayFromRgb(rgb);
  const quality=assessImageQuality(rgb,gray,128,128,3,1200,1200);
  assert(quality.colorCast>95);
  assert(!quality.issues.includes("strong_color_cast"));
});

test("width-only calibration cannot claim mm for horizontal stripes",()=>{
  const width=128,height=128;
  const gray=new Uint8Array(width*height);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) gray[y*width+x]=(y%16<8)?40:220;
  const result=measurePattern(gray,width,height,[],{swatchRealWidthMm:256,originalWidthPx:512});
  assert.equal(result.orientation,"horizontal");
  assert.equal(result.repeatPeriodPx,16);
  assert.equal(result.repeatMm,null);
  assert.equal(result.physicalScaleStatus,"unknown");
  const repeatDeclared=measurePattern(gray,width,height,[],{repeatRealMm:22});
  assert.equal(repeatDeclared.repeatMm,22);
  assert.equal(repeatDeclared.physicalScaleStatus,"declared_repeat");
});

test("unresolved pixel repeat cannot become physically calibrated from a declared number",()=>{
  const flat=new Uint8Array(128*128).fill(120);
  for(const physical of [{repeatRealMm:18},{swatchRealWidthMm:250,originalWidthPx:500}]) {
    const result=measurePattern(flat,128,128,[],physical);
    assert.equal(result.repeatPeriodPx,null);
    assert.equal(result.repeatMm,null);
    assert.equal(result.physicalScaleStatus,"unknown");
  }
});

test("nonfinite and implausible mm inputs cannot produce a verified fabric scale",()=>{
  const width=128,height=128;
  const gray=new Uint8Array(width*height);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) gray[y*width+x]=(x%16<8)?40:220;
  for(const repeatRealMm of [Number.NaN,Infinity,-8,0,6000,.01]) {
    const result=measurePattern(gray,width,height,[],{repeatRealMm});
    assert.equal(result.physicalScaleStatus,"unknown");
    assert.equal(result.repeatMm,null);
  }
  const invalidWidth=measurePattern(gray,width,height,[],{swatchRealWidthMm:Infinity,originalWidthPx:512});
  assert.equal(invalidWidth.physicalScaleStatus,"unknown");
});
