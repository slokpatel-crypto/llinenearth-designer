import type { DesignerFabric } from "@/lib/designer/engine";
import type { CreativeDirection, CreativeZone } from "@/lib/designer/creative-engine";

export const CRAFT_VERSION="linen-earth-creative-craft-v1" as const;
export const CRAFT_ZONES=["collar","cuff","placket","shirt-body","pocket","waistband","pleat","trouser-leg"] as const;
export const CRAFT_MOTIFS=["line","leaf","diamond","wave"] as const;
export const CRAFT_THREAD_COLOURS={navy:"#182E4A",blue:"#3E76AB",green:"#3D624F",red:"#9D383E",black:"#202020",white:"#F5F2E9",gold:"#B39B5A",copper:"#A86C46",ivory:"#E8DDC6",silver:"#B0B3B2"} as const;
export const CRAFT_STITCHES=["running","chain","satin"] as const;
export const CRAFT_SURFACES=["auto","plain","thread","embroidery"] as const;
export const CRAFT_NOVELTIES=["auto","subtle","balanced","bold"] as const;
export type CraftMotif=typeof CRAFT_MOTIFS[number];
export type CraftSurface=typeof CRAFT_SURFACES[number];
export type CraftPreferences={enabled:boolean;novelty:typeof CRAFT_NOVELTIES[number];surface:CraftSurface;motif:"auto"|CraftMotif};
export const DEFAULT_CRAFT_PREFERENCES:CraftPreferences={enabled:false,novelty:"auto",surface:"auto",motif:"auto"};
export type CraftFabric={id:string;name:string;image:string;hex:string;source:string};
export type CreativeCraftSpec={
  version:typeof CRAFT_VERSION;
  brief:string;
  base:{shirtId:string;pantId:string};
  panels:Array<{zone:CreativeZone;fabric:CraftFabric}>;
  decoration:null|{zone:CreativeZone;technique:"thread"|"embroidery";motif:CraftMotif;stitch:typeof CRAFT_STITCHES[number];colour:string;repeatMm:number;threadWidthMm:number;coverage:number};
  dimensionBasis:"proposed_sample_dimensions";
  checks:string[];
};
export type CreativeCraftRequest={brief:string;accentId:string;zone:CreativeZone;surface:CraftSurface;motif:"auto"|CraftMotif;novelty:typeof CRAFT_NOVELTIES[number];threadColour:string};
export const DEFAULT_CRAFT_REQUEST:CreativeCraftRequest={brief:"",accentId:"auto",zone:"cuff",surface:"auto",motif:"auto",novelty:"auto",threadColour:"#D6C5A2"};
function obj(value:unknown):value is Record<string,unknown>{return Boolean(value&&typeof value==="object"&&!Array.isArray(value));}
export function validCraftPreferences(value:unknown):value is CraftPreferences {
  return obj(value)&&typeof value.enabled==="boolean"&&CRAFT_NOVELTIES.includes(value.novelty as never)&&CRAFT_SURFACES.includes(value.surface as never)&&["auto",...CRAFT_MOTIFS].includes(value.motif as string);
}
export function validCraftRequest(value:unknown):value is CreativeCraftRequest {
  return obj(value)&&typeof value.brief==="string"&&value.brief.length<=900&&typeof value.accentId==="string"&&value.accentId.length<=160&&CRAFT_ZONES.includes(value.zone as never)&&CRAFT_SURFACES.includes(value.surface as never)&&["auto",...CRAFT_MOTIFS].includes(value.motif as string)&&CRAFT_NOVELTIES.includes(value.novelty as never)&&/^#[0-9a-f]{6}$/i.test(String(value.threadColour));
}
export function validCreativeCraft(value:unknown):value is CreativeCraftSpec {
  if(!obj(value)||value.version!==CRAFT_VERSION||!obj(value.base)||typeof value.base.shirtId!=="string"||typeof value.base.pantId!=="string"||typeof value.brief!=="string"||value.brief.length>900||value.dimensionBasis!=="proposed_sample_dimensions"||!Array.isArray(value.panels)||value.panels.length>1||!Array.isArray(value.checks)||value.checks.length>8||value.checks.some(v=>typeof v!=="string"||v.length>400))return false;
  if(value.panels.some(p=>{if(!obj(p)||!CRAFT_ZONES.includes(p.zone as never)||!obj(p.fabric))return true;const fabric=p.fabric;return ["id","name","image","hex","source"].some(k=>typeof fabric[k]!=="string"||String(fabric[k]).length>400)||!/^#[0-9a-f]{6}$/i.test(String(fabric.hex));}))return false;
  if(value.decoration===null)return true;
  const d=value.decoration;
  return obj(d)&&CRAFT_ZONES.includes(d.zone as never)&&["thread","embroidery"].includes(String(d.technique))&&CRAFT_MOTIFS.includes(d.motif as never)&&CRAFT_STITCHES.includes(d.stitch as never)&&/^#[0-9a-f]{6}$/i.test(String(d.colour))&&typeof d.repeatMm==="number"&&Number.isFinite(d.repeatMm)&&d.repeatMm>=4&&d.repeatMm<=60&&typeof d.threadWidthMm==="number"&&Number.isFinite(d.threadWidthMm)&&d.threadWidthMm>=.2&&d.threadWidthMm<=2&&typeof d.coverage==="number"&&Number.isFinite(d.coverage)&&d.coverage>=1&&d.coverage<=35;
}
export function craftClarifications(request:CreativeCraftRequest):string[] {
  const text=request.brief.toLowerCase(), questions:string[]=[];
  if(/\b(bead|beaded|sequin|lace|logo|portrait|animal|peacock|paisley|print|dye|jacquard)\b/.test(text))questions.push("This studio supports line, leaf, diamond and wave thread/embroidery placements. Choose one, or send the requested artwork to the atelier for a custom sample.");
  if(/\b(exact|perfect|identical)\b.*\b(drape|texture|fabric)\b/.test(text))questions.push("Exact cloth behaviour needs your fabric references and a physical sample; this is a placement proposal.");
  return questions;
}
export function resolveCraftRequest(request:CreativeCraftRequest,preferences=DEFAULT_CRAFT_PREFERENCES):CreativeCraftRequest {
  const text=request.brief.toLowerCase();
  const explicitZone=CRAFT_ZONES.find(z=>text.includes(z.replace("shirt-body","body").replace("trouser-leg","leg")));
  const motif:CraftMotif|undefined=/\b(leaf|leaves|floral|flower|botanical)\b/.test(text)?"leaf":/\b(diamond|geometric)\b/.test(text)?"diamond":/\b(wave|waves)\b/.test(text)?"wave":/\b(line|stripe|stripes)\b/.test(text)?"line":undefined;
  const surface:CraftSurface|undefined=/\b(no|without)\s+(embroidery|thread|decoration)|\bplain\b/.test(text)?"plain":/embroider/.test(text)?"embroidery":/\b(thread|stitch|stitched)\b/.test(text)?"thread":undefined;
  const novelty=/\b(subtle|minimal|quiet)\b/.test(text)?"subtle":/\b(bold|statement|dramatic)\b/.test(text)?"bold":undefined;
  const colourNames=Object.keys(CRAFT_THREAD_COLOURS).join("|"),colourMatch=text.match(new RegExp(`\\b(${colourNames})\\s+(?:thread|embroidery|stitch)`))||text.match(new RegExp(`(?:thread|embroidery|stitch)\\s+(?:in\\s+)?(${colourNames})\\b`));
  const threadColour=colourMatch?CRAFT_THREAD_COLOURS[colourMatch[1] as keyof typeof CRAFT_THREAD_COLOURS]:request.threadColour;
  return {...request,threadColour,zone:explicitZone||request.zone,motif:motif||(request.motif!=="auto"?request.motif:preferences.enabled?preferences.motif:"auto"),surface:surface||(request.surface!=="auto"?request.surface:preferences.enabled?preferences.surface:"auto"),novelty:novelty||(request.novelty!=="auto"?request.novelty:preferences.enabled?preferences.novelty:"auto"),accentId:/\b(no|without)\s+(contrast|accent|panels?)\b/.test(text)?"":request.accentId};
}
export function attachCreativeCraft(directions:CreativeDirection[],request:CreativeCraftRequest,explicitAccent?:DesignerFabric,autoAccents:DesignerFabric[]=[]):CreativeDirection[] {
  return directions.map((direction,index)=>{
    const accent=explicitAccent||(request.accentId==="auto"&&index%3!==0?autoAccents[index%Math.max(1,autoAccents.length)]:undefined);
    const technique=request.surface==="plain"?null:request.surface==="auto"?(index%3===0?null:index%2?"thread":"embroidery"):request.surface;
    const subtle=request.novelty==="subtle", bold=request.novelty==="bold";
    const craft:CreativeCraftSpec={version:CRAFT_VERSION,brief:request.brief,base:{shirtId:direction.recommendation.shirt.id,pantId:direction.recommendation.pant.id},panels:accent?[{zone:request.zone,fabric:{id:accent.id,name:accent.name,image:accent.image,hex:accent.hex,source:accent.source}}]:[],decoration:technique?{zone:request.zone,technique,motif:request.motif==="auto"?CRAFT_MOTIFS[index%CRAFT_MOTIFS.length]:request.motif,stitch:technique==="thread"?"running":index%2?"chain":"satin",colour:request.threadColour,repeatMm:subtle?10:bold?32:18+index*2,threadWidthMm:technique==="thread"?.4:.8,coverage:subtle?6:bold?28:12+index*2}:null,dimensionBasis:"proposed_sample_dimensions",checks:["Sample panel shrinkage, seam strength and colourfastness before cutting.","Approve thread tension, stabiliser and stitch density on this exact cloth.","Placement illustration does not establish physical drape or a cutting pattern."]};
    // Explicit surface briefs replace the generated surface treatments. Keep the
    // established silhouette critic, with a separate mandatory sample gate.
    const treatments=request.surface!=="auto"?direction.treatments.filter(t=>!/pattern|stripe|embroid|stitched|relief|cord|surface/i.test(`${t.label} ${t.instruction}`)):direction.treatments;
    const additions=[...(accent?[{id:"craft-panel",zone:request.zone,label:`${accent.name} panel`,instruction:`Use catalogue fabric ${accent.id} on ${request.zone}; sample differential shrinkage before cutting.`,visualPurpose:"A deliberate material counterpoint",intensity:bold?70:35,buildability:"atelier" as const}]:[]),...(craft.decoration?[{id:"craft-decoration",zone:request.zone,label:`${craft.decoration.motif} ${technique}`,instruction:craftDecorationInstruction(craft),visualPurpose:"A controlled focal craft detail",intensity:craft.decoration.coverage*2,buildability:"atelier" as const}]:[])];
    const hash=Array.from(JSON.stringify(craft)).reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261).toString(16);
    return {...direction,id:direction.id+":craft-"+hash,craft,treatments:[...additions,...treatments].slice(0,8),...(request.surface!=="auto"?{pattern:undefined}:{}),refinement:[...direction.refinement,"Craft dimensions are proposed and require a cloth sample."],visualSummary:[...direction.visualSummary,craftDecorationInstruction(craft)]};
  });
}
export function craftDecorationInstruction(spec:CreativeCraftSpec):string {
  const d=spec.decoration;
  return d?`${d.technique}: ${d.motif} motif using ${d.stitch} stitch on ${d.zone}, ${d.colour} thread, proposed repeat ${d.repeatMm} mm, thread width ${d.threadWidthMm} mm and ${d.coverage}% zone coverage.`:"No added thread or embroidery.";
}
export function resolveCraftFabrics(spec:CreativeCraftSpec,fabrics:DesignerFabric[],shirtId:string,pantId:string):CreativeCraftSpec|null {
  if(spec.base.shirtId!==shirtId||spec.base.pantId!==pantId)return null;
  const panels:CreativeCraftSpec["panels"]=[];
  for(const panel of spec.panels){const fabric=fabrics.find(f=>f.id===panel.fabric.id),garment=["waistband","pleat","trouser-leg"].includes(panel.zone)?"pant":"shirt";
    if(!fabric||!fabric.allowedGarments.includes(garment as "shirt"|"pant"))return null;
    panels.push({zone:panel.zone,fabric:{id:fabric.id,name:fabric.name,image:fabric.image,hex:fabric.hex,source:fabric.source}});
  }
  return {...spec,panels};
}
export function reviseCreativeCraft(direction:CreativeDirection,reason:string):CreativeDirection {
  if(!direction.craft||reason==="render_mismatch")return direction;
  const craft=structuredClone(direction.craft), d=craft.decoration;
  if(d){if(reason==="too_busy"||reason==="visual_balance"){d.coverage=Math.max(1,Math.round(d.coverage*.6));d.repeatMm=Math.min(60,d.repeatMm+4);}else if(reason==="too_safe"){d.coverage=Math.min(35,d.coverage+7);}else if(reason==="pattern_detail"||reason==="originality"){d.motif=CRAFT_MOTIFS[(CRAFT_MOTIFS.indexOf(d.motif)+1)%CRAFT_MOTIFS.length];}else if(reason==="proportion"){d.repeatMm=Math.max(4,Math.round(d.repeatMm*.75));}}
  return {...direction,id:direction.id.replace(/:craft-r\d+$/, "")+":craft-r"+(direction.iteration+1),iteration:direction.iteration+1,craft,treatments:direction.treatments.map(t=>t.id==="craft-decoration"?{...t,label:`${d?.motif} ${d?.technique}`,instruction:craftDecorationInstruction(craft),intensity:(d?.coverage||0)*2}:t),refinement:[...direction.refinement,`Your ${reason.replaceAll("_"," ")} judgement revised the craft placement; cloth and cut preserved.`]};
}
