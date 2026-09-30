import sharp from "sharp";
import { measuredPalette, measurePattern } from "../fabric-measurement-core.ts";
import { deltaE2000, srgbHexToLab } from "../vocab/color-distance.ts";

type Box={x:number;y:number;w:number;h:number};

export type RenderFidelityView="front"|"three-quarter"|"side"|"back";

const VIEW_BOXES:Record<RenderFidelityView,{shirt:Box;pant:Box}>={
  front:{
    shirt:{x:.36,y:.20,w:.28,h:.24},
    pant:{x:.34,y:.57,w:.32,h:.22},
  },
  "three-quarter":{
    shirt:{x:.35,y:.20,w:.30,h:.25},
    pant:{x:.34,y:.57,w:.32,h:.22},
  },
  side:{
    shirt:{x:.40,y:.20,w:.22,h:.25},
    pant:{x:.39,y:.57,w:.24,h:.22},
  },
  back:{
    shirt:{x:.36,y:.20,w:.28,h:.25},
    pant:{x:.34,y:.57,w:.32,h:.22},
  },
};

export type RenderColorFidelityItem={
  targetHex:string|null;
  sampledHex:string|null;
  deltaE:number|null;
  status:"strong"|"review"|"weak"|"unavailable";
};

export type RenderColorFidelityResult={
  shirt:RenderColorFidelityItem;
  pant:RenderColorFidelityItem;
};

export type RenderPatternOrientation="none"|"vertical"|"horizontal"|"grid"|"uncertain";
export type RenderPatternFidelityItem={
  expectedOrientation:RenderPatternOrientation|null;
  observedOrientation:RenderPatternOrientation|null;
  expectedContrastDeltaE:number|null;
  observedContrastDeltaE:number|null;
  expectedRepeatMm:number|null;
  observedRepeatMm:number|null;
  expectedStripeWidthMm:number|null;
  observedStripeWidthMm:number|null;
  status:"strong"|"review"|"weak"|"unavailable";
};
export type RenderPatternFidelityResult={
  shirt:RenderPatternFidelityItem;
  pant:RenderPatternFidelityItem;
};


function unavailable(targetHex:string|null):RenderColorFidelityItem {
  return {targetHex,sampledHex:null,deltaE:null,status:"unavailable"};
}

function statusFor(delta:number) {
  return delta<=12?"strong" as const:delta<=25?"review" as const:"weak" as const;
}

async function sampleRegion(
  image:Buffer|Uint8Array,
  box:Box,
  targetHex:string|null,
):Promise<RenderColorFidelityItem> {
  if(!targetHex) return unavailable(null);
  const targetLab=srgbHexToLab(targetHex);
  if(!targetLab) return unavailable(targetHex);

  const metadata=await sharp(image).metadata();
  const width=metadata.width||0,height=metadata.height||0;
  if(width<80||height<80) return unavailable(targetHex);
  const left=Math.max(0,Math.min(width-2,Math.floor(box.x*width)));
  const top=Math.max(0,Math.min(height-2,Math.floor(box.y*height)));
  const cropWidth=Math.max(2,Math.min(width-left,Math.floor(box.w*width)));
  const cropHeight=Math.max(2,Math.min(height-top,Math.floor(box.h*height)));
  const {data,info}=await sharp(image)
    .extract({left,top,width:cropWidth,height:cropHeight})
    .resize(96,96,{fit:"fill"})
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject:true});
  const palette=measuredPalette(new Uint8Array(data),info.width,info.height,info.channels,4).palette;
  if(!palette.length) return unavailable(targetHex);

  // Garment boxes can still contain seams, buttons or small slices of skin.
  // Choose a substantial palette cluster that is nearest the measured cloth
  // colour, rather than the single most common pixel cluster.
  const candidates=palette.filter((entry)=>entry.coverage>=.08);
  const pool=candidates.length?candidates:palette;
  const chosen=[...pool].sort((a,b)=>{
    const da=deltaE2000(targetLab,a.lab)+(a.coverage<.15?4:0);
    const db=deltaE2000(targetLab,b.lab)+(b.coverage<.15?4:0);
    return da-db;
  })[0];
  const delta=Math.round(deltaE2000(targetLab,chosen.lab)*10)/10;
  return {targetHex,sampledHex:chosen.hex,deltaE:delta,status:statusFor(delta)};
}

export async function compareRenderMeasuredColors(
  image:Buffer|Uint8Array,
  view:RenderFidelityView,
  targets:{shirtHex:string|null;pantHex:string|null},
):Promise<RenderColorFidelityResult> {
  const boxes=VIEW_BOXES[view]||VIEW_BOXES.front;
  const [shirt,pant]=await Promise.all([
    sampleRegion(image,boxes.shirt,targets.shirtHex),
    sampleRegion(image,boxes.pant,targets.pantHex),
  ]);
  return {shirt,pant};
}


function patternUnavailable(
  expectedOrientation:RenderPatternOrientation|null,
  expectedContrastDeltaE:number|null,
  expectedRepeatMm:number|null,
  expectedStripeWidthMm:number|null,
):RenderPatternFidelityItem {
  return {
    expectedOrientation,
    observedOrientation:null,
    expectedContrastDeltaE,
    observedContrastDeltaE:null,
    expectedRepeatMm,
    observedRepeatMm:null,
    expectedStripeWidthMm,
    observedStripeWidthMm:null,
    status:"unavailable",
  };
}

function orientationStatus(
  expected:RenderPatternOrientation,
  observed:RenderPatternOrientation,
) {
  if(observed===expected) return "strong" as const;
  if(observed==="uncertain" || observed==="none") return "review" as const;
  if(expected==="grid" || observed==="grid") return "review" as const;
  return "weak" as const;
}

function physicalScaleStatus(expected:number|null,observed:number|null) {
  if(expected===null || !Number.isFinite(expected) || expected<=0) return null;
  if(observed===null || !Number.isFinite(observed) || observed<=0) return "review" as const;
  const ratio=Math.max(expected/observed,observed/expected);
  return ratio<=1.45?"strong" as const:ratio<=2.2?"review" as const:"weak" as const;
}

function patternStatus(
  expected:RenderPatternOrientation,
  observed:RenderPatternOrientation,
  expectedRepeatMm:number|null,
  observedRepeatMm:number|null,
  expectedStripeWidthMm:number|null,
  observedStripeWidthMm:number|null,
) {
  const states:Array<"strong"|"review"|"weak">=[orientationStatus(expected,observed)];
  // Physical scale is only meaningful for a directional stripe/repeat with a
  // known body-height anchor. Grid/irregular motifs stay orientation-only.
  if((expected==="vertical"||expected==="horizontal") && (observed==="vertical"||observed==="horizontal")) {
    const repeatState=physicalScaleStatus(expectedRepeatMm,observedRepeatMm);
    const stripeState=physicalScaleStatus(expectedStripeWidthMm,observedStripeWidthMm);
    if(repeatState) states.push(repeatState);
    if(stripeState) states.push(stripeState);
  }
  return states.includes("weak")?"weak" as const:states.includes("review")?"review" as const:"strong" as const;
}

async function samplePatternRegion(
  image:Buffer|Uint8Array,
  box:Box,
  expectedOrientation:RenderPatternOrientation|null,
  expectedContrastDeltaE:number|null,
  expectedRepeatMm:number|null,
  expectedStripeWidthMm:number|null,
  bodyHeightCm:number|null,
):Promise<RenderPatternFidelityItem> {
  if(!expectedOrientation || ["none","uncertain"].includes(expectedOrientation)) {
    return patternUnavailable(expectedOrientation,expectedContrastDeltaE,expectedRepeatMm,expectedStripeWidthMm);
  }
  // Very low-contrast motifs are not reliable enough to police from a
  // photoreal render because folds and studio lighting can dominate the axis.
  if(expectedContrastDeltaE!==null && expectedContrastDeltaE<8) {
    return patternUnavailable(expectedOrientation,expectedContrastDeltaE,expectedRepeatMm,expectedStripeWidthMm);
  }

  const metadata=await sharp(image).metadata();
  const width=metadata.width||0,height=metadata.height||0;
  if(width<80||height<80) return patternUnavailable(expectedOrientation,expectedContrastDeltaE,expectedRepeatMm,expectedStripeWidthMm);
  const left=Math.max(0,Math.min(width-2,Math.floor(box.x*width)));
  const top=Math.max(0,Math.min(height-2,Math.floor(box.y*height)));
  const cropWidth=Math.max(2,Math.min(width-left,Math.floor(box.w*width)));
  const cropHeight=Math.max(2,Math.min(height-top,Math.floor(box.h*height)));
  const base=sharp(image).extract({left,top,width:cropWidth,height:cropHeight}).resize(128,128,{fit:"fill"});
  const [{data:gray},{data:rgb,info}]=await Promise.all([
    base.clone().blur(.7).greyscale().raw().toBuffer({resolveWithObject:true}),
    base.clone().removeAlpha().raw().toBuffer({resolveWithObject:true}),
  ]);
  const palette=measuredPalette(new Uint8Array(rgb),info.width,info.height,info.channels,4).palette;
  const measured=measurePattern(new Uint8Array(gray),128,128,palette);
  const observed=measured.orientation as RenderPatternOrientation;

  // Final renders are fixed full-body catalogue frames. Use a deliberately
  // conservative 88% visible-body anchor and broad tolerances so this guard
  // catches gross AI pattern rescaling without pretending to be tailoring CAD.
  const hasHeight=bodyHeightCm!==null && Number.isFinite(bodyHeightCm) && bodyHeightCm>0;
  const mmPerImagePx=hasHeight ? bodyHeightCm*10/(height*.88) : null;
  const axisCropPx=observed==="horizontal"?cropHeight:cropWidth;
  const resizeToImageScale=axisCropPx/128;
  // Autocorrelation can choose a harmonic (for example 3x the true
  // stripe repeat) when several lags correlate almost perfectly. For a
  // directional stripe, two alternating average runs recover the fundamental
  // repeat more reliably while keeping the same measurement basis used by the
  // flat-swatch analyzer.
  const observedRepeatPx=(observed==="vertical"||observed==="horizontal") && measured.stripeWidthPx
    ? measured.stripeWidthPx*2
    : measured.repeatPeriodPx;
  const observedRepeatMm=mmPerImagePx!==null && observedRepeatPx
    ? Math.round(observedRepeatPx*resizeToImageScale*mmPerImagePx*10)/10
    : null;
  const observedStripeWidthMm=mmPerImagePx!==null && measured.stripeWidthPx
    ? Math.round(measured.stripeWidthPx*resizeToImageScale*mmPerImagePx*10)/10
    : null;

  return {
    expectedOrientation,
    observedOrientation:observed,
    expectedContrastDeltaE,
    observedContrastDeltaE:measured.contrastDeltaE,
    expectedRepeatMm,
    observedRepeatMm,
    expectedStripeWidthMm,
    observedStripeWidthMm,
    status:patternStatus(
      expectedOrientation,
      observed,
      expectedRepeatMm,
      observedRepeatMm,
      expectedStripeWidthMm,
      observedStripeWidthMm,
    ),
  };
}

export async function compareRenderMeasuredPatterns(
  image:Buffer|Uint8Array,
  view:RenderFidelityView,
  targets:{
    shirtOrientation:RenderPatternOrientation|null;
    pantOrientation:RenderPatternOrientation|null;
    shirtContrastDeltaE:number|null;
    pantContrastDeltaE:number|null;
    shirtRepeatMm?:number|null;
    pantRepeatMm?:number|null;
    shirtStripeWidthMm?:number|null;
    pantStripeWidthMm?:number|null;
    bodyHeightCm?:number|null;
  },
):Promise<RenderPatternFidelityResult> {
  const boxes=VIEW_BOXES[view]||VIEW_BOXES.front;
  const bodyHeightCm=targets.bodyHeightCm??null;
  const [shirt,pant]=await Promise.all([
    samplePatternRegion(
      image,boxes.shirt,targets.shirtOrientation,targets.shirtContrastDeltaE,
      targets.shirtRepeatMm??null,targets.shirtStripeWidthMm??null,bodyHeightCm,
    ),
    samplePatternRegion(
      image,boxes.pant,targets.pantOrientation,targets.pantContrastDeltaE,
      targets.pantRepeatMm??null,targets.pantStripeWidthMm??null,bodyHeightCm,
    ),
  ]);
  return {shirt,pant};
}

export function worstRenderPatternStatus(result:RenderPatternFidelityResult) {
  const rank={unavailable:0,strong:1,review:2,weak:3} as const;
  const available=[result.shirt.status,result.pant.status].filter((status)=>status!=="unavailable");
  if(!available.length) return "unavailable" as const;
  return available.sort((a,b)=>rank[b]-rank[a])[0] as "strong"|"review"|"weak";
}

export function worstRenderColorStatus(result:RenderColorFidelityResult) {
  const rank={unavailable:0,strong:1,review:2,weak:3} as const;
  const available=[result.shirt.status,result.pant.status].filter((status)=>status!=="unavailable");
  if(!available.length) return "unavailable" as const;
  return available.sort((a,b)=>rank[b]-rank[a])[0] as "strong"|"review"|"weak";
}
