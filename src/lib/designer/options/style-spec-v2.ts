import type { DesignerStyle } from "../engine";
import { legacyOptionByLabel, optionById } from "./library.ts";

export type StyleSpecV2={
  styleSchemaVersion:2;
  shirt:{
    type:string;
    collar:string;
    collarFinish:string;
    cuff:string;
    placket:string;
    pocket:string;
    sleeve:string;
    fit:string;
    length:string;
    hem:string;
    back:string;
    wear:"Tucked"|"Untucked";
    button:string;
  };
  pant:{
    type:string;
    fit:string;
    rise:string;
    pleat:string;
    waistband:string;
    hem:string;
    break:string;
  };
  legacy:DesignerStyle;
};

function legacyId(group:Parameters<typeof legacyOptionByLabel>[0],label:string,fallback:string) {
  return legacyOptionByLabel(group,label)?.id || fallback;
}

function pantFitFromLegacy(typeId:string) {
  if(typeId==="wide_leg_relaxed_drape") return "wide_leg_drape";
  if(typeId==="pleated_trouser") return "pleated_straight";
  if(typeId==="cargo_trouser") return "cargo_utility";
  if(typeId==="jean_cut_suiting") return "jean_cut_suiting_fit";
  if(typeId==="cropped_ankle") return "straight_classic";
  return "straight_classic";
}

function pleatFromLegacy(typeId:string) {
  return typeId==="pleated_trouser"||typeId==="wide_leg_relaxed_drape" ? "single_pleat_reverse" : "flat_front";
}

export function fromLegacyStyle(style:DesignerStyle):StyleSpecV2 {
  const pantType=legacyId("pant.type",style.trouser,"formal_flat_front");
  const collar=legacyId("shirt.collar",style.collar,"point_standard_collar");
  return {
    styleSchemaVersion:2,
    shirt:{
      type:collar==="mandarin_band_collar" ? "band_collar_shirt" : "dress_shirt",
      collar,
      collarFinish:style.collarFinish,
      cuff:legacyId("shirt.cuff",style.cuff,"barrel_cuff_1_button"),
      placket:legacyId("shirt.placket",style.placket,"standard_visible_placket"),
      pocket:"no_pocket",
      sleeve:"full_sleeve",
      fit:legacyId("shirt.fit",style.shirtFit,"regular_classic_fit"),
      length:style.shirtWear==="Tucked"?"shirt_length_tuck":"shirt_length_regular",
      hem:"curved_shirttail",
      back:"plain_back",
      wear:style.shirtWear,
      button:legacyId("shirt.button",style.button,"plastic_resin"),
    },
    pant:{
      type:pantType,
      fit:pantFitFromLegacy(pantType),
      rise:legacyId("pant.rise",style.rise,"mid_rise"),
      pleat:pleatFromLegacy(pantType),
      waistband:legacyId("pant.waistband",style.waistband,"belt_loops"),
      hem:style.break==="Cropped / Above-ankle"?"cropped_above_ankle_hem":"plain_hem",
      break:legacyId("pant.break",style.break,"no_break"),
    },
    legacy:{...style},
  };
}

function legacyLabel(id:string,fallback:string) {
  return optionById(id)?.legacyLabel || fallback;
}

export function toLegacyStyle(spec:StyleSpecV2):DesignerStyle {
  return {
    collar:legacyLabel(spec.shirt.collar,spec.legacy.collar),
    collarFinish:spec.shirt.collarFinish || spec.legacy.collarFinish,
    cuff:legacyLabel(spec.shirt.cuff,spec.legacy.cuff),
    placket:legacyLabel(spec.shirt.placket,spec.legacy.placket),
    shirtFit:legacyLabel(spec.shirt.fit,spec.legacy.shirtFit),
    shirtWear:spec.shirt.wear,
    trouser:legacyLabel(spec.pant.type,spec.legacy.trouser),
    rise:legacyLabel(spec.pant.rise,spec.legacy.rise),
    waistband:legacyLabel(spec.pant.waistband,spec.legacy.waistband),
    break:legacyLabel(spec.pant.break,spec.legacy.break),
    button:legacyLabel(spec.shirt.button,spec.legacy.button),
  };
}

const LEGACY_STYLE_ORDER:readonly (keyof DesignerStyle)[]=[
  "collar","collarFinish","cuff","placket","shirtFit","shirtWear",
  "trouser","rise","waistband","break","button",
];

function fnv1a(input:string) {
  let hash=2166136261;
  for(let i=0;i<input.length;i+=1){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,"0").toUpperCase();
}

export function legacyStyleFingerprint(style:DesignerStyle) {
  const canonical=JSON.stringify(LEGACY_STYLE_ORDER.map((key)=>[key,style[key]]));
  return `LE-STYLE-${fnv1a(canonical)}`;
}

export function validateStyleSpecV2(spec:StyleSpecV2) {
  const errors:string[]=[];
  const checks:Array<[string,string,string]>=[
    ["shirt.type",spec.shirt.type,"shirt.type"],["shirt.collar",spec.shirt.collar,"shirt.collar"],
    ["shirt.cuff",spec.shirt.cuff,"shirt.cuff"],["shirt.placket",spec.shirt.placket,"shirt.placket"],
    ["shirt.pocket",spec.shirt.pocket,"shirt.pocket"],["shirt.sleeve",spec.shirt.sleeve,"shirt.sleeve"],
    ["shirt.fit",spec.shirt.fit,"shirt.fit"],["shirt.length",spec.shirt.length,"shirt.length"],
    ["shirt.hem",spec.shirt.hem,"shirt.hem"],["shirt.back",spec.shirt.back,"shirt.back"],
    ["shirt.button",spec.shirt.button,"shirt.button"],["pant.type",spec.pant.type,"pant.type"],
    ["pant.fit",spec.pant.fit,"pant.fit"],["pant.rise",spec.pant.rise,"pant.rise"],
    ["pant.pleat",spec.pant.pleat,"pant.pleat"],["pant.waistband",spec.pant.waistband,"pant.waistband"],
    ["pant.hem",spec.pant.hem,"pant.hem"],["pant.break",spec.pant.break,"pant.break"],
  ];
  for(const [name,id,group] of checks) {
    const option=optionById(id);
    if(!option || option.group!==group) errors.push(`${name}: unsupported option ${id}`);
  }
  return errors;
}
