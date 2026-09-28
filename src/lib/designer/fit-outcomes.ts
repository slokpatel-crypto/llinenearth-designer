import type { DesignerStyle, OccasionTier } from "@/lib/designer/engine";

export type FitOutcomeVerdict = "clean_first_fit" | "minor_alteration" | "major_alteration";
export type FitOutcomeArea =
  | "shirt_chest" | "shirt_waist" | "shirt_shoulder" | "shirt_sleeve" | "shirt_collar"
  | "trouser_waist" | "trouser_seat" | "trouser_thigh" | "trouser_rise" | "trouser_length";

export type FitOutcomeReview = {
  recommendationId:string;
  verdict:FitOutcomeVerdict;
  occasion:OccasionTier;
  shirtFit:string;
  trouser:string;
  proportion:{
    torso:"tapered"|"balanced"|"straight"|"unknown";
    seat:"pronounced"|"balanced"|"unknown";
  };
  areas:FitOutcomeArea[];
};

export type FitOutcomeBucket = {
  key:string;
  occasion:OccasionTier;
  shirtFit:string;
  trouser:string;
  torso:string;
  seat:string;
  clean:number;
  minor:number;
  major:number;
  total:number;
};

export type FitOutcomeBook = {
  version:"designer-fit-outcomes-v1";
  totalReviews:number;
  usableBuckets:number;
  buckets:FitOutcomeBucket[];
};

export type FitOutcomeSignal = {
  score:number;
  evidence:number;
  summary:string;
};

type EventLike={type:string;source?:string;payload?:Record<string,unknown>};

const OCCASIONS=new Set<OccasionTier>(["Casual","Smart-Casual","Semi-Formal","Formal"]);
const VERDICTS=new Set<FitOutcomeVerdict>(["clean_first_fit","minor_alteration","major_alteration"]);
const AREAS=new Set<FitOutcomeArea>([
  "shirt_chest","shirt_waist","shirt_shoulder","shirt_sleeve","shirt_collar",
  "trouser_waist","trouser_seat","trouser_thigh","trouser_rise","trouser_length",
]);

function txt(value:unknown,max=120){return String(value??"").trim().slice(0,max);}
function torsoBucket(chest?:number,waist?:number){
  if(!chest||!waist) return "unknown" as const;
  const delta=chest-waist;
  return delta>=18 ? "tapered" as const : delta<=6 ? "straight" as const : "balanced" as const;
}
function seatBucket(seat?:number,waist?:number){
  if(!seat||!waist) return "unknown" as const;
  return seat-waist>=24 ? "pronounced" as const : "balanced" as const;
}

export function fitOutcomeProportionFromMeasurements(measurements?:{
  shirt?:{chest?:number;waist?:number};
  pants?:{waist?:number;seat?:number};
}|null){
  return {
    torso:torsoBucket(measurements?.shirt?.chest,measurements?.shirt?.waist),
    seat:seatBucket(measurements?.pants?.seat,measurements?.pants?.waist),
  };
}

export function fitOutcomeKey(input:{
  occasion:OccasionTier; shirtFit:string; trouser:string; torso:string; seat:string;
}){
  return [input.occasion,input.shirtFit,input.trouser,input.torso,input.seat].join("::");
}

export function parseFitOutcome(event:EventLike):FitOutcomeReview|null{
  if(event.type!=="operator_note"||event.source!=="operator") return null;
  const p=event.payload||{};
  if(txt(p.subtype,80)!=="designer_fit_outcome") return null;
  const recommendationId=txt(p.recommendationId,160);
  const verdict=txt(p.verdict,40) as FitOutcomeVerdict;
  const occasion=txt(p.occasion,40) as OccasionTier;
  const shirtFit=txt(p.shirtFit,120);
  const trouser=txt(p.trouser,120);
  const torso=txt(p.torso,30) as FitOutcomeReview["proportion"]["torso"];
  const seat=txt(p.seat,30) as FitOutcomeReview["proportion"]["seat"];
  const areas=Array.isArray(p.areas)
    ? p.areas.map((value)=>txt(value,40) as FitOutcomeArea).filter((value)=>AREAS.has(value)).slice(0,10)
    : [];
  if(!recommendationId||!VERDICTS.has(verdict)||!OCCASIONS.has(occasion)||!shirtFit||!trouser) return null;
  if(!["tapered","balanced","straight","unknown"].includes(torso)) return null;
  if(!["pronounced","balanced","unknown"].includes(seat)) return null;
  return {recommendationId,verdict,occasion,shirtFit,trouser,proportion:{torso,seat},areas};
}

export function aggregateFitOutcomes(events:EventLike[]):FitOutcomeBook{
  const latest=new Map<string,FitOutcomeReview>();
  for(const event of events){const review=parseFitOutcome(event);if(review) latest.set(review.recommendationId,review);}
  const buckets=new Map<string,FitOutcomeBucket>();
  for(const review of latest.values()){
    const key=fitOutcomeKey({occasion:review.occasion,shirtFit:review.shirtFit,trouser:review.trouser,torso:review.proportion.torso,seat:review.proportion.seat});
    const current=buckets.get(key)||{key,occasion:review.occasion,shirtFit:review.shirtFit,trouser:review.trouser,torso:review.proportion.torso,seat:review.proportion.seat,clean:0,minor:0,major:0,total:0};
    if(review.verdict==="clean_first_fit") current.clean+=1;
    else if(review.verdict==="minor_alteration") current.minor+=1;
    else current.major+=1;
    current.total+=1;buckets.set(key,current);
  }
  const values=[...buckets.values()].sort((a,b)=>b.total-a.total||b.clean-a.clean);
  return {version:"designer-fit-outcomes-v1",totalReviews:latest.size,usableBuckets:values.filter((b)=>b.total>=3).length,buckets:values};
}

export function fitOutcomeSignalFor(
  input:{occasion:OccasionTier;style:Pick<DesignerStyle,"shirtFit"|"trouser">;proportion:{torso:string;seat:string}},
  book?:FitOutcomeBook|null,
):FitOutcomeSignal{
  if(!book||book.totalReviews<3) return {score:0,evidence:book?.totalReviews||0,summary:"Post-fitting evidence is still collecting."};
  const key=fitOutcomeKey({occasion:input.occasion,shirtFit:input.style.shirtFit,trouser:input.style.trouser,torso:input.proportion.torso,seat:input.proportion.seat});
  const bucket=book.buckets.find((b)=>b.key===key&&b.total>=3);
  if(bucket) {
    const quality=(bucket.clean + bucket.minor*.35 - bucket.major)/bucket.total;
    const score=Math.max(-4,Math.min(4,Math.round(quality*4*10)/10));
    return {score,evidence:bucket.total,summary:`${bucket.total} reviewed fittings: ${bucket.clean} clean first fits, ${bucket.minor} minor alterations, ${bucket.major} major alterations.`};
  }

  // If the exact body-proportion bucket is still sparse, a larger style-level
  // sample may break ties only. It is deliberately capped below the exact signal.
  const related=book.buckets.filter((b)=>b.occasion===input.occasion&&b.shirtFit===input.style.shirtFit&&b.trouser===input.style.trouser);
  const clean=related.reduce((sum,b)=>sum+b.clean,0);
  const minor=related.reduce((sum,b)=>sum+b.minor,0);
  const major=related.reduce((sum,b)=>sum+b.major,0);
  const total=clean+minor+major;
  if(total>=4) {
    const quality=(clean + minor*.35 - major)/total;
    const score=Math.max(-2.5,Math.min(2.5,Math.round(quality*2.5*10)/10));
    return {score,evidence:total,summary:`${total} reviewed fittings for this cut family: ${clean} clean first fits, ${minor} minor alterations, ${major} major alterations.`};
  }
  return {score:0,evidence:total,summary:"No sufficiently reviewed matching first-fit pattern exists yet."};
}
