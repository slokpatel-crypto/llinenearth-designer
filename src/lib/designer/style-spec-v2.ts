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
