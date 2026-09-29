import type { VocabEntry, VocabId } from "./types.ts";

export type DesignerOptionGroup="collar"|"cuff"|"shirtFit"|"trouser";

export const collarOptions=[
  {id:"spread_collar",label:"Spread Collar",aliases:["spread"]},
  {id:"cutaway_collar",label:"Cutaway Collar",aliases:["cutaway"]},
  {id:"point_standard_collar",label:"Point (Standard) Collar",aliases:["point collar","standard collar"]},
  {id:"button_down_collar",label:"Button-Down Collar",aliases:["button down collar","button-down"]},
  {id:"mandarin_band_collar",label:"Mandarin / Band Collar",aliases:["mandarin collar","band collar"]},
  {id:"club_collar",label:"Club Collar",aliases:["club"]},
  {id:"wing_collar",label:"Wing Collar",aliases:["wing"]},
  {id:"tab_collar",label:"Tab Collar",aliases:["tab"]},
  {id:"pin_collar",label:"Pin Collar",aliases:["pin"]},
  {id:"cuban_camp_collar",label:"Cuban / Camp Collar",aliases:["camp collar","cuban collar"]},
  {id:"soft_button_down",label:"Soft Button-Down Collar",aliases:["soft button down","soft button-down"]},
] as const satisfies readonly VocabEntry[];
export type CollarOptionId=VocabId<typeof collarOptions>;

export const cuffOptions=[
  {id:"french_double_cuff",label:"French / Double Cuff",aliases:["french cuff","double cuff"]},
  {id:"barrel_cuff_2_button",label:"Barrel Cuff (2-button)",aliases:["2 button barrel cuff","two button barrel cuff"]},
  {id:"barrel_cuff_1_button",label:"Barrel Cuff (1-button)",aliases:["1 button barrel cuff","one button barrel cuff"]},
  {id:"convertible_cuff",label:"Convertible Cuff",aliases:["convertible"]},
  {id:"rounded_soft_cuff",label:"Rounded/Soft Cuff",aliases:["rounded cuff","soft cuff"]},
  {id:"cocktail_cuff",label:"Cocktail Cuff",aliases:["cocktail"]},
  {id:"angled_barrel_cuff",label:"Angled Barrel Cuff",aliases:["angled cuff"]},
  {id:"open_short_hem_cuff",label:"Open Short-Sleeve Hem",aliases:["short sleeve hem","open short hem"]},
] as const satisfies readonly VocabEntry[];
export type CuffOptionId=VocabId<typeof cuffOptions>;

export const shirtFitOptions=[
  {id:"slim_fit",label:"Slim Fit",aliases:["slim"]},
  {id:"regular_classic_fit",label:"Regular / Classic Fit",aliases:["regular fit","classic fit","regular"]},
  {id:"relaxed_fit",label:"Relaxed Fit",aliases:["relaxed"]},
  {id:"boxy_oversized",label:"Boxy / Oversized Fit",aliases:["boxy fit","oversized fit"]},
  {id:"athletic_taper",label:"Athletic Taper Fit",aliases:["athletic fit","athletic taper"]},
] as const satisfies readonly VocabEntry[];
export type ShirtFitOptionId=VocabId<typeof shirtFitOptions>;

export const trouserDirectionOptions=[
  {id:"formal_flat_front",label:"Formal Trouser (Flat-front)",aliases:["formal trouser","flat front","flat-front tailored"]},
  {id:"pleated_trouser",label:"Pleated Trouser",aliases:["pleated","pleated trousers"]},
  {id:"cropped_ankle",label:"Cropped / Ankle-length Trouser",aliases:["cropped trouser","ankle length trouser"]},
  {id:"cargo_trouser",label:"Cargo Trouser",aliases:["cargo"]},
  {id:"jean_cut_suiting",label:"Jean-cut Trouser (suiting fabric)",aliases:["jean cut trouser","jean-cut"]},
  {id:"jodhpuri_churidar",label:"Jodhpuri / Churidar-style Trouser",aliases:["jodhpuri trouser","churidar"]},
  {id:"wide_leg_relaxed_drape",label:"Wide-leg / Relaxed Drape Trouser",aliases:["wide leg","wide-leg","relaxed drape trouser"]},
  {id:"slim_tapered",label:"Slim Tapered",aliases:["slim tapered trouser"]},
  {id:"straight_classic",label:"Straight Classic",aliases:["classic straight trouser"]},
  {id:"regular_tapered",label:"Regular Tapered",aliases:["regular tapered trouser"]},
  {id:"korean_straight_wide",label:"Korean Straight Wide",aliases:["korean wide","korean straight"]},
  {id:"korean_tapered",label:"Korean Tapered",aliases:["korean taper"]},
  {id:"baggy_wide",label:"Baggy Wide",aliases:["baggy trouser","baggy wide trouser"]},
  {id:"wide_leg_drape",label:"Wide-Leg Drape",aliases:["wide drape trouser"]},
  {id:"pleated_straight",label:"Pleated Straight",aliases:["pleated straight trouser"]},
  {id:"cargo_utility",label:"Cargo Utility",aliases:["utility cargo"]},
  {id:"jean_cut_suiting_fit",label:"Jean-Cut Suiting Fit",aliases:["jean cut suiting fit"]},
] as const satisfies readonly VocabEntry[];
export type TrouserDirectionId=VocabId<typeof trouserDirectionOptions>;

export const designerOptionVocabs={
  collar:collarOptions,
  cuff:cuffOptions,
  shirtFit:shirtFitOptions,
  trouser:trouserDirectionOptions,
} as const;

export function optionIdForLabel<G extends DesignerOptionGroup>(
  group:G,
  label:string,
):VocabId<(typeof designerOptionVocabs)[G]>|null {
  const vocab=designerOptionVocabs[group] as readonly VocabEntry[];
  const hit=vocab.find((item)=>item.label===label);
  return (hit?.id as VocabId<(typeof designerOptionVocabs)[G]>|undefined) ?? null;
}
