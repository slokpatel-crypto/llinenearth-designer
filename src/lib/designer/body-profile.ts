import type { MeasurementProfile } from "@/lib/measurements";

export type BodyBuild="slim"|"regular"|"athletic"|"broad";
export type SkinToneId="warm_light"|"medium"|"tan"|"deep";

export type BodyPreviewProfile={
  version:1;
  build:BodyBuild;
  heightCm:number;
  skinTone:SkinToneId;
  source:"default"|"measurements"|"manual";
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

export function bodyProfileFromMeasurements(
  measurements?:MeasurementProfile|null,
  current:BodyPreviewProfile=DEFAULT_BODY_PREVIEW_PROFILE,
):BodyPreviewProfile {
  if(!measurements) return current;
  const chest=valid(measurements.shirt.chest)?measurements.shirt.chest as number:null;
  const waist=valid(measurements.shirt.waist)?measurements.shirt.waist as number:null;
  const seat=valid(measurements.pants.seat)?measurements.pants.seat as number:null;
  if(!chest && !waist && !seat) return current;

  let build:BodyBuild="regular";
  if(chest && waist) {
    const ratio=waist/chest;
    if(chest<94 && waist<84) build="slim";
    else if(ratio<=.82 && chest>=98) build="athletic";
    else if(chest>=112 || waist>=104 || (seat!==null && seat>=112)) build="broad";
  } else if((chest&&chest>=112)||(waist&&waist>=104)||(seat&&seat>=112)) {
    build="broad";
  }

  return {...current,build,source:"measurements"};
}

export function validBodyPreviewProfile(value:unknown):value is BodyPreviewProfile {
  if(!value || typeof value!=="object") return false;
  const profile=value as Partial<BodyPreviewProfile>;
  return profile.version===1
    && ["slim","regular","athletic","broad"].includes(String(profile.build))
    && Number.isFinite(profile.heightCm)
    && Number(profile.heightCm)>=155
    && Number(profile.heightCm)<=200
    && ["warm_light","medium","tan","deep"].includes(String(profile.skinTone))
    && ["default","measurements","manual"].includes(String(profile.source));
}

export function bodyProfileRenderSummary(profile:BodyPreviewProfile) {
  return `${profile.build} build, approximately ${profile.heightCm} cm tall, ${BODY_SKIN_TONES[profile.skinTone].label.toLowerCase()} exposed skin tone`;
}
