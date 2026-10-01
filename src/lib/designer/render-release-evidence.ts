export type RenderIdentityReviewInput={
  concept_id:string;
  status:"pass"|"fail";
  reviewed_views:string[];
  created_at:string;
};

export type RenderOutcomeIdentityInput={
  concept_id:string;
  view:string;
  human_status:"pending"|"approved"|"rejected";
};

export function summarizeCrossViewIdentity(
  outcomes:RenderOutcomeIdentityInput[],
  reviews:RenderIdentityReviewInput[],
){
  const grouped=new Map<string,Set<string>>();
  for(const row of outcomes){
    const key=String(row.concept_id||"").trim();
    const view=String(row.view||"").trim();
    if(!key||!view) continue;
    const set=grouped.get(key)||new Set<string>();
    set.add(view);grouped.set(key,set);
  }
  const eligible=[...grouped.entries()].filter(([,views])=>views.size>=2);
  const latest=new Map<string,RenderIdentityReviewInput>();
  for(const review of reviews){
    const current=latest.get(review.concept_id);
    if(!current||new Date(review.created_at).getTime()>new Date(current.created_at).getTime()){
      latest.set(review.concept_id,review);
    }
  }
  let passed=0,failed=0,reviewed=0;
  for(const [conceptId] of eligible){
    const review=latest.get(conceptId);
    if(!review) continue;
    reviewed+=1;
    if(review.status==="pass") passed+=1; else failed+=1;
  }
  return {
    eligibleConcepts:eligible.length,
    reviewedConcepts:reviewed,
    pendingConcepts:Math.max(0,eligible.length-reviewed),
    passedConcepts:passed,
    failedConcepts:failed,
    passRate:reviewed?Math.round(passed/reviewed*1000)/10:null,
  };
}

export function evaluateRenderCreditCap(creditsPerApproved:number|null,ownerCap:number|null){
  if(ownerCap===null||!Number.isFinite(ownerCap)||ownerCap<=0){
    return {configured:false,withinCap:null,ownerCap:null};
  }
  if(creditsPerApproved===null||!Number.isFinite(creditsPerApproved)){
    return {configured:true,withinCap:null,ownerCap};
  }
  return {configured:true,withinCap:creditsPerApproved<=ownerCap,ownerCap};
}
