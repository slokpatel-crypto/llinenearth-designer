import type { StyleSpecV2 } from "./style-spec-v2.ts";
import { GARMENT_OPTION_LIBRARY, optionById } from "./options/library.ts";
import type { RenderSupport } from "./options/types.ts";
import type { BodyBuild, BodyPreviewProfile } from "./body-profile.ts";

export type ModelBuild=BodyBuild;
export type PreviewView="front"|"back";
export type FabricRenderAsset={
  tileUrl:string;
  placeholderUrl:string;
  tileWidthPx:number;
  tileHeightPx:number;
  repeatDetected:boolean;
  repeatPeriodPx:number|null;
  orientation:"none"|"vertical"|"horizontal"|"grid"|"uncertain";
  dominantHex:string;
  scaleApproximate:boolean;
  tileRealWidthMm:number|null;
  renderAssetVersion:string;
};
export type PartGeometry={id:string;path:string;fabric:"shirt"|"pant";rotationDeg:number;patternMatch:"matched"|"unmatched"};
export type ModelGeometry={
  parts:PartGeometry[];
  seams:string[];
  collarPaths:string[];
  pocketPath:string|null;
  cuffPaths:string[];
  waistbandPath:string;
  neckPath:string;
  headPath:string;
  handPaths:string[];
  shoePaths:string[];
  shirtHemY:number;
  waistY:number;
  heightScale:number;
};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const n=(value:unknown,fallback:number)=>typeof value==="number"&&Number.isFinite(value)?value:fallback;
const param=(id:string,key:string,fallback:number)=>n(optionById(id)?.parameters[key],fallback);

/** A construction drawing, never a cutting pattern or physical fit simulation. */
export function modelGeometry(spec:StyleSpecV2,view:PreviewView="front",body:ModelBuild|BodyPreviewProfile="regular"):ModelGeometry {
  const build:ModelBuild=typeof body==="string" ? body : body.build;
  const heightCm=typeof body==="string" ? 178 : body.heightCm;
  const heightScale=clamp(heightCm/178,.92,1.08);
  const buildDelta={slim:-8,regular:0,athletic:7,broad:16}[build];
  const ease=param(spec.shirt.fit,"chestEaseCm",spec.shirt.fit==="relaxed_fit"?20:14);
  const bodyHalf=clamp(84+(ease-14)*1.3+buildDelta,70,120);
  const shoulder=clamp(86+buildDelta*.55,76,101);
  const waistY=spec.pant.rise==="extra_high_rise"?410:spec.pant.rise==="high_rise"?428:spec.pant.rise==="low_rise"?468:448;
  const tucked=spec.shirt.wear==="tucked";
  const lengthDelta=param(spec.shirt.length,"lengthDeltaCm",0)*2.4;
  const shirtHemY=tucked?waistY+12:clamp(493+lengthDelta,460,535);
  const hemHalf=bodyHalf+(spec.shirt.fit==="athletic_taper"?-16:spec.shirt.fit==="boxy_oversized"?8:-4);
  const straightHem=spec.shirt.hem==="straight_flat_hem"||spec.shirt.hem==="side_vents_hem";
  const bodyPath=`M ${320-shoulder} 192 Q 274 169 296 169 L 320 198 L 344 169 Q 366 169 ${320+shoulder} 192 L ${320+bodyHalf} 323 Q ${320+hemHalf} 424 ${320+hemHalf} ${shirtHemY-10} ${straightHem?`L ${320+hemHalf} ${shirtHemY} L ${320-hemHalf} ${shirtHemY}`:`Q 320 ${shirtHemY+18} ${320-hemHalf} ${shirtHemY-10}`} Q ${320-hemHalf} 424 ${320-bodyHalf} 323 Z`;
  const shortSleeve=spec.shirt.sleeve==="half_sleeve"||spec.shirt.type==="short_sleeve_shirt";
  const sleeveBottom=shortSleeve?293:429;
  const sleeves=[
    `M ${320-shoulder} 192 Q 212 192 201 235 L ${shortSleeve?188:173} ${sleeveBottom-12} Q 187 ${sleeveBottom+2} 219 ${sleeveBottom} L 259 260 Z`,
    `M ${320+shoulder} 192 Q 428 192 439 235 L ${shortSleeve?452:467} ${sleeveBottom-12} Q 453 ${sleeveBottom+2} 421 ${sleeveBottom} L 381 260 Z`,
  ];
  const hemPct=param(spec.pant.fit,"hemPctSeat",52);
  const thighPct=param(spec.pant.fit,"thighPctSeat",68);
  const kneePct=param(spec.pant.fit,"kneePctSeat",58);
  const thigh=clamp(thighPct*.82,47,76),knee=clamp(kneePct*.75,33,68),hem=clamp(hemPct*.72,27,67);
  const bottomY=spec.pant.break==="cropped_above_ankle"||spec.pant.hem==="cropped_above_ankle_hem"?836
    : spec.pant.break==="full_break"||spec.pant.break==="stacked_break"?912:886;
  const leftLeg=`M 258 ${waistY+28} L 318 ${waistY+55} L 314 560 Q 312 700 315 ${bottomY} L ${315-hem*2} ${bottomY} Q ${312-knee*2} 700 ${320-thigh*2+13} 535 Z`;
  const rightLeg=`M 382 ${waistY+28} L 322 ${waistY+55} L 326 560 Q 328 700 325 ${bottomY} L ${325+hem*2} ${bottomY} Q ${328+knee*2} 700 ${320+thigh*2-13} 535 Z`;
  const pelvis=`M 258 ${waistY+24} Q 320 ${waistY+18} 382 ${waistY+24} L 389 530 Q 358 535 340 558 Q 320 580 300 558 Q 282 535 251 530 Z`;
  const waistPath=`M 254 ${waistY} Q 320 ${waistY-9} 386 ${waistY} L 383 ${waistY+34} Q 320 ${waistY+30} 257 ${waistY+34} Z`;
  const parts:PartGeometry[]=[
    {id:"seat-and-fly",path:pelvis,fabric:"pant",rotationDeg:0,patternMatch:"matched"},
    {id:"left-leg",path:leftLeg,fabric:"pant",rotationDeg:0,patternMatch:"unmatched"},
    {id:"right-leg",path:rightLeg,fabric:"pant",rotationDeg:0,patternMatch:"unmatched"},
    {id:"left-sleeve",path:sleeves[0],fabric:"shirt",rotationDeg:0,patternMatch:"matched"},
    {id:"right-sleeve",path:sleeves[1],fabric:"shirt",rotationDeg:0,patternMatch:"matched"},
    {id:"body",path:bodyPath,fabric:"shirt",rotationDeg:0,patternMatch:"matched"},
  ];
  if(tucked) parts.push({id:"waistband",path:waistPath,fabric:"pant",rotationDeg:0,patternMatch:"matched"});
  else parts.splice(3,0,{id:"waistband",path:waistPath,fabric:"pant",rotationDeg:0,patternMatch:"matched"});

  const band=spec.shirt.collar==="mandarin_band_collar"||spec.shirt.collar==="cuban_camp_collar"||spec.shirt.type==="band_collar_shirt";
  const spread=spec.shirt.collar==="cutaway_collar"?62:spec.shirt.collar==="spread_collar"?52:spec.shirt.collar==="cuban_camp_collar"?68:35;
  const point=spec.shirt.collar==="club_collar"?24:spec.shirt.collar==="wing_collar"?22:40;
  const collarPaths=band
    ? [`M 296 170 Q 320 187 344 170 L 345 191 Q 320 206 295 191 Z`]
    : [`M 296 170 L 320 198 L ${320-spread} ${180+point} Q 286 200 282 187 Z`,
      `M 344 170 L 320 198 L ${320+spread} ${180+point} Q 354 200 358 187 Z`];
  const cuffs=shortSleeve?[]:[
    `M 175 408 L 219 410 L 218 436 Q 196 439 171 432 Z`,
    `M 421 410 L 465 408 L 469 432 Q 444 439 422 436 Z`,
  ];
  const pocketPath=spec.shirt.pocket==="no_pocket"?null:`M 345 267 L 378 269 L 376 307 Q 361 316 346 307 Z`;
  const seams=view==="front"
    ? [`M 320 203 L 320 ${Math.min(shirtHemY,waistY)}`,`M 320 ${waistY+33} L 320 516`]
    : [`M 243 247 Q 320 258 397 247`,`M 320 257 L 320 ${shirtHemY-18}`];
  if(view==="back"&&spec.shirt.back==="box_pleat_back") seams.push(`M 312 257 L 312 365 M 328 257 L 328 365`);
  if(view==="front"&&spec.pant.pleat!=="flat_front") seams.push(`M 282 ${waistY+28} L 287 548 M 358 ${waistY+28} L 353 548`);
  return {
    parts,seams,collarPaths,pocketPath,cuffPaths:cuffs,waistbandPath:waistPath,
    neckPath:"M 298 124 L 296 169 Q 320 190 344 169 L 342 124 Z",
    headPath:"M 273 71 Q 271 27 320 25 Q 369 27 367 71 L 358 112 Q 344 139 320 140 Q 296 139 282 112 Z",
    handPaths:[`M 172 ${sleeveBottom+1} L 216 ${sleeveBottom+3} L 212 ${sleeveBottom+47} Q 187 ${sleeveBottom+67} 175 ${sleeveBottom+37} Z`,`M 424 ${sleeveBottom+3} L 468 ${sleeveBottom+1} L 465 ${sleeveBottom+37} Q 453 ${sleeveBottom+67} 428 ${sleeveBottom+47} Z`],
    shoePaths:[`M ${315-hem*2-3} ${bottomY-2} L 313 ${bottomY-2} L 313 926 Q ${315-hem*2-32} 939 ${315-hem*2-42} 923 Z`,`M 327 ${bottomY-2} L ${325+hem*2+3} ${bottomY-2} L ${325+hem*2+42} 923 Q ${325+hem*2+32} 939 327 926 Z`],
    shirtHemY,waistY,heightScale,
  };
}

const drawnGroups=new Set(["shirt.type","shirt.collar","shirt.cuff","shirt.placket","shirt.pocket","shirt.sleeve","shirt.fit","shirt.length","shirt.hem","shirt.back","pant.type","pant.fit","pant.rise","pant.waistband","pant.pleat","pant.hem","pant.break"]);
export function liveCapabilities(_spec:StyleSpecV2):Record<string,RenderSupport> {
  return Object.fromEntries(GARMENT_OPTION_LIBRARY.map((option)=>[
    option.id,drawnGroups.has(option.group)?"approximate":"none",
  ]));
}
