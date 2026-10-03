import { DESIGNER_STYLE_CHOICES, type OccasionTier } from "./engine.ts";
import { isDesignerFeedbackReason } from "./outcome-learning.ts";
import { parseDesignerConstructionIntent } from "./construction-intent.ts";
import type { DesignerStyle } from "./engine.ts";

export type LocalDesignerTasteProfile={version:1;evidence:number;preferredTier?:"Safe"|"Elevated"|"Statement";preferredShirtWear?:"Tucked"|"Untucked";preferredTrouser?:string;preferredConstruction?:Partial<DesignerStyle>;signals?:Array<{key:string;value:string;reviews:number;support:number;opposition:number}>};
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
  const tier={Safe:0,Elevated:0,Statement:0};
  let tierReviews=0;
  const choices=new Map<keyof DesignerStyle,Map<string,{support:number;opposition:number}>>();
  const record=(key:keyof DesignerStyle,value:unknown,positive:boolean)=>{
    if(typeof value!=="string" || !DESIGNER_STYLE_CHOICES[key].includes(value)) return;
    const group=choices.get(key) || new Map<string,{support:number;opposition:number}>();
    const tally=group.get(value) || {support:0,opposition:0};
    if(positive) tally.support++;else tally.opposition++;
    group.set(value,tally);choices.set(key,group);
  };
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
      for(const key of Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>) record(key,style[key],true);
    } else {
      if(payload.reason==="too_bold") {tier.Safe+=2;tierReviews++;}
      if(payload.reason==="too_safe") {tier.Statement+=2;tierReviews++;}
      const targeted:Array<keyof DesignerStyle>=payload.reason==="fit_cut"?["shirtFit"]:payload.reason==="trouser_shape"?["trouser"]:[];
      if(payload.reason==="construction") {
        const patch=parseDesignerConstructionIntent(String(payload.note || "")).patch;
        for(const key of Object.keys(patch) as Array<keyof DesignerStyle>) if(patch[key]!==style[key]) targeted.push(key);
      }
      for(const key of targeted) record(key,style[key],false);
    }
  }
  const profile:LocalDesignerTasteProfile={version:1,evidence};
  if(evidence<4) return profile;
  const winner=(values:Array<[string,number]>)=>{
    const sorted=values.sort((a,b)=>b[1]-a[1]);
    return sorted[0]?.[1]>=4 && sorted[0][1]-(sorted[1]?.[1]||0)>=2 ? sorted[0][0] : undefined;
  };
  if(tierReviews>=4) profile.preferredTier=winner(Object.entries(tier)) as LocalDesignerTasteProfile["preferredTier"];
  const preferredConstruction:Partial<DesignerStyle>={},signals:NonNullable<LocalDesignerTasteProfile["signals"]>=[];
  for(const [key,values] of choices) {
    const reviews=[...values.values()].reduce((sum,t)=>sum+t.support+t.opposition,0);
    if(reviews<4) continue;
    const ranked=[...values].sort((a,b)=>(b[1].support-b[1].opposition)-(a[1].support-a[1].opposition));
    const [value,tally]=ranked[0];
    const net=tally.support-tally.opposition,runner=ranked[1]?(ranked[1][1].support-ranked[1][1].opposition):0;
    if(tally.support<3 || net<2 || net-runner<2) continue;
    preferredConstruction[key]=value;signals.push({key,value,reviews,support:tally.support,opposition:tally.opposition});
  }
  // Older v1 consumers still receive the legacy fields; new consumers use the
  // independently evidenced construction choices rather than broad click counts.
  if(Object.keys(preferredConstruction).length) profile.preferredConstruction=preferredConstruction;
  profile.preferredShirtWear=preferredConstruction.shirtWear as LocalDesignerTasteProfile["preferredShirtWear"];
  profile.preferredTrouser=preferredConstruction.trouser;
  if(signals.length) profile.signals=signals;
  return profile;
}
