import type { MeasurementProfile } from "../measurements.ts";

export type BodyBuild="slim"|"regular"|"athletic"|"broad";
export type SkinToneId="warm_light"|"medium"|"tan"|"deep";

export type BodySilhouetteProfile={
  shoulderScale:number;
  chestScale:number;
  waistScale:number;
  seatScale:number;
  thighScale:number;
  legLengthScale:number;
  evidenceCount:number;
};

export type BodyPreviewProfile={
  version:1;
  build:BodyBuild;
  heightCm:number;
  skinTone:SkinToneId;
  source:"default"|"measurements"|"manual";
  /**
   * Privacy-preserving preview proportions derived locally from saved tape
   * measurements. Raw body measurements are not persisted in this object.
   */
  silhouette?:BodySilhouetteProfile;
};

export const BODY_HEIGHT_OPTIONS=[
  {id:165,label:"165 cm / 5′5″",heightCm:165},
  {id:173,label:"173 cm / 5′8″",heightCm:173},
  {id:178,label:"178 cm / 5′10″",heightCm:178},
  {id:183,label:"183 cm / 6′0″",heightCm:183},
  {id:190,label:"190 cm / 6′3″",heightCm:190},
] as const;

export const BODY_SKIN_TONES:Record<SkinToneId,{label:string;light:string;mid:string;deep:string}>={
  warm_light:{label:"Warm light",light:"#e6cbb6",mid:"#c6a48c",deep:"#9b7865"},
  medium:{label:"Medium",light:"#d4ae91",mid:"#ad8067",deep:"#7f5847"},
  tan:{label:"Tan",light:"#c59673",mid:"#986849",deep:"#684632"},
  deep:{label:"Deep",light:"#9a674c",mid:"#6e4432",deep:"#432a22"},
};

export const DEFAULT_BODY_PREVIEW_PROFILE:BodyPreviewProfile={
  version:1,
  build:"regular",
  heightCm:178,
  skinTone:"medium",
  source:"default",
};

function valid(value:unknown) {
  return typeof value==="number" && Number.isFinite(value) && value>0;
}
function clamp(value:number,min:number,max:number) {
  return Math.max(min,Math.min(max,value));
}
function ratio(value:number|null,reference:number,min=.84,max=1.18) {
  return value===null ? 1 : clamp(value/reference,min,max);
}

function normalizedSilhouette(measurements:MeasurementProfile):BodySilhouetteProfile|undefined {
  const shoulder=valid(measurements.shirt.shoulder)?measurements.shirt.shoulder as number:null;
  const chest=valid(measurements.shirt.chest)?measurements.shirt.chest as number:null;
  const waist=valid(measurements.shirt.waist)?measurements.shirt.waist as number:null;
  const seat=valid(measurements.pants.seat)?measurements.pants.seat as number:null;
  const thigh=valid(measurements.pants.thigh)?measurements.pants.thigh as number:null;
  const inseam=valid(measurements.pants.inseam)?measurements.pants.inseam as number:null;
  const evidenceCount=[shoulder,chest,waist,seat,thigh,inseam].filter((value)=>value!==null).length;
  if(!evidenceCount) return undefined;
  return {
    shoulderScale:ratio(shoulder,46,.86,1.16),
    chestScale:ratio(chest,100,.86,1.18),
    waistScale:ratio(waist,86,.82,1.22),
    seatScale:ratio(seat,100,.86,1.20),
    thighScale:ratio(thigh,58,.86,1.22),
    legLengthScale:ratio(inseam,80,.88,1.14),
    evidenceCount,
  };
}

export function bodyProfileFromMeasurements(
  measurements?:MeasurementProfile|null,
  current:BodyPreviewProfile=DEFAULT_BODY_PREVIEW_PROFILE,
):BodyPreviewProfile {
  if(!measurements) return current;
  const chest=valid(measurements.shirt.chest)?measurements.shirt.chest as number:null;
  const waist=valid(measurements.shirt.waist)?measurements.shirt.waist as number:null;
  const seat=valid(measurements.pants.seat)?measurements.pants.seat as number:null;
  const silhouette=normalizedSilhouette(measurements);
  if(!chest && !waist && !seat && !silhouette) return current;

  let build:BodyBuild="regular";
  if(chest && waist) {
    const ratioValue=waist/chest;
    if(chest<94 && waist<84) build="slim";
    else if(ratioValue<=.82 && chest>=98) build="athletic";
    else if(chest>=112 || waist>=104 || (seat!==null && seat>=112)) build="broad";
  } else if((chest&&chest>=112)||(waist&&waist>=104)||(seat&&seat>=112)) {
    build="broad";
  }

  return {...current,build,source:"measurements",...(silhouette?{silhouette}: {})};
}

function validScale(value:unknown,min=.75,max=1.3) {
  return typeof value==="number" && Number.isFinite(value) && value>=min && value<=max;
}

export function validBodyPreviewProfile(value:unknown):value is BodyPreviewProfile {
  if(!value || typeof value!=="object") return false;
  const profile=value as Partial<BodyPreviewProfile>;
  const silhouette=profile.silhouette;
  const silhouetteValid=!silhouette || (
    validScale(silhouette.shoulderScale)
    && validScale(silhouette.chestScale)
    && validScale(silhouette.waistScale)
    && validScale(silhouette.seatScale)
    && validScale(silhouette.thighScale)
    && validScale(silhouette.legLengthScale)
    && Number.isInteger(silhouette.evidenceCount)
    && silhouette.evidenceCount>=1
    && silhouette.evidenceCount<=6
  );
  return profile.version===1
    && ["slim","regular","athletic","broad"].includes(String(profile.build))
    && Number.isFinite(profile.heightCm)
    && Number(profile.heightCm)>=155
    && Number(profile.heightCm)<=200
    && ["warm_light","medium","tan","deep"].includes(String(profile.skinTone))
    && ["default","measurements","manual"].includes(String(profile.source))
    && silhouetteValid;
}

function scaleWord(value:number|undefined,low:string,high:string) {
  if(value===undefined || Math.abs(value-1)<.055) return "balanced";
  return value<1?low:high;
}

export function bodyProfileRenderSummary(profile:BodyPreviewProfile) {
  const base=`${profile.build} build, approximately ${profile.heightCm} cm tall, ${BODY_SKIN_TONES[profile.skinTone].label.toLowerCase()} exposed skin tone`;
  if(!profile.silhouette || profile.source!=="measurements") return base;
  const silhouette=[
    `${scaleWord(profile.silhouette.shoulderScale,"narrower","broader")} shoulders`,
    `${scaleWord(profile.silhouette.waistScale,"trimmer","fuller")} waist`,
    `${scaleWord(profile.silhouette.seatScale,"slimmer","fuller")} seat`,
    `${scaleWord(profile.silhouette.legLengthScale,"shorter","longer")} leg proportion`,
  ].join(", ");
  return `${base}; measurement-derived preview proportions: ${silhouette}`;
}
