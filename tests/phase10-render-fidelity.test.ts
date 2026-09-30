import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { compareRenderMeasuredColors, worstRenderColorStatus } from "../src/lib/designer/render-fidelity-core.ts";

async function outfitImage(shirt:string,pant:string) {
  const width=400,height=500;
  return sharp({create:{width,height,channels:3,background:"#0a1628"}})
    .composite([
      {input:Buffer.from(`<svg width="160" height="150"><rect width="160" height="150" fill="${shirt}"/></svg>`),left:120,top:85},
      {input:Buffer.from(`<svg width="170" height="190"><rect width="170" height="190" fill="${pant}"/></svg>`),left:115,top:270},
    ])
    .jpeg({quality:98})
    .toBuffer();
}

test("measured colour guard passes a render close to both cloth references",async()=>{
  const image=await outfitImage("#6B83A3","#817A73");
  const result=await compareRenderMeasuredColors(image,"front",{shirtHex:"#6B83A3",pantHex:"#817A73"});
  assert.equal(result.shirt.status,"strong");
  assert.equal(result.pant.status,"strong");
  assert.equal(worstRenderColorStatus(result),"strong");
  assert((result.shirt.deltaE||99)<12);
  assert((result.pant.deltaE||99)<12);
});

test("measured colour guard flags large photoreal hue drift",async()=>{
  const image=await outfitImage("#B13A2E","#817A73");
  const result=await compareRenderMeasuredColors(image,"front",{shirtHex:"#4D78B5",pantHex:"#817A73"});
  assert.equal(result.shirt.status,"weak");
  assert.equal(result.pant.status,"strong");
  assert.equal(worstRenderColorStatus(result),"weak");
});

test("missing measured target stays unavailable rather than inventing colour truth",async()=>{
  const image=await outfitImage("#6B83A3","#817A73");
  const result=await compareRenderMeasuredColors(image,"front",{shirtHex:null,pantHex:"#817A73"});
  assert.equal(result.shirt.status,"unavailable");
  assert.equal(result.shirt.deltaE,null);
  assert.equal(worstRenderColorStatus(result),"strong");
});
