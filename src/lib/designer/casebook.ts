import type { DesignerRecommendation, DesignerStyle, OccasionTier } from "@/lib/designer/engine";

export type DesignerCaseVerdict = "approved" | "rejected" | "adjusted";

export type DesignerCaseReview = {
  recommendationId: string;
  verdict: DesignerCaseVerdict;
  shirtId: string;
  pantId: string;
  occasion: OccasionTier;
  style: Partial<DesignerStyle>;
  reason?: string;
  replacement?: {
    recommendationId: string;
    shirtId: string;
    pantId: string;
    occasion: OccasionTier;
    style: Partial<DesignerStyle>;
  };
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

export type DesignerCaseCorrection = {
  fromKey: string;
  toKey: string;
  count: number;
};

export type DesignerCasebook = {
  version: "designer-casebook-v1";
  totalReviews: number;
  usableBuckets: number;
  usableCorrections: number;
  buckets: DesignerCaseBucket[];
  corrections: DesignerCaseCorrection[];
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
  if(verdict!=="approved" && verdict!=="rejected" && verdict!=="adjusted") return null;

  let replacement:DesignerCaseReview["replacement"];
  if(verdict==="adjusted") {
    const raw=payload.replacement;
    if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
    const record=raw as Record<string,unknown>;
    const replacementId=cleanText(record.recommendationId,160);
    const replacementShirt=cleanText(record.shirtId,140);
    const replacementPant=cleanText(record.pantId,140);
    const replacementOccasion=cleanText(record.occasion,40) as OccasionTier;
    const replacementStyle=normalizeStyle(record.style);
    if(!replacementId || !replacementShirt || !replacementPant || !OCCASIONS.has(replacementOccasion)) return null;
    replacement={
      recommendationId:replacementId,
      shirtId:replacementShirt,
      pantId:replacementPant,
      occasion:replacementOccasion,
      style:replacementStyle,
    };
  }

  return {
    recommendationId,verdict,shirtId,pantId,occasion,style,
    reason:cleanText(payload.reason,120) || undefined,
    ...(replacement ? {replacement} : {}),
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
  const corrections=new Map<string,DesignerCaseCorrection>();

  function addObservation(
    shirtId:string,pantId:string,occasion:OccasionTier,style:Partial<DesignerStyle>,
    verdict:"approved"|"rejected",
  ) {
    const key=designerCaseKey(shirtId,pantId,occasion,style);
    const current=buckets.get(key) || {
      key,shirtId,pantId,occasion,
      styleFingerprint:designerCaseStyleFingerprint(style),
      approved:0,rejected:0,total:0,
    };
    current[verdict] += 1;
    current.total += 1;
    buckets.set(key,current);
    return key;
  }

  for(const review of latest.values()) {
    if(review.verdict==="approved" || review.verdict==="rejected") {
      addObservation(review.shirtId,review.pantId,review.occasion,review.style,review.verdict);
      continue;
    }

    // An adjusted case is one explicit human comparison: the original is a
    // rejected observation and the operator's replacement is an approved one.
    const fromKey=addObservation(review.shirtId,review.pantId,review.occasion,review.style,"rejected");
    if(review.replacement) {
      const toKey=addObservation(
        review.replacement.shirtId,review.replacement.pantId,
        review.replacement.occasion,review.replacement.style,"approved",
      );
      const correctionKey=`${fromKey}=>${toKey}`;
      const correction=corrections.get(correctionKey) || {fromKey,toKey,count:0};
      correction.count += 1;
      corrections.set(correctionKey,correction);
    }
  }

  const values=[...buckets.values()].sort((a,b)=>b.total-a.total || b.approved-a.approved);
  const correctionValues=[...corrections.values()].sort((a,b)=>b.count-a.count);
  return {
    version:"designer-casebook-v1",
    totalReviews:latest.size,
    usableBuckets:values.filter((bucket)=>bucket.total>=3).length,
    usableCorrections:correctionValues.filter((item)=>item.count>=2).length,
    buckets:values,
    corrections:correctionValues,
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

export function casebookCorrectionSignalFor(
  from:Pick<DesignerRecommendation,"shirt"|"pant"|"occasion"|"style">,
  to:Pick<DesignerRecommendation,"shirt"|"pant"|"occasion"|"style">,
  casebook?:DesignerCasebook | null,
):DesignerCasebookSignal {
  if(!casebook || casebook.totalReviews<2) {
    return {score:0,evidence:casebook?.totalReviews || 0,exact:false,summary:"Correction memory is still collecting operator comparisons."};
  }

  const fromKey=designerCaseKey(from.shirt.id,from.pant.id,from.occasion,from.style);
  const toKey=designerCaseKey(to.shirt.id,to.pant.id,to.occasion,to.style);
  const exact=casebook.corrections.find((item)=>item.fromKey===fromKey && item.toKey===toKey);
  if(exact && exact.count>=2) {
    const score=clamp(exact.count>=4 ? 3 : 2,-3,3);
    return {
      score,evidence:exact.count,exact:true,
      summary:`${exact.count} operator corrections preferred this exact replacement.`,
    };
  }

  const fromPair=`${from.shirt.id}::${from.pant.id}::${from.occasion}::`;
  const toPair=`${to.shirt.id}::${to.pant.id}::${to.occasion}::`;
  const pairCount=casebook.corrections
    .filter((item)=>item.fromKey.startsWith(fromPair) && item.toKey.startsWith(toPair))
    .reduce((sum,item)=>sum+item.count,0);
  if(pairCount>=3) {
    return {
      score:2,evidence:pairCount,exact:false,
      summary:`${pairCount} operator corrections preferred this fabric-pair replacement for the occasion.`,
    };
  }

  return {score:0,evidence:pairCount,exact:false,summary:"No repeated matching correction exists yet."};
}

export function casebookSignalLabel(signal:DesignerCasebookSignal) {
  if(signal.score>=2) return "supports";
  if(signal.score<=-2) return "cautions";
  return "neutral";
}
