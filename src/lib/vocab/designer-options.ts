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
] as const satisfies readonly VocabEntry[];
export type CollarOptionId=VocabId<typeof collarOptions>;

export const cuffOptions=[
  {id:"french_double_cuff",label:"French / Double Cuff",aliases:["french cuff","double cuff"]},
  {id:"barrel_cuff_2_button",label:"Barrel Cuff (2-button)",aliases:["2 button barrel cuff","two button barrel cuff"]},
  {id:"barrel_cuff_1_button",label:"Barrel Cuff (1-button)",aliases:["1 button barrel cuff","one button barrel cuff"]},
  {id:"convertible_cuff",label:"Convertible Cuff",aliases:["convertible"]},
  {id:"rounded_soft_cuff",label:"Rounded/Soft Cuff",aliases:["rounded cuff","soft cuff"]},
] as const satisfies readonly VocabEntry[];
export type CuffOptionId=VocabId<typeof cuffOptions>;

export const shirtFitOptions=[
  {id:"slim_fit",label:"Slim Fit",aliases:["slim"]},
  {id:"regular_classic_fit",label:"Regular / Classic Fit",aliases:["regular fit","classic fit","regular"]},
  {id:"relaxed_fit",label:"Relaxed Fit",aliases:["relaxed"]},
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
] as const satisfies readonly VocabEntry[];
export type TrouserDirectionId=VocabId<typeof trouserDirectionOptions>;

export const designerOptionVocabs={
  collar:collarOptions,
  cuff:cuffOptions,
  shirtFit:shirtFitOptions,
  trouser:trouserDirectionOptions,
} as const;

export function optionIdForLabel(group:DesignerOptionGroup,label:string) {
  const vocab=designerOptionVocabs[group];
  const hit=vocab.find((item)=>item.label===label);
  return hit?.id ?? null;
}
