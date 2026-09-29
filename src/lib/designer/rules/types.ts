import type { DesignerClimate, OccasionTier } from "../engine.ts";
import type { StyleSpecV2 } from "../style-spec-v2.ts";

export type CrossRuleEffect="penalty"|"bonus"|"block";
export type CrossRuleSeverity="Low"|"Medium"|"High";
export type CrossRuleProvenance="owner-provided"|"reference-source"|"provisional";
export type CrossRuleReviewStatus="provisional"|"approved";

export type CrossGarmentRuleContext={
  spec:StyleSpecV2;
  occasion:OccasionTier;
  climate:DesignerClimate;
  shirtPatternScale?:string|null;
  pantPatternScale?:string|null;
  shirtPatternContrast?:string|null;
  pantPatternContrast?:string|null;
  shirtWeightClass?:string|null;
  pantWeightClass?:string|null;
  shirtDrapeVerified?:boolean;
  pantDrapeVerified?:boolean;
};

export type CrossGarmentRule={
  id:string;
  name:string;
  appliesWhen:(context:CrossGarmentRuleContext)=>boolean;
  effect:CrossRuleEffect;
  severity:CrossRuleSeverity;
  explanation:(context:CrossGarmentRuleContext)=>string;
  provenance:CrossRuleProvenance;
  reviewStatus:CrossRuleReviewStatus;
};

export type CrossGarmentRuleResult={
  ruleId:string;
  effect:CrossRuleEffect;
  severity:CrossRuleSeverity;
  explanation:string;
  provenance:CrossRuleProvenance;
  reviewStatus:CrossRuleReviewStatus;
};
