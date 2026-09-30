export type Provenance="owner-provided"|"reference-source"|"provisional";
export type ReviewStatus="provisional"|"approved";
export type RenderSupport="exact"|"approximate"|"none";
export type ClimateTag="hot_humid"|"cool"|"air_conditioned"|"all";

export type GarmentOptionGroup=
  |"shirt.type"|"shirt.collar"|"shirt.cuff"|"shirt.placket"|"shirt.pocket"
  |"shirt.sleeve"|"shirt.fit"|"shirt.length"|"shirt.hem"|"shirt.back"|"shirt.wear"|"shirt.button"
  |"pant.type"|"pant.fit"|"pant.rise"|"pant.waistband"|"pant.pleat"
  |"pant.leg"|"pant.hem"|"pant.break";

export interface GarmentOption {
  id:string;
  legacyLabel?:string;
  group:GarmentOptionGroup;
  label:string;
  description:string;
  formality:1|2|3|4|5|null;
  formalityNullReason?:string;
  climateTags:ClimateTag[];
  pairsWith?:string[];
  avoidWith?:string[];
  parameters:Record<string,number|string|boolean>;
  renderSupport:{livePreview:RenderSupport;aiRender:RenderSupport};
  provenance:Provenance;
  reviewStatus:ReviewStatus;
  sourceUrl?:string;
  legacySelectable?:boolean;
}
