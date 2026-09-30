import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { compareRenderMeasuredColors, compareRenderMeasuredPatterns, worstRenderColorStatus, worstRenderPatternStatus } from "../src/lib/designer/render-fidelity-core.ts";

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


async function stripedOutfit(orientation:"vertical"|"horizontal",periodPx=16,stripeWidthPx=7) {
  const width=400,height=500;
  const stripeSvg=(w:number,h:number,base:string,ink:string)=>{
    const stripes=orientation==="vertical"
      ? Array.from({length:Math.ceil(w/periodPx)},(_,i)=>`<rect x="${i*periodPx}" y="0" width="${stripeWidthPx}" height="${h}" fill="${ink}"/>`).join("")
      : Array.from({length:Math.ceil(h/periodPx)},(_,i)=>`<rect x="0" y="${i*periodPx}" width="${w}" height="${stripeWidthPx}" fill="${ink}"/>`).join("");
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${base}"/>${stripes}</svg>`);
  };
  return sharp({create:{width,height,channels:3,background:"#0a1628"}})
    .composite([
      {input:stripeSvg(160,150,"#D8D7D2","#30343A"),left:120,top:85},
      {input:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="170" height="190"><rect width="170" height="190" fill="#817A73"/></svg>'),left:115,top:270},
    ])
    .png()
    .toBuffer();
}

test("pattern guard confirms a clear vertical stripe when measured evidence expects vertical",async()=>{
  const image=await stripedOutfit("vertical");
  const result=await compareRenderMeasuredPatterns(image,"front",{
    shirtOrientation:"vertical",pantOrientation:null,shirtContrastDeltaE:35,pantContrastDeltaE:null,
  });
  assert.equal(result.shirt.status,"strong");
  assert.equal(result.shirt.observedOrientation,"vertical");
  assert.equal(result.pant.status,"unavailable");
  assert.equal(worstRenderPatternStatus(result),"strong");
});

test("pattern guard reviews or rejects an axis flip instead of silently passing it",async()=>{
  const image=await stripedOutfit("horizontal");
  const result=await compareRenderMeasuredPatterns(image,"front",{
    shirtOrientation:"vertical",pantOrientation:null,shirtContrastDeltaE:35,pantContrastDeltaE:null,
  });
  assert(["review","weak"].includes(result.shirt.status));
  assert.notEqual(result.shirt.status,"strong");
});

test("subtle low-contrast pattern evidence does not create a false hard check",async()=>{
  const image=await stripedOutfit("horizontal");
  const result=await compareRenderMeasuredPatterns(image,"front",{
    shirtOrientation:"vertical",pantOrientation:null,shirtContrastDeltaE:4,pantContrastDeltaE:null,
  });
  assert.equal(result.shirt.status,"unavailable");
  assert.equal(worstRenderPatternStatus(result),"unavailable");
});


test("physical repeat and stripe width stay strong when final render scale is close to measured cloth",async()=>{
  const image=await stripedOutfit("vertical",16,7);
  const result=await compareRenderMeasuredPatterns(image,"front",{
    shirtOrientation:"vertical",pantOrientation:null,
    shirtContrastDeltaE:35,pantContrastDeltaE:null,
    shirtRepeatMm:65,pantRepeatMm:null,
    shirtStripeWidthMm:29,pantStripeWidthMm:null,
    bodyHeightCm:178,
  });
  assert.equal(result.shirt.status,"strong",JSON.stringify(result.shirt));
  assert(result.shirt.observedRepeatMm!==null && result.shirt.observedRepeatMm>45 && result.shirt.observedRepeatMm<85);
  assert(result.shirt.observedStripeWidthMm!==null && result.shirt.observedStripeWidthMm>18 && result.shirt.observedStripeWidthMm<45);
});

test("physical scale guard rejects gross AI stripe enlargement even when the axis is correct",async()=>{
  const image=await stripedOutfit("vertical",16,7);
  const result=await compareRenderMeasuredPatterns(image,"front",{
    shirtOrientation:"vertical",pantOrientation:null,
    shirtContrastDeltaE:35,pantContrastDeltaE:null,
    shirtRepeatMm:20,pantRepeatMm:null,
    shirtStripeWidthMm:8,pantStripeWidthMm:null,
    bodyHeightCm:178,
  });
  assert.equal(result.shirt.observedOrientation,"vertical");
  assert.equal(result.shirt.status,"weak");
  assert.equal(worstRenderPatternStatus(result),"weak");
});

test("physical repeat survives crop resampling, both stripe axes and image resolution changes",async()=>{
  // The fixture is 500px high and represents 1780mm at 88% frame occupancy.
  // Expected sizes come from fixture geometry, independent of the detector.
  for(const orientation of ["vertical","horizontal"] as const) {
    for(const period of [12,16,24]) {
      const width=Math.round(period*.44);
      const original=await stripedOutfit(orientation,period,width);
      for(const resolution of [1,2]) {
        const image=await sharp(original).resize(400*resolution,500*resolution).jpeg({quality:92}).toBuffer();
        const repeatMm=period*1780/440;
        const result=await compareRenderMeasuredPatterns(image,"front",{
          shirtOrientation:orientation,pantOrientation:null,
          shirtContrastDeltaE:35,pantContrastDeltaE:null,
          shirtRepeatMm:repeatMm,shirtStripeWidthMm:width*1780/440,bodyHeightCm:178,
        });
        const label=`${orientation}, period ${period}px, resolution ${resolution}x`;
        assert.equal(result.shirt.status,"strong",label);
        assert(result.shirt.observedRepeatMm!==null,label);
        assert(Math.abs(result.shirt.observedRepeatMm-repeatMm)<repeatMm*.08,label);
      }
    }
  }
});

test("physical scale keeps moderate mismatch under review and rejects gross shrinkage",async()=>{
  const image=await stripedOutfit("vertical",16,7);
  for(const [repeatMm,stripeMm,status] of [[100,50,"review"],[210,95,"weak"]] as const) {
    const result=await compareRenderMeasuredPatterns(image,"front",{
      shirtOrientation:"vertical",pantOrientation:null,
      shirtContrastDeltaE:35,pantContrastDeltaE:null,
      shirtRepeatMm:repeatMm,shirtStripeWidthMm:stripeMm,bodyHeightCm:178,
    });
    assert.equal(result.shirt.status,status);
  }
});

test("physical size is never approved without a valid height anchor",async()=>{
  const image=await stripedOutfit("vertical",16,7);
  for(const bodyHeightCm of [undefined,null,0,NaN]) {
    const result=await compareRenderMeasuredPatterns(image,"front",{
      shirtOrientation:"vertical",pantOrientation:null,
      shirtContrastDeltaE:35,pantContrastDeltaE:null,
      shirtRepeatMm:65,shirtStripeWidthMm:29,bodyHeightCm,
    });
    assert.equal(result.shirt.observedOrientation,"vertical");
    assert.equal(result.shirt.observedRepeatMm,null);
    assert.equal(result.shirt.observedStripeWidthMm,null);
    assert.equal(result.shirt.status,"review");
  }
});
