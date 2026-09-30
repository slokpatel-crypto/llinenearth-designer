import sharp from "sharp";
import { measuredPalette } from "../fabric-measurement-core.ts";
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

export function worstRenderColorStatus(result:RenderColorFidelityResult) {
  const rank={unavailable:0,strong:1,review:2,weak:3} as const;
  const available=[result.shirt.status,result.pant.status].filter((status)=>status!=="unavailable");
  if(!available.length) return "unavailable" as const;
  return available.sort((a,b)=>rank[b]-rank[a])[0] as "strong"|"review"|"weak";
}
