import type { DesignerStyle } from "./engine.ts";
import { legacyOptionByLabel, optionById } from "./options/library.ts";

export const STYLE_SCHEMA_VERSION=2 as const;

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
    wear:string;
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
  return legacyOptionByLabel(group,label)?.id ?? fallback;
}

export function fromLegacyStyle(style:DesignerStyle):StyleSpecV2 {
  const pantFit=/wide-leg|relaxed drape/i.test(style.trouser)
    ? "wide_leg_drape"
    : /pleated/i.test(style.trouser)
      ? "pleated_straight"
      : /cargo/i.test(style.trouser)
        ? "cargo_utility"
        : /jean-cut/i.test(style.trouser)
          ? "jean_cut_suiting_fit"
          : "straight_classic";
  const pleat=/pleated/i.test(style.trouser) ? "single_pleat_forward" : "flat_front";
  return {
    styleSchemaVersion:2,
    shirt:{
      type:"dress_shirt",
      collar:legacyId("shirt.collar",style.collar,"point_standard_collar"),
      collarFinish:style.collarFinish,
      cuff:legacyId("shirt.cuff",style.cuff,"barrel_cuff_1_button"),
      placket:legacyId("shirt.placket",style.placket,"standard_visible_placket"),
      pocket:"no_pocket",
      sleeve:"full_sleeve",
      fit:legacyId("shirt.fit",style.shirtFit,"regular_classic_fit"),
      length:style.shirtWear==="Tucked"?"shirt_length_tuck":"shirt_length_regular",
      hem:style.shirtWear==="Tucked"?"curved_shirttail":"straight_flat_hem",
      back:"plain_back",
      wear:style.shirtWear==="Tucked"?"tucked":"untucked",
      button:legacyId("shirt.button",style.button,"plastic_resin"),
    },
    pant:{
      type:legacyId("pant.type",style.trouser,"formal_flat_front"),
      fit:pantFit,
      rise:legacyId("pant.rise",style.rise,"mid_rise"),
      pleat,
      waistband:legacyId("pant.waistband",style.waistband,"belt_loops"),
      hem:"plain_hem",
      break:legacyId("pant.break",style.break,"no_break"),
    },
    legacy:{...style},
  };
}

function labelFor(id:string,fallback:string) {
  const option=optionById(id);
  return option?.legacyLabel || option?.label || fallback;
}

export function toLegacyStyle(spec:StyleSpecV2):DesignerStyle {
  return {
    ...spec.legacy,
    collar:labelFor(spec.shirt.collar,spec.legacy.collar),
    cuff:labelFor(spec.shirt.cuff,spec.legacy.cuff),
    placket:labelFor(spec.shirt.placket,spec.legacy.placket),
    shirtFit:labelFor(spec.shirt.fit,spec.legacy.shirtFit),
    shirtWear:spec.shirt.wear==="tucked"?"Tucked":spec.shirt.wear==="untucked"?"Untucked":spec.legacy.shirtWear,
    trouser:labelFor(spec.pant.type,spec.legacy.trouser),
    rise:labelFor(spec.pant.rise,spec.legacy.rise),
    waistband:labelFor(spec.pant.waistband,spec.legacy.waistband),
    break:labelFor(spec.pant.break,spec.legacy.break),
    button:labelFor(spec.shirt.button,spec.legacy.button),
  };
}

export function mergeLegacyIntoStyleSpec(current:StyleSpecV2,style:DesignerStyle):StyleSpecV2 {
  const prior=toLegacyStyle(current);
  const base=fromLegacyStyle(style);
  const next:StyleSpecV2={
    ...current,
    shirt:{...current.shirt},
    pant:{...current.pant},
    legacy:{...style},
  };

  if(style.collar!==prior.collar) next.shirt.collar=base.shirt.collar;
  if(style.collarFinish!==prior.collarFinish) next.shirt.collarFinish=style.collarFinish;
  if(style.cuff!==prior.cuff) next.shirt.cuff=base.shirt.cuff;
  if(style.placket!==prior.placket) next.shirt.placket=base.shirt.placket;
  if(style.shirtFit!==prior.shirtFit) next.shirt.fit=base.shirt.fit;
  if(style.shirtWear!==prior.shirtWear) {
    next.shirt.wear=base.shirt.wear;
    next.shirt.length=base.shirt.length;
    next.shirt.hem=base.shirt.hem;
  }
  if(style.button!==prior.button) next.shirt.button=base.shirt.button;
  if(style.trouser!==prior.trouser) {
    next.pant.type=base.pant.type;
    next.pant.fit=base.pant.fit;
    next.pant.pleat=base.pant.pleat;
  }
  if(style.rise!==prior.rise) next.pant.rise=base.pant.rise;
  if(style.waistband!==prior.waistband) next.pant.waistband=base.pant.waistband;
  if(style.break!==prior.break) next.pant.break=base.pant.break;
  return next;
}

const STYLE_OPTION_GROUPS={
  shirt:{
    type:"shirt.type",collar:"shirt.collar",cuff:"shirt.cuff",placket:"shirt.placket",pocket:"shirt.pocket",
    sleeve:"shirt.sleeve",fit:"shirt.fit",length:"shirt.length",hem:"shirt.hem",back:"shirt.back",button:"shirt.button",
  },
  pant:{
    type:"pant.type",fit:"pant.fit",rise:"pant.rise",pleat:"pant.pleat",waistband:"pant.waistband",hem:"pant.hem",break:"pant.break",
  },
} as const;

export function validateStyleSpecV2(value:unknown):value is StyleSpecV2 {
  if(!value || typeof value!=="object") return false;
  const spec=value as Partial<StyleSpecV2>;
  if(spec.styleSchemaVersion!==2 || !spec.shirt || !spec.pant || !spec.legacy) return false;
  if(!["tucked","untucked"].includes(String(spec.shirt.wear))) return false;
  if(!["Self-fabric","White contrast collar","White contrast collar + cuffs"].includes(String(spec.shirt.collarFinish))) return false;
  for(const [key,group] of Object.entries(STYLE_OPTION_GROUPS.shirt)) {
    const id=String((spec.shirt as Record<string,unknown>)[key]||"");
    const option=optionById(id);
    if(!option || option.group!==group) return false;
  }
  for(const [key,group] of Object.entries(STYLE_OPTION_GROUPS.pant)) {
    const id=String((spec.pant as Record<string,unknown>)[key]||"");
    const option=optionById(id);
    if(!option || option.group!==group) return false;
  }
  return true;
}

export function styleSpecRenderSummary(spec:StyleSpecV2) {
  const label=(id:string)=>optionById(id)?.label || id.replaceAll("_"," ");
  return [
    `shirt type ${label(spec.shirt.type)}`,
    `collar ${label(spec.shirt.collar)}`,
    `cuff ${label(spec.shirt.cuff)}`,
    `placket ${label(spec.shirt.placket)}`,
    `sleeve ${label(spec.shirt.sleeve)}`,
    `shirt fit ${label(spec.shirt.fit)}`,
    `shirt length ${label(spec.shirt.length)}`,
    `shirt hem ${label(spec.shirt.hem)}`,
    `shirt back ${label(spec.shirt.back)}`,
    `shirt wear ${spec.shirt.wear}`,
    `trouser type ${label(spec.pant.type)}`,
    `trouser fit ${label(spec.pant.fit)}`,
    `rise ${label(spec.pant.rise)}`,
    `pleats ${label(spec.pant.pleat)}`,
    `waistband ${label(spec.pant.waistband)}`,
    `hem ${label(spec.pant.hem)}`,
    `break ${label(spec.pant.break)}`,
  ].join("; ");
}

export function styleSpecHashInput(spec:StyleSpecV2) {
  return JSON.stringify({
    styleSchemaVersion:2,
    shirt:{
      type:spec.shirt.type,
      collar:spec.shirt.collar,
      collarFinish:spec.shirt.collarFinish,
      cuff:spec.shirt.cuff,
      placket:spec.shirt.placket,
      pocket:spec.shirt.pocket,
      sleeve:spec.shirt.sleeve,
      fit:spec.shirt.fit,
      length:spec.shirt.length,
      hem:spec.shirt.hem,
      back:spec.shirt.back,
      wear:spec.shirt.wear,
      button:spec.shirt.button,
    },
    pant:{
      type:spec.pant.type,
      fit:spec.pant.fit,
      rise:spec.pant.rise,
      pleat:spec.pant.pleat,
      waistband:spec.pant.waistband,
      hem:spec.pant.hem,
      break:spec.pant.break,
    },
  });
}

export function legacyStyleHashInput(style:DesignerStyle) {
  return JSON.stringify({
    collar:style.collar,
    collarFinish:style.collarFinish,
    cuff:style.cuff,
    placket:style.placket,
    shirtFit:style.shirtFit,
    shirtWear:style.shirtWear,
    trouser:style.trouser,
    rise:style.rise,
    waistband:style.waistband,
    break:style.break,
    button:style.button,
  });
}
