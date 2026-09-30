import "server-only";
import {
  DESIGNER_PANTS,
  DESIGNER_SHIRTS,
  designerStyleForOccasion,
  type DesignerContext,
  type OccasionTier,
} from "@/lib/designer/engine";
import { searchDesignerCatalogue } from "@/lib/designer/search";
import { fromLegacyStyle } from "@/lib/designer/style-spec-v2";
import { DEFAULT_BODY_PREVIEW_PROFILE } from "@/lib/designer/body-profile";

export type DesignerPrewarmCandidate={
  id:string;
  occasion:OccasionTier;
  tier:"Safe"|"Elevated"|"Statement";
  shirtId:string;
  pantId:string;
  styleSpec:ReturnType<typeof fromLegacyStyle>;
  bodyProfile:typeof DEFAULT_BODY_PREVIEW_PROFILE;
  reason:string;
};

const scenarios:Array<{occasion:OccasionTier;context:DesignerContext;label:string}>=[
  {occasion:"Formal",context:{climate:"Air-conditioned",intention:"Understated"},label:"formal-office"},
  {occasion:"Semi-Formal",context:{climate:"Air-conditioned",intention:"Balanced"},label:"semi-formal"},
  {occasion:"Smart-Casual",context:{climate:"Hot / humid",intention:"Balanced"},label:"smart-casual-warm"},
  {occasion:"Casual",context:{climate:"Hot / humid",intention:"Balanced"},label:"casual-warm"},
];

export function buildDesignerPrewarmPlan(limit=12):DesignerPrewarmCandidate[] {
  const currentShirt=DESIGNER_SHIRTS[0],currentPant=DESIGNER_PANTS[0];
  if(!currentShirt||!currentPant) return [];
  const out:DesignerPrewarmCandidate[]=[];
  const seen=new Set<string>();
  for(const scenario of scenarios){
    const chosenStyle=designerStyleForOccasion(scenario.occasion);
    const results=searchDesignerCatalogue({
      shirts:DESIGNER_SHIRTS,
      pants:DESIGNER_PANTS,
      currentShirt,
      currentPant,
      occasion:scenario.occasion,
      chosenStyle,
      context:scenario.context,
      scope:"open",
      preference:{wantedTokens:[],avoidTokens:[],strictOccasionFit:true},
    });
    for(const result of results){
      const key=`${result.shirt.id}|${result.pant.id}|${JSON.stringify(result.style)}`;
      if(seen.has(key)) continue;
      seen.add(key);
      out.push({
        id:`${scenario.label}:${result.tier}:${result.shirt.id}:${result.pant.id}`,
        occasion:scenario.occasion,
        tier:result.tier,
        shirtId:result.shirt.id,
        pantId:result.pant.id,
        styleSpec:fromLegacyStyle(result.style),
        bodyProfile:DEFAULT_BODY_PREVIEW_PROFILE,
        reason:`${scenario.label} ${result.tier} direction; deterministic candidate only, no render credit spent.`,
      });
      if(out.length>=Math.max(1,Math.min(30,Math.floor(limit)))) return out;
    }
  }
  return out;
}
