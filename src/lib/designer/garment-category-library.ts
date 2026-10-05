export type GarmentCategoryStatus="live"|"planned";

export type GarmentCategoryDefinition={
  id:"shirt"|"trouser"|"blazer"|"suit";
  label:string;
  status:GarmentCategoryStatus;
  stageLabel:string;
  description:string;
  detailFamilies:string[];
};

export const GARMENT_CATEGORY_LIBRARY:GarmentCategoryDefinition[]=[
  {
    id:"shirt",
    label:"Shirt",
    status:"live",
    stageLabel:"3D foundation live",
    description:"Fabric is mapped now. Construction controls stay owned by Designer until the production shirt mesh can express them exactly.",
    detailFamilies:["Collar","Cuff","Placket","Fit","Sleeve","Pocket","Buttons"],
  },
  {
    id:"trouser",
    label:"Trouser",
    status:"live",
    stageLabel:"3D foundation live",
    description:"Fabric is mapped now. Trouser construction will progressively move from preview rules into the production 3D garment block.",
    detailFamilies:["Rise","Pleats","Leg shape","Waistband","Break","Pocket","Fit"],
  },
  {
    id:"blazer",
    label:"Blazer",
    status:"planned",
    stageLabel:"Future garment block",
    description:"Prepared as a separate garment family so blazer construction does not get forced into the shirt or trouser model.",
    detailFamilies:["Lapel","Breast style","Button stance","Vent","Pocket","Length","Shoulder"],
  },
  {
    id:"suit",
    label:"Suit",
    status:"planned",
    stageLabel:"Future coordinated look",
    description:"Planned as a linked jacket-and-trouser system with shared fabric, proportion and formality rules.",
    detailFamilies:["Jacket","Trouser","Lapel","Vent","Waistcoat","Button stance","Trouser pairing"],
  },
];

export const ACTIVE_GARMENT_CATEGORIES=GARMENT_CATEGORY_LIBRARY.filter((item)=>item.status==="live");
export const PLANNED_GARMENT_CATEGORIES=GARMENT_CATEGORY_LIBRARY.filter((item)=>item.status==="planned");
