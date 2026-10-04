import { DEFAULT_CRAFT_PREFERENCES, validCraftPreferences, validCreativeCraft, type CraftPreferences, type CreativeCraftSpec } from "./creative-spec.ts";
import { aggregateCreativeLearning } from "./creative-learning.ts";

export type CreativeProfileEvent={type:string;payload:Record<string,unknown>;received_at?:string};
export type CreativePersonalReview={conceptId:string;familyId:string;rating:"up"|"down";reason:string;craft:CreativeCraftSpec};
export function creativePersonalContext(events:CreativeProfileEvent[],owner:string) {
  const owned=events.filter(e=>e.payload.customerId===owner);
  const settings=[...owned].reverse().find(e=>e.type==="customer_updated"&&e.payload.subtype==="designer_creative_profile");
  const preferences:CraftPreferences=validCraftPreferences(settings?.payload.preferences)?settings.payload.preferences:{...DEFAULT_CRAFT_PREFERENCES};
  const resetAt=typeof settings?.payload.resetAt==="string"?settings.payload.resetAt:"";
  const latest=new Map<string,CreativeProfileEvent>();
  for(const event of owned){
    if(event.type!=="designer_feedback"||event.payload.subtype!=="designer_creative_personal_feedback"||(resetAt&&(!event.received_at||event.received_at<=resetAt)))continue;
    latest.set(String(event.payload.creativeConceptId),event);
  }
  const reviews=[...latest.values()], tasteReviews=reviews.filter(r=>r.payload.creativeReason!=="render_mismatch"), learning=aggregateCreativeLearning(preferences.enabled?tasteReviews:[]);
  // Explicit preferences win. At least three independent human judgements
  // are needed before an automatic feature preference changes generation.
  const effective={...preferences}, surfaceScores=new Map<string,number>(),motifScores=new Map<string,number>();
  if(preferences.enabled&&tasteReviews.length>=3)for(const e of tasteReviews){
    if(!validCreativeCraft(e.payload.craft)||e.payload.creativeReason==="render_mismatch")continue;
    const d=e.payload.craft.decoration,score=e.payload.rating==="up"?1:-1;
    const surface=d?.technique||"plain";
    surfaceScores.set(surface,(surfaceScores.get(surface)||0)+score);
    if(d)motifScores.set(d.motif,(motifScores.get(d.motif)||0)+score);
  }
  const winner=(scores:Map<string,number>)=>[...scores].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).find(([,n])=>n>=2)?.[0];
  if(effective.surface==="auto")effective.surface=(winner(surfaceScores)||"auto") as CraftPreferences["surface"];
  if(effective.motif==="auto")effective.motif=(winner(motifScores)||"auto") as CraftPreferences["motif"];
  return {preferences,effective,learning,reviewCount:reviews.length,resetAt};
}
