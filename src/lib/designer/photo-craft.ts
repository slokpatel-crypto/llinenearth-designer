import type { DesignerFabric, DesignerStyle } from "./engine.ts";
import type { CreativeZone } from "./creative-engine.ts";
import { resolveCraftFabrics, validCreativeCraft, type CreativeCraftSpec } from "./creative-spec.ts";

export type PhotoCraftArea={x:number;y:number;width:number;height:number};
export type PhotoCraftZone={status:"approximate"|"spec_only";region:"shirt"|"collar"|"cuff"|"pant";areas:PhotoCraftArea[];reason:string};
const area=(x:number,y:number,width:number,height:number):PhotoCraftArea=>({x,y,width,height});

/** Fixed coordinates on existing studio photographs, never mm-to-pixel evidence. */
export function photoCraftZone(zone:CreativeZone,style:Pick<DesignerStyle,"shirtWear"|"trouser">):PhotoCraftZone {
  const tucked=style.shirtWear==="Tucked";
  const shown=(region:PhotoCraftZone["region"],areas:PhotoCraftArea[]):PhotoCraftZone=>({status:"approximate",region,areas,reason:"Proposed placement on the existing photographed cut; sample dimensions and cloth behaviour remain unverified."});
  const hidden=(region:PhotoCraftZone["region"],reason:string):PhotoCraftZone=>({status:"spec_only",region,areas:[],reason});
  switch(zone){
    case "collar":return shown("collar",[area(446,173,48,78),area(530,173,53,78)]);
    case "cuff":return shown("cuff",[area(285,tucked?654:660,54,46),area(677,656,56,48)]);
    case "placket":return shown("shirt",[area(501,264,20,tucked?273:426)]);
    case "shirt-body":return shown("shirt",[area(389,270,238,tucked?267:419)]);
    case "pocket":return hidden("shirt","The studio shirt has no photographed pocket. Pocket craft remains in the recipe and placement illustration.");
    case "waistband":return tucked?shown("pant",[area(385,550,244,24)]):hidden("pant","The untucked shirt hides the waistband; its craft remains in the recipe.");
    case "pleat":return !tucked?hidden("pant","The untucked shirt covers the top pleats; their craft remains in the recipe."):
      !["Pleated Trouser","Wide-leg / Relaxed Drape Trouser"].includes(style.trouser)?hidden("pant","This selected trouser has no pleat to carry the proposed craft."):
      shown("pant",[area(421,580,18,114),area(578,580,18,114)]);
    case "trouser-leg":return shown("pant",[area(578,800,40,490)]);
  }
}

export function photoCraftAreaPath(areas:PhotoCraftArea[]):string {
  return areas.map(a=>`M ${a.x} ${a.y} h ${a.width} v ${a.height} h ${-a.width} Z`).join(" ");
}

export function resolvePhotoCraft(spec:unknown,fabrics:DesignerFabric[],shirtId:string,pantId:string) {
  if(!validCreativeCraft(spec))return null;
  const craft=resolveCraftFabrics(spec,fabrics,shirtId,pantId);
  if(!craft)return null;
  return {craft,panelFabric:craft.panels.length?fabrics.find(f=>f.id===craft.panels[0].fabric.id):undefined};
}

/** Bounded illustration grid. Recipe mm are relative design inputs, not calibration. */
export function photoCraftMarks(decoration:NonNullable<CreativeCraftSpec["decoration"]>,areas:PhotoCraftArea[]) {
  const step=Math.max(16,Math.min(75,decoration.repeatMm*1.25));
  const size=Math.max(6,step*.72*Math.sqrt(decoration.coverage/35));
  const marks:Array<{x:number;y:number;size:number}>=[];
  for(const a of areas){
    for(let y=a.y+Math.min(step/2,a.height/2);y<a.y+a.height;y+=step){
      for(let x=a.x+Math.min(step/2,a.width/2);x<a.x+a.width;x+=step){
        if(marks.length>=768)return marks;
        marks.push({x,y,size});
      }
    }
  }
  return marks;
}

export const PHOTO_CRAFT_MOTIF_PATHS={
  line:"M 0 -7 L 0 7",
  leaf:"M -6 6 Q -7 -7 6 -6 Q 7 7 -6 6 M -6 6 L 5 -5",
  diamond:"M 0 -7 L 7 0 L 0 7 L -7 0 Z",
  wave:"M -8 0 Q -4 -8 0 0 T 8 0",
} as const;
