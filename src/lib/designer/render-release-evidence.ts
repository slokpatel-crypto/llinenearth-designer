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


export const FINAL_RENDER_REVIEW_TARGET=20;
export const FINAL_RENDER_APPROVAL_TARGET_PERCENT=60;

export type FinalRenderReleaseEvidenceInput={
  reviewed:number;
  approvalRate:number|null;
  identity:{
    eligibleConcepts:number;
    reviewedConcepts:number;
    pendingConcepts:number;
    passedConcepts:number;
    failedConcepts:number;
  };
  creditCap:{
    configured:boolean;
    withinCap:boolean|null;
  };
};

export function evaluateFinalRenderReleaseEvidence(input:FinalRenderReleaseEvidenceInput){
  const reviewed=Math.max(0,Math.floor(Number(input.reviewed)||0));
  const approvalRate=input.approvalRate===null||!Number.isFinite(input.approvalRate)
    ? null
    : Math.max(0,Math.min(100,input.approvalRate));
  const approvalGateComplete=
    reviewed>=FINAL_RENDER_REVIEW_TARGET &&
    approvalRate!==null &&
    approvalRate>=FINAL_RENDER_APPROVAL_TARGET_PERCENT;

  const eligibleConcepts=Math.max(0,Math.floor(Number(input.identity.eligibleConcepts)||0));
  const passedConcepts=Math.max(0,Math.floor(Number(input.identity.passedConcepts)||0));
  const failedConcepts=Math.max(0,Math.floor(Number(input.identity.failedConcepts)||0));
  const pendingConcepts=Math.max(0,Math.floor(Number(input.identity.pendingConcepts)||0));
  const identityGateComplete=
    eligibleConcepts>0 &&
    failedConcepts===0 &&
    pendingConcepts===0 &&
    passedConcepts>=eligibleConcepts;

  const costGateComplete=input.creditCap.configured===true&&input.creditCap.withinCap===true;
  const completedGates=[approvalGateComplete,identityGateComplete,costGateComplete].filter(Boolean).length;

  const reviewVolumeProgress=Math.min(100,reviewed/FINAL_RENDER_REVIEW_TARGET*100);
  const approvalRateProgress=approvalRate===null
    ? 0
    : Math.min(100,approvalRate/FINAL_RENDER_APPROVAL_TARGET_PERCENT*100);
  const approvalProgress=Math.round((reviewVolumeProgress+approvalRateProgress)/2);
  const identityProgress=eligibleConcepts
    ? Math.round(Math.min(1,passedConcepts/eligibleConcepts)*100)
    : 0;
  const costProgress=input.creditCap.withinCap===true
    ? 100
    : input.creditCap.configured&&input.creditCap.withinCap===null
      ? 50
      : 0;

  return {
    approvalGateComplete,
    identityGateComplete,
    costGateComplete,
    gateComplete:completedGates===3,
    completedGates,
    totalGates:3,
    progressPercent:Math.round((approvalProgress+identityProgress+costProgress)/3),
    approvalProgress,
    identityProgress,
    costProgress,
    remainingReviews:Math.max(0,FINAL_RENDER_REVIEW_TARGET-reviewed),
    approvalTargetPercent:FINAL_RENDER_APPROVAL_TARGET_PERCENT,
    identityEligibleConcepts:eligibleConcepts,
    identityPassedConcepts:passedConcepts,
  };
}
