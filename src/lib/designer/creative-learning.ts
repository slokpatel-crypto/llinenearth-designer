export type CreativeFeedbackReason =
  | "visual_balance" | "too_busy" | "too_safe" | "pattern_detail"
  | "proportion" | "originality" | "render_mismatch" | "other";

export const CREATIVE_FEEDBACK_REASONS:Array<[CreativeFeedbackReason,string]> = [
  ["visual_balance","Visual balance"],
  ["too_busy","Too busy"],
  ["too_safe","Too safe"],
  ["pattern_detail","Pattern / detail"],
  ["proportion","Proportion"],
  ["originality","Not original enough"],
  ["render_mismatch","Render did not match the idea"],
  ["other","Other"],
];

export type CreativeLearningBucket = {
  familyId:string;
  positive:number;
  negative:number;
  total:number;
  renderMismatch:number;
  renderQualityTotal:number;
  renderQualitySamples:number;
  reasons:Record<CreativeFeedbackReason,number>;
};

export type CreativeLearningBook = {
  version:"designer-creative-learning-v1";
  totalReviews:number;
  renderMismatchReviews:number;
  usableFamilies:number;
  buckets:CreativeLearningBucket[];
};

export type CreativeLearningSignal = {
  score:number;
  evidence:number;
  summary:string;
  renderRisk:"low"|"moderate"|"high";
  renderEvidence:number;
};

type EventLike={type:string;source?:string;payload?:Record<string,unknown>};

const REASONS=new Set<CreativeFeedbackReason>(CREATIVE_FEEDBACK_REASONS.map(([id])=>id));

function txt(value:unknown,max=160){return String(value??"").trim().slice(0,max);}

export function creativeFamilyFromConceptId(conceptId:string) {
  const parts=conceptId.split(":");
  return parts[0]==="creative" && parts[1] ? parts[1] : conceptId.slice(0,100);
}

export function aggregateCreativeLearning(events:EventLike[]):CreativeLearningBook {
  // One latest response per recommendation + concept avoids repeated tapping
  // becoming stronger evidence than an independent review.
  const latest=new Map<string,{familyId:string;rating:"up"|"down"|"saved";reason?:CreativeFeedbackReason;renderQuality?:number}>();
  for(const event of events) {
    if(event.type!=="designer_feedback") continue;
    const p=event.payload || {};
    const conceptId=txt(p.creativeConceptId,180);
    const familyId=txt(p.creativeFamilyId,120) || (conceptId ? creativeFamilyFromConceptId(conceptId) : "");
    const recommendationId=txt(p.recommendationId,180);
    const rating=txt(p.rating,20);
    const reason=txt(p.creativeReason,40) as CreativeFeedbackReason;
    if(!conceptId || !familyId || !recommendationId || !["up","down","saved"].includes(rating)) continue;
    const check=p.creativeVisualCheck && typeof p.creativeVisualCheck==="object" && !Array.isArray(p.creativeVisualCheck)
      ? p.creativeVisualCheck as Record<string,unknown>
      : null;
    const hero=Math.max(0,Math.min(100,Number(check?.heroVisibility)||0));
    const boundaries=Math.max(0,Math.min(100,Number(check?.boundaryIntegrity)||0));
    const renderQuality=check ? Math.round((hero*.55+boundaries*.45)*10)/10 : undefined;
    const key=`${recommendationId}::${conceptId}`;
    const previous=latest.get(key);
    latest.set(key,{
      familyId,
      rating:rating as "up"|"down"|"saved",
      ...(REASONS.has(reason)?{reason}:previous?.reason?{reason:previous.reason}:{}),
      ...(renderQuality!==undefined?{renderQuality}:previous?.renderQuality!==undefined?{renderQuality:previous.renderQuality}:{}),
    });
  }

  const buckets=new Map<string,CreativeLearningBucket>();
  let renderMismatchReviews=0;
  for(const review of latest.values()) {
    const current=buckets.get(review.familyId) || {
      familyId:review.familyId,positive:0,negative:0,total:0,renderMismatch:0,renderQualityTotal:0,renderQualitySamples:0,
      reasons:Object.fromEntries(CREATIVE_FEEDBACK_REASONS.map(([id])=>[id,0])) as Record<CreativeFeedbackReason,number>,
    };

    // A renderer failing to express the specification is not evidence that
    // the fashion idea itself is bad. Track that separately so automatic
    // visual QA improves rendering without training the creative taste signal
    // toward safer or more conventional concepts.
    if(review.renderQuality!==undefined) {
      current.renderQualityTotal+=review.renderQuality;
      current.renderQualitySamples+=1;
    }
    if(review.rating==="saved") {
      buckets.set(review.familyId,current);
      continue;
    }
    if(review.rating==="down" && review.reason==="render_mismatch") {
      current.reasons.render_mismatch+=1;
      current.renderMismatch+=1;
      renderMismatchReviews+=1;
      buckets.set(review.familyId,current);
      continue;
    }

    if(review.rating==="up") current.positive+=1;
    else {
      current.negative+=1;
      if(review.reason) current.reasons[review.reason]+=1;
    }
    current.total+=1;
    buckets.set(review.familyId,current);
  }

  const values=[...buckets.values()].sort((a,b)=>b.total-a.total || b.positive-a.positive);
  const totalReviews=values.reduce((sum,item)=>sum+item.total,0);
  return {
    version:"designer-creative-learning-v1",
    totalReviews,
    renderMismatchReviews,
    usableFamilies:values.filter((item)=>item.total>=3).length,
    buckets:values,
  };
}

export function creativeLearningSignalFor(familyId:string,book?:CreativeLearningBook|null):CreativeLearningSignal {
  const bucket=book?.buckets.find((item)=>item.familyId===familyId);
  const renderEvidence=bucket?.renderQualitySamples || 0;
  const avgRenderQuality=renderEvidence ? (bucket!.renderQualityTotal/renderEvidence) : 100;
  const renderRisk:CreativeLearningSignal["renderRisk"]=renderEvidence>=2 && avgRenderQuality<52 ? "high" : renderEvidence>=2 && avgRenderQuality<70 ? "moderate" : "low";
  if(!bucket || bucket.total<3) {
    const renderNote=bucket?.reasons.render_mismatch ? ` ${bucket.reasons.render_mismatch} render mismatch review(s) are tracked separately from creative taste.` : "";
    return {score:0,evidence:bucket?.total || 0,summary:`Creative review evidence is still sparse for this idea family.${renderNote}`,renderRisk,renderEvidence};
  }
  // Human visual review is useful, but capped at +/-5 so it cannot erase
  // research, aesthetics, originality or hard construction checks.
  const score=Math.max(-5,Math.min(5,Math.round(((bucket.positive-bucket.negative)/bucket.total)*5*10)/10));
  const topReason=(Object.entries(bucket.reasons) as Array<[CreativeFeedbackReason,number]>)
    .sort((a,b)=>b[1]-a[1])[0];
  const reasonText=topReason && topReason[1]>0 ? ` Most common caution: ${CREATIVE_FEEDBACK_REASONS.find(([id])=>id===topReason[0])?.[1] || topReason[0]}.` : "";
  return {
    score,evidence:bucket.total,
    summary:`${bucket.total} reviewed visual concepts in this family: ${bucket.positive} strong, ${bucket.negative} needs redesign.${reasonText}`,
    renderRisk,
    renderEvidence,
  };
}
