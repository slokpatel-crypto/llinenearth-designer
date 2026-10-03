import { DESIGNER_STYLE_CHOICES, type OccasionTier } from "./engine.ts";
import { isDesignerFeedbackReason } from "./outcome-learning.ts";

export type LocalDesignerTasteProfile={version:1;evidence:number;preferredTier?:"Safe"|"Elevated"|"Statement";preferredShirtWear?:"Tucked"|"Untucked";preferredTrouser?:string};
type TasteEvent={type:string;source?:string;payload?:Record<string,unknown>};

/** One latest human judgement per recommendation, scoped to its occasion.
 * Saving, selecting, rendering and automated QA are not endorsements. */
export function aggregateDesignerTaste(events:TasteEvent[],occasion?:OccasionTier):LocalDesignerTasteProfile {
  const latest=new Map<string,Record<string,unknown>>();
  for(const event of events.slice(-240)) {
    if(event.type!=="designer_feedback" || event.source && event.source!=="style-director") continue;
    const payload=event.payload || {};
    if(payload.creativeVisualCheck || payload.automatic===true || payload.origin==="automatic") continue;
    const id=typeof payload.recommendationId==="string" ? payload.recommendationId : "";
    if(!id || occasion && payload.occasion!==occasion) continue;
    if(!["up","down"].includes(String(payload.rating))) continue;
    if(payload.reason && !isDesignerFeedbackReason(String(payload.reason))) continue;
    latest.set(id,payload);
  }
  const tier={Safe:0,Elevated:0,Statement:0}, wear={Tucked:0,Untucked:0}, trousers=new Map<string,number>();
  const distinctRecipes=new Map<string,Record<string,unknown>>();
  for(const [id,payload] of latest) {
    const style=payload.style as Record<string,unknown>|undefined;
    const complete=style && Object.entries(DESIGNER_STYLE_CHOICES).every(([key,choices])=>typeof style[key]==="string" && choices.includes(style[key] as string));
    const recipe=complete && payload.shirtId && payload.pantId ? JSON.stringify([payload.occasion,payload.shirtId,payload.pantId,payload.creativeConceptId||"",Object.keys(DESIGNER_STYLE_CHOICES).map((key)=>style[key])]) : id;
    distinctRecipes.set(recipe,payload);
  }
  let evidence=0;
  for(const payload of distinctRecipes.values()) {
    const style=payload.style && typeof payload.style==="object" && !Array.isArray(payload.style) ? payload.style as Record<string,unknown> : {};
    if(payload.rating==="down" && !payload.reason && !payload.note && !payload.creativeReason) continue;
    evidence++;
    if(payload.rating==="up") {
      if(style.shirtWear==="Tucked" || style.shirtWear==="Untucked") wear[style.shirtWear]+=2;
      if(typeof style.trouser==="string" && DESIGNER_STYLE_CHOICES.trouser.includes(style.trouser)) trousers.set(style.trouser,(trousers.get(style.trouser)||0)+2);
    } else {
      if(payload.reason==="too_bold") tier.Safe+=2;
      if(payload.reason==="too_safe") tier.Statement+=2;
    }
  }
  const profile:LocalDesignerTasteProfile={version:1,evidence};
  if(evidence<4) return profile;
  const winner=(values:Array<[string,number]>)=>{
    const sorted=values.sort((a,b)=>b[1]-a[1]);
    return sorted[0]?.[1]>=4 && sorted[0][1]-(sorted[1]?.[1]||0)>=2 ? sorted[0][0] : undefined;
  };
  profile.preferredTier=winner(Object.entries(tier)) as LocalDesignerTasteProfile["preferredTier"];
  profile.preferredShirtWear=winner(Object.entries(wear)) as LocalDesignerTasteProfile["preferredShirtWear"];
  profile.preferredTrouser=winner([...trousers]);
  return profile;
}
