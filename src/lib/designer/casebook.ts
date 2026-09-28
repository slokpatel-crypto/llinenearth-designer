import type { DesignerRecommendation, DesignerStyle, OccasionTier } from "@/lib/designer/engine";

export type DesignerCaseVerdict = "approved" | "rejected";

export type DesignerCaseReview = {
  recommendationId: string;
  verdict: DesignerCaseVerdict;
  shirtId: string;
  pantId: string;
  occasion: OccasionTier;
  style: Partial<DesignerStyle>;
  reason?: string;
};

export type DesignerCaseBucket = {
  key: string;
  shirtId: string;
  pantId: string;
  occasion: OccasionTier;
  styleFingerprint: string;
  approved: number;
  rejected: number;
  total: number;
};

export type DesignerCasebook = {
  version: "designer-casebook-v1";
  totalReviews: number;
  usableBuckets: number;
  buckets: DesignerCaseBucket[];
};

export type DesignerCasebookSignal = {
  score: number;
  evidence: number;
  exact: boolean;
  summary: string;
};

type EventLike = {
  type: string;
  source?: string;
  payload?: Record<string,unknown>;
};

const OCCASIONS = new Set<OccasionTier>(["Casual","Smart-Casual","Semi-Formal","Formal"]);
const STYLE_KEYS: Array<keyof DesignerStyle> = [
  "shirtFit","shirtWear","collar","trouser","rise","waistband","break",
];

function cleanText(value:unknown,max=140) {
  return String(value ?? "").trim().slice(0,max);
}

function normalizeStyle(input:unknown):Partial<DesignerStyle> {
  if(!input || typeof input!=="object" || Array.isArray(input)) return {};
  const record=input as Record<string,unknown>;
  const out:Partial<DesignerStyle>={};
  for(const key of STYLE_KEYS) {
    const value=cleanText(record[key],120);
    if(value) out[key]=value;
  }
  return out;
}

export function designerCaseStyleFingerprint(style:Partial<DesignerStyle>) {
  return STYLE_KEYS.map((key)=>`${key}=${cleanText(style[key],120)}`).join("|");
}

export function designerCaseKey(
  shirtId:string,
  pantId:string,
  occasion:OccasionTier,
  style:Partial<DesignerStyle>,
) {
  return [shirtId,pantId,occasion,designerCaseStyleFingerprint(style)].join("::");
}

export function parseDesignerCaseReview(event:EventLike):DesignerCaseReview | null {
  if(event.type!=="operator_note" || event.source!=="operator") return null;
  const payload=event.payload || {};
  if(cleanText(payload.subtype,80)!=="designer_case_review") return null;

  const recommendationId=cleanText(payload.recommendationId,160);
  const verdict=cleanText(payload.verdict,20) as DesignerCaseVerdict;
  const shirtId=cleanText(payload.shirtId,140);
  const pantId=cleanText(payload.pantId,140);
  const occasion=cleanText(payload.occasion,40) as OccasionTier;
  const style=normalizeStyle(payload.style);

  if(!recommendationId || !shirtId || !pantId || !OCCASIONS.has(occasion)) return null;
  if(verdict!=="approved" && verdict!=="rejected") return null;

  return {
    recommendationId,verdict,shirtId,pantId,occasion,style,
    reason:cleanText(payload.reason,120) || undefined,
  };
}

export function aggregateDesignerCasebook(events:EventLike[]):DesignerCasebook {
  // Newest review wins for the same recommendation so operators can correct
  // a previous decision without double-counting it.
  const latest=new Map<string,DesignerCaseReview>();
  for(const event of events) {
    const review=parseDesignerCaseReview(event);
    if(review) latest.set(review.recommendationId,review);
  }

  const buckets=new Map<string,DesignerCaseBucket>();
  for(const review of latest.values()) {
    const key=designerCaseKey(review.shirtId,review.pantId,review.occasion,review.style);
    const current=buckets.get(key) || {
      key,shirtId:review.shirtId,pantId:review.pantId,occasion:review.occasion,
      styleFingerprint:designerCaseStyleFingerprint(review.style),
      approved:0,rejected:0,total:0,
    };
    current[review.verdict==="approved" ? "approved" : "rejected"] += 1;
    current.total += 1;
    buckets.set(key,current);
  }

  const values=[...buckets.values()].sort((a,b)=>b.total-a.total || b.approved-a.approved);
  return {
    version:"designer-casebook-v1",
    totalReviews:latest.size,
    usableBuckets:values.filter((bucket)=>bucket.total>=3).length,
    buckets:values,
  };
}

function clamp(value:number,min:number,max:number) {
  return Math.max(min,Math.min(max,value));
}

function signalFromCounts(approved:number,rejected:number,scale=6) {
  const total=approved+rejected;
  if(total<3) return 0;
  return clamp(((approved-rejected)/total)*scale,-scale,scale);
}

export function casebookSignalFor(
  recommendation:Pick<DesignerRecommendation,"shirt"|"pant"|"occasion"|"style">,
  casebook?:DesignerCasebook | null,
):DesignerCasebookSignal {
  if(!casebook || casebook.totalReviews<3) {
    return {score:0,evidence:casebook?.totalReviews || 0,exact:false,summary:"Casebook is still collecting reviewed outcomes."};
  }

  const exactKey=designerCaseKey(
    recommendation.shirt.id,recommendation.pant.id,recommendation.occasion,recommendation.style,
  );
  const exact=casebook.buckets.find((bucket)=>bucket.key===exactKey && bucket.total>=3);
  if(exact) {
    const score=signalFromCounts(exact.approved,exact.rejected,6);
    return {
      score,evidence:exact.total,exact:true,
      summary:`${exact.total} operator-reviewed exact cases: ${exact.approved} approved, ${exact.rejected} rejected.`,
    };
  }

  const pair=casebook.buckets.filter((bucket)=>
    bucket.total>0 &&
    bucket.shirtId===recommendation.shirt.id &&
    bucket.pantId===recommendation.pant.id &&
    bucket.occasion===recommendation.occasion
  );
  const approved=pair.reduce((sum,bucket)=>sum+bucket.approved,0);
  const rejected=pair.reduce((sum,bucket)=>sum+bucket.rejected,0);
  const total=approved+rejected;
  if(total>=3) {
    const score=signalFromCounts(approved,rejected,4);
    return {
      score,evidence:total,exact:false,
      summary:`${total} operator-reviewed fabric-pair cases for this occasion: ${approved} approved, ${rejected} rejected.`,
    };
  }

  return {score:0,evidence:total,exact:false,summary:"No sufficiently reviewed matching case exists yet."};
}

export function casebookSignalLabel(signal:DesignerCasebookSignal) {
  if(signal.score>=2) return "supports";
  if(signal.score<=-2) return "cautions";
  return "neutral";
}
