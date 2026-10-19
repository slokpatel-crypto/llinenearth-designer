import type { DesignerStyle, OccasionTier } from "@/lib/designer/engine";
import { SEAT_WAIST_REVIEW_DELTA_CM } from "./measurement-consistency.ts";

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

// Operator log values are untrusted persisted JSON. Coercing arrays or numbers
// to strings (or truncating long IDs) could create apparently valid reviews
// and could merge unrelated records under one shortened ID.
function txt(value:unknown,max=120){
  if(typeof value!=="string"||value.length>max) return "";
  return value.trim();
}
// Learning buckets must not be inferred from malformed or unit-confused
// historical measurements. This is only a software validity guard, not a
// claim that any customer's real body measurements have been verified.
function validBodyCm(value:unknown):value is number {
  return typeof value==="number" && Number.isFinite(value) && value>0 && value<=350;
}
function torsoBucket(chest?:number,waist?:number){
  if(!validBodyCm(chest)||!validBodyCm(waist)) return "unknown" as const;
  const delta=chest-waist;
  return delta>=18 ? "tapered" as const : delta<=6 ? "straight" as const : "balanced" as const;
}
function seatBucket(seat?:number,waist?:number){
  if(!validBodyCm(seat)||!validBodyCm(waist)) return "unknown" as const;
  // A finite tape reading can still contradict the existing tailor-review
  // check. Never learn a confident seat class from an unreviewed extreme
  // seat-waist discrepancy; preserve the independently valid torso bucket.
  if(Math.abs(seat-waist)>SEAT_WAIST_REVIEW_DELTA_CM) return "unknown" as const;
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
  // Operator logs are persisted JSON: reject arrays, nulls and primitives
  // before dereferencing a field or treating corrupt records as fit evidence.
  if(!event||typeof event!=="object"||Array.isArray(event)
    ||event.type!=="operator_note"||event.source!=="operator") return null;
  const p=event.payload;
  if(!p||typeof p!=="object"||Array.isArray(p)) return null;
  if(txt(p.subtype,80)!=="designer_fit_outcome") return null;
  const recommendationId=txt(p.recommendationId,160);
  const verdict=txt(p.verdict,40) as FitOutcomeVerdict;
  const occasion=txt(p.occasion,40) as OccasionTier;
  const shirtFit=txt(p.shirtFit,120);
  const trouser=txt(p.trouser,120);
  const torso=txt(p.torso,30) as FitOutcomeReview["proportion"]["torso"];
  const seat=txt(p.seat,30) as FitOutcomeReview["proportion"]["seat"];
  // Filtering/truncating bad area entries silently changes the operator's
  // actual fitting record. Keep legacy omitted area lists, but fail closed
  // for any malformed, oversized or duplicate explicitly supplied list.
  if(p.areas!==undefined && !Array.isArray(p.areas)) return null;
  const rawAreas=p.areas===undefined ? [] : p.areas as unknown[];
  if(rawAreas.length>10) return null;
  const areas=rawAreas.map((value)=>txt(value,40) as FitOutcomeArea);
  if(areas.some((area)=>!AREAS.has(area))||new Set(areas).size!==areas.length) return null;
  if(!recommendationId||!VERDICTS.has(verdict)||!OCCASIONS.has(occasion)||!shirtFit||!trouser) return null;
  // IDs and style labels are persisted join keys, not display text. Trimming
  // them would merge two independently recorded reviews into one identity.
  if(p.recommendationId!==recommendationId||p.shirtFit!==shirtFit||p.trouser!==trouser) return null;
  // Keys are historically persisted as ::-joined fields. Do not allow a
  // delimiter inside a field to collide with a distinct style's bucket key.
  if(shirtFit.includes("::")||trouser.includes("::")) return null;
  if(!["tapered","balanced","straight","unknown"].includes(torso)) return null;
  if(!["pronounced","balanced","unknown"].includes(seat)) return null;
  return {recommendationId,verdict,occasion,shirtFit,trouser,proportion:{torso,seat},areas};
}

export function aggregateFitOutcomes(events:EventLike[]):FitOutcomeBook{
  const latest=new Map<string,FitOutcomeReview>();
  for(const event of events){
    const review=parseFitOutcome(event);
    if(review){
      latest.set(review.recommendationId,review);
      continue;
    }
    // The operator log is append-only and an updated fitting note replaces
    // earlier notes for the same recommendation. A later malformed edit must
    // revoke the older score, not silently resurrect favorable old evidence.
    // Only a canonical, identifiable fitting event can revoke a review;
    // unrelated notes and records without a usable ID remain ignored.
    if(!event||typeof event!=="object"||Array.isArray(event)
      ||event.type!=="operator_note"||event.source!=="operator") continue;
    const payload=event.payload;
    if(!payload||typeof payload!=="object"||Array.isArray(payload)
      ||txt(payload.subtype,80)!=="designer_fit_outcome") continue;
    const id=payload.recommendationId;
    if(typeof id==="string"&&id.length>0&&id.length<=160&&id===id.trim()) latest.delete(id);
  }
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

/**
 * Stored/operator-provided aggregates may be stale, edited or malformed.
 * Corrupt counters must never manufacture evidence for a cutting recipe.
 * This is numerical trust only, NOT approval of customer measurements.
 */
function reliableFitOutcomeBucket(value:unknown, totalReviews:number):value is FitOutcomeBucket{
  if(!value||typeof value!=="object") return false;
  const bucket=value as FitOutcomeBucket;
  if(!OCCASIONS.has(bucket.occasion)
    ||typeof bucket.shirtFit!=="string"||!bucket.shirtFit.trim()||bucket.shirtFit.length>120
    ||typeof bucket.trouser!=="string"||!bucket.trouser.trim()||bucket.trouser.length>120
    ||bucket.shirtFit!==bucket.shirtFit.trim()||bucket.trouser!==bucket.trouser.trim()
    ||bucket.shirtFit.includes("::")||bucket.trouser.includes("::")
    ||!["tapered","balanced","straight","unknown"].includes(bucket.torso)
    ||!["pronounced","balanced","unknown"].includes(bucket.seat)
    ||bucket.key!==fitOutcomeKey(bucket)) return false;
  if(![bucket.clean,bucket.minor,bucket.major,bucket.total].every(
    (count)=>Number.isSafeInteger(count)&&count>=0
  )) return false;
  return bucket.total>0&&bucket.total<=totalReviews
    &&bucket.clean+bucket.minor+bucket.major===bucket.total;
}

export function fitOutcomeSignalFor(
  input:{occasion:OccasionTier;style:Pick<DesignerStyle,"shirtFit"|"trouser">;proportion:{torso:string;seat:string}},
  book?:FitOutcomeBook|null,
):FitOutcomeSignal{
  // Saved designer drafts and imported inputs are untrusted at runtime.
  // Reject ambiguous delimiter-joined fields and malformed proportions rather
  // than treating unsupported candidate identity as reviewable fit evidence.
  if(!input||!input.style||!input.proportion||!OCCASIONS.has(input.occasion)
    ||typeof input.style.shirtFit!=="string"||txt(input.style.shirtFit)!==input.style.shirtFit
    ||!input.style.shirtFit||input.style.shirtFit.includes("::")
    ||typeof input.style.trouser!=="string"||txt(input.style.trouser)!==input.style.trouser
    ||!input.style.trouser||input.style.trouser.includes("::")
    ||!["tapered","balanced","straight","unknown"].includes(input.proportion.torso)
    ||!["pronounced","balanced","unknown"].includes(input.proportion.seat)){
    return {score:0,evidence:0,summary:"Candidate style fields require revalidation."};
  }
  if(!book||book.version!=="designer-fit-outcomes-v1"
    ||!Number.isSafeInteger(book.totalReviews)||book.totalReviews<0
    ||!Number.isSafeInteger(book.usableBuckets)||book.usableBuckets<0
    ||!Array.isArray(book.buckets)) return {score:0,evidence:0,summary:"Post-fitting evidence is still collecting."};
  // Never drop malformed rows and then award confidence from the remaining
  // data: the aggregate itself may have been tampered with or partially
  // corrupted. Preserve the stored record, but require operator revalidation.
  if(book.buckets.some((bucket)=>!reliableFitOutcomeBucket(bucket,book.totalReviews))
    ||book.usableBuckets!==book.buckets.filter((bucket)=>bucket.total>=3).length){
    return {score:0,evidence:0,summary:"Stored fitting totals require operator revalidation."};
  }
  const trustworthy=book.buckets;
  // Every independently valid bucket can still be part of an impossible
  // *collection*. A persisted duplicate key or two disjoint groups claiming
  // more completed fittings than the book has reviews must not double-count
  // the same customer's outcome or inflate fit confidence.
  const keys=new Set<string>();
  let represented=0;
  for(const bucket of trustworthy){
    if(keys.has(bucket.key)||bucket.total>book.totalReviews-represented){
      return {score:0,evidence:0,summary:"Stored fitting totals require operator revalidation."};
    }
    keys.add(bucket.key);
    represented+=bucket.total;
  }
  // The aggregation contract emits exactly one bucket for every unique
  // validated fitting review. A persisted book claiming more reviews than the
  // sum of its buckets is incomplete or has fabricated summary metadata.
  // Neither case permits a score: hidden/missing reviews might contradict
  // the apparently clean matching group.
  if(represented!==book.totalReviews){
    return {score:0,evidence:0,summary:"Stored fitting totals require operator revalidation."};
  }
  // Even a small book must pass this complete-record reconciliation before
  // its review count can appear as evidence.
  if(book.totalReviews<3) return {score:0,evidence:book.totalReviews,summary:"Post-fitting evidence is still collecting."};
  const key=fitOutcomeKey({occasion:input.occasion,shirtFit:input.style.shirtFit,trouser:input.style.trouser,torso:input.proportion.torso,seat:input.proportion.seat});
  const bucket=trustworthy.find((b)=>b.key===key&&b.total>=3);
  if(bucket) {
    const quality=(bucket.clean + bucket.minor*.35 - bucket.major)/bucket.total;
    const score=Math.max(-4,Math.min(4,Math.round(quality*4*10)/10));
    return {score,evidence:bucket.total,summary:`${bucket.total} reviewed fittings: ${bucket.clean} clean first fits, ${bucket.minor} minor alterations, ${bucket.major} major alterations.`};
  }

  // If the exact body-proportion bucket is still sparse, a larger style-level
  // sample may break ties only. It is deliberately capped below the exact signal.
  // A stored "unknown" proportion comes from missing or invalid body measurements.
  // It is not a physical match for an independently known customer shape, so
  // it must not boost a style-level fit recommendation for measured customers.
  // Known-but-different proportions can still provide a *weak* cut-family tie-break.
  const related=trustworthy.filter((b)=>b.occasion===input.occasion
    && b.shirtFit===input.style.shirtFit&&b.trouser===input.style.trouser
    && (input.proportion.torso==="unknown" || b.torso!=="unknown")
    && (input.proportion.seat==="unknown" || b.seat!=="unknown"));
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
