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
