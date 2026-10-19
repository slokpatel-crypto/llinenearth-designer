import styleVariants from "../garment-viewer-style-variants.json" with { type:"json" };
import { futureGarmentOptionsFor } from "./future-garment-options.ts";
import type { ModelLayerSlot } from "./model-layer-contract.ts";

export type GarmentCategoryStatus="live"|"planned";

export type GarmentCategoryDefinition={
  id:"shirt"|"trouser"|"blazer"|"suit"|"waistcoat"|"accessories";
  label:string;
  status:GarmentCategoryStatus;
  stageLabel:string;
  description:string;
  typeExamples:string[];
  detailFamilies:string[];
  /** Logical model slots only; planned slots have no approved 3D assets. */
  layerSlots:readonly ModelLayerSlot[];
};

const shirtTypeExamples=styleVariants.shirtTypes.map((option)=>option.label);
const trouserTypeExamples=styleVariants.trouserTypes.map((option)=>option.label);
const blazerTypeExamples=futureGarmentOptionsFor("blazer.type").map((option)=>option.label);
const suitTypeExamples=futureGarmentOptionsFor("suit.type").map((option)=>option.label);

export const GARMENT_CATEGORY_LIBRARY:GarmentCategoryDefinition[]=[
  {
    id:"shirt",
    layerSlots:["shirt"],
    label:"Shirt",
    status:"live",
    stageLabel:"3D tailoring variants live",
    description:"The locked mannequin now carries researched shirt construction variants while fabric remains independently mapped at physical panel scale.",
    typeExamples:shirtTypeExamples,
    detailFamilies:["Type","Fit","Tuck","Sleeve","Collar","Collar build","Cuff","Cuff build","Placket","Pocket","Yoke","Back","Hem","Buttons"],
  },
  {
    id:"trouser",
    layerSlots:["trouser"],
    label:"Trouser",
    status:"live",
    stageLabel:"3D tailoring variants live",
    description:"Trouser silhouette, rise, pleat direction, waistband, break, turn-up and pocket construction now switch on the same locked model.",
    typeExamples:trouserTypeExamples,
    detailFamilies:["Type","Fit","Rise","Pleats","Pleat direction","Waistband","Break","Hem / turn-up","Pockets"],
  },
  {
    id:"blazer",
    layerSlots:["blazer"],
    label:"Blazer",
    status:"planned",
    stageLabel:"Future garment block",
    description:"Prepared as a separate garment family so blazer construction does not get forced into the shirt or trouser model.",
    typeExamples:blazerTypeExamples,
    detailFamilies:["Lapel","Breast style","Button stance","Vent","Pocket","Length","Shoulder"],
  },
  {
    id:"suit",
    layerSlots:["shirt","trouser","blazer"],
    label:"Suit",
    status:"planned",
    stageLabel:"Future coordinated look",
    description:"Planned as a linked jacket-and-trouser system with shared fabric, proportion and formality rules.",
    typeExamples:suitTypeExamples,
    detailFamilies:["Jacket","Trouser","Lapel","Vent","Waistcoat","Button stance","Trouser pairing"],
  },
  {
    id:"waistcoat",
    layerSlots:["waistcoat"],
    label:"Waistcoat",
    status:"planned",
    stageLabel:"Future middle garment layer",
    description:"A separately fitted torso layer over the shirt and under a jacket; no approved source mesh or cloth calibration yet.",
    typeExamples:["Single-breasted waistcoat","Double-breasted waistcoat"],
    detailFamilies:["Neckline","Front closure","Length","Pocket","Back strap"],
  },
  {
    id:"accessories",
    layerSlots:["tie","pocket-square","belt"],
    label:"Accessories",
    status:"planned",
    stageLabel:"Future attachable detail layers",
    description:"Separate neck, chest-pocket and waistband attachments to the same locked mannequin; not selectable 3D accessories yet.",
    typeExamples:["Tie","Pocket square","Belt"],
    detailFamilies:["Placement","Proportion","Material","Colour","Fastening"],
  },
];

export const ACTIVE_GARMENT_CATEGORIES=GARMENT_CATEGORY_LIBRARY.filter((item)=>item.status==="live");
export const PLANNED_GARMENT_CATEGORIES=GARMENT_CATEGORY_LIBRARY.filter((item)=>item.status==="planned");
