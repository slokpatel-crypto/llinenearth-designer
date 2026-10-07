import reference from "../reference-data.json" with { type: "json" };
import type { GarmentOption, GarmentOptionGroup } from "./types.ts";
import styleVariants from "../../garment-viewer-style-variants.json" with { type:"json" };

type Row=Record<string,unknown>;
const sheets=reference.sheets as unknown as Record<string,Row[]>;

const baseRender={livePreview:"approximate",aiRender:"approximate"} as const;
const futureRender={livePreview:"none",aiRender:"approximate"} as const;

function score(value:unknown):1|2|3|4|5|null {
  const n=Number(value);
  return [1,2,3,4,5].includes(n) ? n as 1|2|3|4|5 : null;
}
function text(value:unknown){return String(value??"").trim();}
function refOption(input:{
  id:string;group:GarmentOptionGroup;label:string;description?:string;formality?:unknown;
  parameters?:Record<string,number|string|boolean>;legacySelectable?:boolean;
}):GarmentOption {
  const formality=score(input.formality);
  return {
    id:input.id,
    legacyLabel:input.label,
    group:input.group,
    label:input.label,
    description:input.description||input.label,
    formality,
    ...(formality===null?{formalityNullReason:"Reference sheet treats this as a fit/construction choice rather than a formality signal."}:{}),
    climateTags:["all"],
    parameters:input.parameters||{},
    renderSupport:{...baseRender},
    provenance:"reference-source",
    reviewStatus:"provisional",
    legacySelectable:input.legacySelectable!==false,
  };
}
function provisional(input:Omit<GarmentOption,"provenance"|"reviewStatus"|"renderSupport"> & {renderSupport?:GarmentOption["renderSupport"]}):GarmentOption {
  return {
    ...input,
    renderSupport:input.renderSupport||{...futureRender},
    provenance:"owner-provided",
    reviewStatus:"provisional",
  };
}

const collarIds:Record<string,string>={
  "Spread Collar":"spread_collar","Cutaway Collar":"cutaway_collar","Point (Standard) Collar":"point_standard_collar",
  "Button-Down Collar":"button_down_collar","Mandarin / Band Collar":"mandarin_band_collar","Club Collar":"club_collar","Wing Collar":"wing_collar",
};
const cuffIds:Record<string,string>={
  "French / Double Cuff":"french_double_cuff","Barrel Cuff (2-button)":"barrel_cuff_2_button",
  "Barrel Cuff (1-button)":"barrel_cuff_1_button","Convertible Cuff":"convertible_cuff","Rounded/Soft Cuff":"rounded_soft_cuff",
};
const placketIds:Record<string,string>={
  "Standard (visible stitch)":"standard_visible_placket","Hidden / Fly-front":"hidden_fly_front","Contrast Placket":"contrast_placket",
};
const pocketIds:Record<string,string>={
  "No Pocket":"no_pocket","Single Patch Pocket":"single_patch_pocket","Flap Pocket":"flap_pocket",
};
const fitIds:Record<string,string>={
  "Slim Fit":"slim_fit","Regular / Classic Fit":"regular_classic_fit","Relaxed Fit":"relaxed_fit",
};
const sleeveIds:Record<string,string>={
  "Full Sleeve":"full_sleeve","Half Sleeve":"half_sleeve","Roll-up Styled":"roll_up_styled",
};
const trouserIds:Record<string,string>={
  "Formal Trouser (Flat-front)":"formal_flat_front","Pleated Trouser":"pleated_trouser","Chino":"chino",
  "Cotton Drill Trouser":"cotton_drill_trouser","Cropped / Ankle-length Trouser":"cropped_ankle",
  "Cargo Trouser":"cargo_trouser","Jean-cut Trouser (suiting fabric)":"jean_cut_suiting",
  "Jodhpuri / Churidar-style Trouser":"jodhpuri_churidar","Wide-leg / Relaxed Drape Trouser":"wide_leg_relaxed_drape",
};
const riseIds:Record<string,string>={"Low Rise":"low_rise","Mid Rise":"mid_rise","High Rise":"high_rise"};
const waistbandIds:Record<string,string>={
  "Plain / Clean Front":"plain_clean_front","Belt Loops":"belt_loops","Side-Adjuster Tabs":"side_adjuster_tabs","Drawstring / Elastic":"drawstring_elastic",
};
const breakIds:Record<string,string>={
  "No Break":"no_break","Slight Break":"slight_break","Full Break":"full_break","Cropped / Above-ankle":"cropped_above_ankle",
};
const buttonIds:Record<string,string>={
  "Mother-of-Pearl":"mother_of_pearl","Corozo (vegetable ivory)":"corozo","Horn":"horn","Plastic / Resin":"plastic_resin","Metal / Contrast":"metal_contrast",
};

function fromSheet(sheet:string,labelKey:string,group:GarmentOptionGroup,ids:Record<string,string>,selectable?:(label:string)=>boolean) {
  return (sheets[sheet]||[]).map((row)=>{
    const label=text(row[labelKey]);
    return refOption({
      id:ids[label]||label.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""),
      group,label,
      description:text(row.Description)||text(row.Notes)||label,
      formality:row.Formality_Score,
      legacySelectable:selectable?selectable(label):true,
    });
  });
}

const detailRows=sheets.Shirt_Placket_Pocket_Fit||[];
const detailOptions=detailRows.map((row)=>{
  const group=text(row.Element_Group);
  const label=text(row.Type);
  if(group==="Placket") return refOption({id:placketIds[label],group:"shirt.placket",label,description:text(row.Description),formality:row.Formality_Score,legacySelectable:label!=="Contrast Placket"});
  if(group==="Pocket") return refOption({id:pocketIds[label],group:"shirt.pocket",label,description:text(row.Description),formality:row.Formality_Score});
  if(group==="Fit") return refOption({id:fitIds[label],group:"shirt.fit",label,description:text(row.Description),formality:row.Formality_Score});
  return refOption({id:sleeveIds[label],group:"shirt.sleeve",label,description:text(row.Description),formality:row.Formality_Score});
});

const pantDetailRows=sheets.Pant_Rise_Waistband_Break||[];
const pantDetails=pantDetailRows.map((row)=>{
  const group=text(row.Element_Group);
  const label=text(row.Type);
  if(group==="Rise") return refOption({id:riseIds[label],group:"pant.rise",label,description:text(row.Description),formality:row.Formality_Score});
  if(group==="Waistband") return refOption({id:waistbandIds[label],group:"pant.waistband",label,description:text(row.Description),formality:row.Formality_Score});
  return refOption({id:breakIds[label],group:"pant.break",label,description:text(row.Description),formality:row.Formality_Score});
});

const referenceOptions:GarmentOption[]=[
  refOption({id:"untucked",group:"shirt.wear",label:"Untucked",description:"Shirt worn outside the trouser waistband.",formality:2,parameters:{tucked:false}}),
  refOption({id:"tucked",group:"shirt.wear",label:"Tucked",description:"Shirt tucked into the trouser waistband.",formality:4,parameters:{tucked:true}}),
  ...fromSheet("Shirt_Collar","Collar_Type","shirt.collar",collarIds,(label)=>label!=="Wing Collar"),
  ...fromSheet("Shirt_Cuff","Cuff_Type","shirt.cuff",cuffIds),
  ...detailOptions,
  ...fromSheet("Pant_Trouser_Types","Trouser_Type","pant.type",trouserIds,(label)=>!["Chino","Cotton Drill Trouser"].includes(label)),
  ...pantDetails,
  ...fromSheet("Button_Types","Button_Material","shirt.button",buttonIds),
];

const newOptions:GarmentOption[]=[
  provisional({id:"dress_shirt",group:"shirt.type",label:"Dress Shirt",description:"Structured shirt for business and formal use.",formality:4,climateTags:["air_conditioned","all"],parameters:{structure:"medium"}}),
  provisional({id:"casual_shirt",group:"shirt.type",label:"Casual Shirt",description:"Relaxed everyday shirt.",formality:2,climateTags:["hot_humid","all"],parameters:{structure:"soft"}}),
  provisional({id:"camp_collar_resort",group:"shirt.type",label:"Camp-Collar Resort Shirt",description:"Open-neck resort shirt intended to be worn untucked.",formality:1,climateTags:["hot_humid"],parameters:{openNeck:true}}),
  provisional({id:"band_collar_shirt",group:"shirt.type",label:"Band-Collar Shirt",description:"Stand-collar shirt suitable for modern festive/fusion styling.",formality:3,climateTags:["hot_humid","air_conditioned"],parameters:{standCollar:true}}),
  provisional({id:"overshirt",group:"shirt.type",label:"Overshirt",description:"Layering shirt with extra ease.",formality:2,climateTags:["cool","air_conditioned"],parameters:{layer:true}}),
  provisional({id:"short_sleeve_shirt",group:"shirt.type",label:"Short-Sleeve Shirt",description:"Warm-weather shirt with short sleeves.",formality:1,climateTags:["hot_humid"],parameters:{shortSleeve:true}}),

  provisional({id:"english_spread_collar",group:"shirt.collar",label:"English Spread / British Collar",description:"Traditional British business spread with a conservative 4.88-inch spread and 2.75-inch points.",formality:4,climateTags:["all"],parameters:{pointLengthMm:69.85,spreadMm:123.95,tieSpaceMm:9.65,frontBandHeightMm:25.4,rearBandHeightMm:35.05,source:"Proper Cloth English Spread Collar"}}),
  provisional({id:"tab_collar",group:"shirt.collar",label:"Tab Collar",description:"Narrow collar held together by a tab under a tie.",formality:4,climateTags:["all"],parameters:{bandHeightMm:35,fallHeightMm:42,pointLengthMm:72,spreadAngleDeg:45}}),
  provisional({id:"pin_collar",group:"shirt.collar",label:"Pin Collar",description:"Dress collar designed for a collar pin.",formality:4,climateTags:["all"],parameters:{bandHeightMm:35,fallHeightMm:43,pointLengthMm:74,spreadAngleDeg:48}}),
  provisional({id:"cuban_camp_collar",group:"shirt.collar",label:"Cuban / Camp Collar",description:"Open resort collar with a relaxed neckline.",formality:1,climateTags:["hot_humid"],parameters:{bandHeightMm:0,fallHeightMm:55,pointLengthMm:72,spreadAngleDeg:120}}),
  provisional({id:"soft_button_down",group:"shirt.collar",label:"Soft Button-Down Collar",description:"Unfused button-down with a softer roll.",formality:2,climateTags:["hot_humid","all"],parameters:{bandHeightMm:34,fallHeightMm:48,pointLengthMm:78,spreadAngleDeg:55}}),

  provisional({id:"cocktail_cuff",group:"shirt.cuff",label:"Cocktail Cuff",description:"Turn-back cuff fastened with buttons.",formality:4,climateTags:["all"],parameters:{widthMm:115,heightMm:70,corner:"rounded",buttons:2}}),
  provisional({id:"angled_barrel_cuff",group:"shirt.cuff",label:"Angled Barrel Cuff",description:"Barrel cuff with an angled corner.",formality:3,climateTags:["all"],parameters:{widthMm:110,heightMm:65,corner:"angled",buttons:1}}),
  provisional({id:"open_short_hem_cuff",group:"shirt.cuff",label:"Open Short-Sleeve Hem",description:"Clean open hem finish for a short sleeve.",formality:1,climateTags:["hot_humid"],parameters:{widthMm:0,heightMm:30,corner:"square",buttons:0}}),

  provisional({id:"french_placket",group:"shirt.placket",label:"French Placket",description:"Clean folded front without a separate raised placket.",formality:4,climateTags:["all"],parameters:{visibleBand:false}}),
  provisional({id:"covered_placket",group:"shirt.placket",label:"Covered Placket",description:"Buttons covered by a front fold.",formality:5,climateTags:["air_conditioned","all"],parameters:{coveredButtons:true}}),

  provisional({id:"boxy_oversized",group:"shirt.fit",label:"Boxy / Oversized Fit",description:"Wide, straight shirt body with deliberate ease.",formality:1,climateTags:["hot_humid","all"],parameters:{chestEaseCm:20,waistSuppressionCm:0,shoulderDropCm:3}}),
  provisional({id:"athletic_taper",group:"shirt.fit",label:"Athletic Taper Fit",description:"Extra chest/shoulder room with controlled waist suppression.",formality:3,climateTags:["all"],parameters:{chestEaseCm:12,waistSuppressionCm:8,shoulderDropCm:0}}),

  provisional({id:"shirt_length_short",group:"shirt.length",label:"Short Length",description:"Shorter body for untucked or proportion-led looks.",formality:null,formalityNullReason:"Length is a proportion choice.",climateTags:["all"],parameters:{lengthDeltaCm:-5}}),
  provisional({id:"shirt_length_regular",group:"shirt.length",label:"Regular Length",description:"Standard shirt body length.",formality:null,formalityNullReason:"Length is a proportion choice.",climateTags:["all"],parameters:{lengthDeltaCm:0}}),
  provisional({id:"shirt_length_long",group:"shirt.length",label:"Long Length",description:"Longer shirt body.",formality:null,formalityNullReason:"Length is a proportion choice.",climateTags:["all"],parameters:{lengthDeltaCm:5}}),
  provisional({id:"shirt_length_tuck",group:"shirt.length",label:"Tuck Length",description:"Extra body length intended to remain securely tucked.",formality:null,formalityNullReason:"Length is a construction choice.",climateTags:["all"],parameters:{lengthDeltaCm:7}}),
  provisional({id:"curved_shirttail",group:"shirt.hem",label:"Curved Shirttail Hem",description:"Traditional curved shirt tail.",formality:3,climateTags:["all"],parameters:{curveDepthCm:7}}),
  provisional({id:"straight_flat_hem",group:"shirt.hem",label:"Straight Flat Hem",description:"Straight hem for untucked shirts.",formality:2,climateTags:["hot_humid","all"],parameters:{curveDepthCm:0}}),
  provisional({id:"side_vents_hem",group:"shirt.hem",label:"Straight Hem + Side Vents",description:"Straight hem with side vents.",formality:2,climateTags:["hot_humid","all"],parameters:{sideVentCm:5}}),
  provisional({id:"plain_back",group:"shirt.back",label:"Plain Back",description:"Clean back without pleats.",formality:4,climateTags:["all"],parameters:{pleats:0}}),
  provisional({id:"box_pleat_back",group:"shirt.back",label:"Box Pleat Back",description:"Central box pleat for movement.",formality:2,climateTags:["hot_humid","all"],parameters:{pleats:1}}),
  provisional({id:"side_pleats_back",group:"shirt.back",label:"Side Pleats Back",description:"Two rear pleats for mobility.",formality:3,climateTags:["all"],parameters:{pleats:2}}),
  provisional({id:"darts_back",group:"shirt.back",label:"Back Darts",description:"Rear darts for waist suppression.",formality:4,climateTags:["all"],parameters:{darts:2}}),

  provisional({id:"slim_tapered",group:"pant.fit",label:"Slim Tapered",description:"Closer thigh with a narrow hem.",formality:3,climateTags:["all"],parameters:{thighPctSeat:62,kneePctSeat:46,hemPctSeat:36}}),
  provisional({id:"straight_classic",group:"pant.fit",label:"Straight Classic",description:"Balanced classic tailored line.",formality:4,climateTags:["all"],parameters:{thighPctSeat:68,kneePctSeat:58,hemPctSeat:52}}),
  provisional({id:"regular_tapered",group:"pant.fit",label:"Regular Tapered",description:"Relaxed thigh with a controlled taper.",formality:3,climateTags:["all"],parameters:{thighPctSeat:72,kneePctSeat:56,hemPctSeat:44}}),
  provisional({id:"korean_straight_wide",group:"pant.fit",label:"Korean Straight Wide",description:"High-waist, wide straight silhouette.",formality:2,climateTags:["all"],parameters:{thighPctSeat:80,kneePctSeat:74,hemPctSeat:70}}),
  provisional({id:"korean_tapered",group:"pant.fit",label:"Korean Tapered",description:"High-waist roomy thigh tapering toward the ankle.",formality:2,climateTags:["all"],parameters:{thighPctSeat:80,kneePctSeat:60,hemPctSeat:46}}),
  provisional({id:"baggy_wide",group:"pant.fit",label:"Baggy Wide",description:"Very wide leg with deliberate volume.",formality:1,climateTags:["all"],parameters:{thighPctSeat:88,kneePctSeat:84,hemPctSeat:82}}),
  provisional({id:"wide_leg_drape",group:"pant.fit",label:"Wide-Leg Drape",description:"Wide tailored leg with continuous drape.",formality:3,climateTags:["all"],parameters:{thighPctSeat:82,kneePctSeat:78,hemPctSeat:76}}),
  provisional({id:"pleated_straight",group:"pant.fit",label:"Pleated Straight",description:"Pleated tailored trouser with a straight leg.",formality:4,climateTags:["all"],parameters:{thighPctSeat:74,kneePctSeat:64,hemPctSeat:58}}),
  provisional({id:"cargo_utility",group:"pant.fit",label:"Cargo Utility",description:"Relaxed utility silhouette.",formality:1,climateTags:["all"],parameters:{thighPctSeat:74,kneePctSeat:66,hemPctSeat:60}}),
  provisional({id:"jean_cut_suiting_fit",group:"pant.fit",label:"Jean-Cut Suiting Fit",description:"Five-pocket-inspired proportion interpreted in suiting cloth.",formality:2,climateTags:["all"],parameters:{thighPctSeat:70,kneePctSeat:58,hemPctSeat:50}}),

  provisional({id:"extra_high_rise",group:"pant.rise",label:"Extra-High Rise",description:"Waistline approximately 6 cm or more above the navel; Korean high-waist direction.",formality:3,climateTags:["all"],parameters:{waistLineOffsetCm:6,frontRiseCm:34}}),
  provisional({id:"flat_front",group:"pant.pleat",label:"Flat Front",description:"No front pleats.",formality:4,climateTags:["all"],parameters:{pleatCount:0,pleatDirection:"none"}}),
  provisional({id:"single_pleat_forward",group:"pant.pleat",label:"Single Forward Pleat",description:"One forward-facing pleat each side.",formality:4,climateTags:["all"],parameters:{pleatCount:1,pleatDirection:"forward"}}),
  provisional({id:"single_pleat_reverse",group:"pant.pleat",label:"Single Reverse Pleat",description:"One reverse pleat each side.",formality:4,climateTags:["all"],parameters:{pleatCount:1,pleatDirection:"reverse"}}),
  provisional({id:"double_pleat_forward",group:"pant.pleat",label:"Double Forward Pleat",description:"Two forward pleats each side.",formality:4,climateTags:["all"],parameters:{pleatCount:2,pleatDirection:"forward"}}),
  provisional({id:"double_pleat_reverse",group:"pant.pleat",label:"Double Reverse Pleat",description:"Two reverse pleats each side.",formality:4,climateTags:["all"],parameters:{pleatCount:2,pleatDirection:"reverse"}}),

  provisional({id:"extended_tab",group:"pant.waistband",label:"Extended Waistband Tab",description:"Extended tailored front tab.",formality:4,climateTags:["all"],parameters:{extendedTab:true}}),
  provisional({id:"belt_loops_with_belt",group:"pant.waistband",label:"Belt Loops + Belt",description:"Conventional loops intended for a belt.",formality:3,climateTags:["all"],parameters:{beltLoops:true}}),
  provisional({id:"adjuster_tabs_no_belt",group:"pant.waistband",label:"Adjuster Tabs · No Belt",description:"Side adjusters with a clean beltless waist.",formality:4,climateTags:["all"],parameters:{sideAdjusters:true,beltLoops:false}}),

  provisional({id:"plain_hem",group:"pant.hem",label:"Plain Hem",description:"Clean uncuffed trouser hem.",formality:4,climateTags:["all"],parameters:{cuff:false}}),
  provisional({id:"cuffed_turn_up",group:"pant.hem",label:"Cuffed / Turn-Up Hem",description:"Visible trouser turn-up.",formality:3,climateTags:["all"],parameters:{cuff:true,cuffHeightCm:4}}),
  provisional({id:"cropped_above_ankle_hem",group:"pant.hem",label:"Cropped Above Ankle",description:"Short hem ending above the ankle.",formality:2,climateTags:["hot_humid","all"],parameters:{lengthDeltaCm:-5}}),
  provisional({id:"stacked_break",group:"pant.break",label:"Stacked Break",description:"Extra length creates deliberate stacking over footwear.",formality:1,climateTags:["all"],parameters:{lengthDeltaCm:4}}),
];

const seededOptions=[...referenceOptions,...newOptions];
function researchedTypeFormality(id:string,garment:"shirt"|"pant"):1|2|3|4|5 {
  if(garment==="shirt"){
    if(id==="tuxedo") return 5;
    if(["dress_shirt","business_spread"].includes(id)) return 4;
    if(["ocbd","band_collar_shirt"].includes(id)) return 3;
    if(["casual_shirt","popover","overshirt","western","safari"].includes(id)) return 2;
    return 1;
  }
  if(["formal_flat_front","bespoke_side_adjuster","double_pleat_high_rise"].includes(id)) return 4;
  if(["gurkha","wide_leg_relaxed_drape","chino"].includes(id)) return 3;
  if(["cropped_ankle","linen_drawstring","jean_cut_suiting","korean_tapered"].includes(id)) return 2;
  return 1;
}
const researchedTypeOptions:GarmentOption[]=[
  ...styleVariants.shirtTypes
    .filter((item)=>!seededOptions.some((existing)=>existing.group==="shirt.type"&&(existing.id===item.id||existing.label===item.label)))
    .map((item)=>provisional({
      id:item.id,group:"shirt.type",label:item.label,
      description:`Research-normalized shirt family; preset ${item.id.replaceAll("_"," ")} drives the deterministic 3D tailoring matrix.`,
      formality:researchedTypeFormality(item.id,"shirt"),climateTags:["all"],
      parameters:{presetId:item.id},
      renderSupport:{livePreview:"approximate",aiRender:"approximate"},
    })),
  ...styleVariants.trouserTypes
    .filter((item)=>!seededOptions.some((existing)=>existing.group==="pant.type"&&(existing.id===item.id||existing.label===item.label)))
    .map((item)=>provisional({
      id:item.id,group:"pant.type",label:item.label,
      description:`Research-normalized trouser family; preset ${item.id.replaceAll("_"," ")} drives the deterministic 3D tailoring matrix.`,
      formality:researchedTypeFormality(item.id,"pant"),climateTags:["all"],
      parameters:{presetId:item.id},
      renderSupport:{livePreview:"approximate",aiRender:"approximate"},
    })),
];

export const GARMENT_OPTION_LIBRARY:readonly GarmentOption[]=[...seededOptions,...researchedTypeOptions];

export function optionsFor(group:GarmentOptionGroup) {
  return GARMENT_OPTION_LIBRARY.filter((option)=>option.group===group);
}
export function optionById(id:string) {
  return GARMENT_OPTION_LIBRARY.find((option)=>option.id===id) || null;
}
export function legacyOptionByLabel(group:GarmentOptionGroup,label:string) {
  return GARMENT_OPTION_LIBRARY.find((option)=>option.group===group && option.legacyLabel===label) || null;
}
export function legacyLabelsFor(group:GarmentOptionGroup) {
  return GARMENT_OPTION_LIBRARY
    .filter((option)=>option.group===group && option.legacyLabel && option.legacySelectable!==false)
    .map((option)=>option.legacyLabel as string);
}

export function validateGarmentOptionLibrary() {
  const errors:string[]=[];
  const ids=new Set<string>();
  for(const option of GARMENT_OPTION_LIBRARY) {
    if(!option.id) errors.push("Option without id.");
    if(ids.has(option.id)) errors.push(`Duplicate option id: ${option.id}`);
    ids.add(option.id);
    if(option.formality===null && !option.formalityNullReason) errors.push(`Missing formality reason: ${option.id}`);
    for(const ref of [...(option.pairsWith||[]),...(option.avoidWith||[])]) {
      if(!GARMENT_OPTION_LIBRARY.some((candidate)=>candidate.id===ref)) errors.push(`Unknown option reference ${ref} from ${option.id}`);
    }
  }
  return errors;
}
