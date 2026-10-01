export type RenderIdentityReviewInput={
  concept_id:string;
  status:"pass"|"fail";
  reviewed_views:string[];
  reviewer?:string;
  note?:string;
  created_at:string;
};

export type RenderOutcomeIdentityInput={
  concept_id:string;
  view:string;
  human_status:"pending"|"approved"|"rejected";
  created_at?:string;
};

export type CrossViewIdentityState={
  conceptId:string;
  views:string[];
  status:"pass"|"fail"|"pending";
  staleReason:"missing_review"|"view_set_changed"|"render_changed"|null;
  review:RenderIdentityReviewInput|null;
};

function validTimestamp(value:unknown){
  const parsed=new Date(String(value||"")).getTime();
  return Number.isFinite(parsed)?parsed:null;
}

export function buildCrossViewIdentityStates(
  outcomes:RenderOutcomeIdentityInput[],
  reviews:RenderIdentityReviewInput[],
):CrossViewIdentityState[]{
  const grouped=new Map<string,{views:Set<string>;latestOutcomeAt:number|null}>();
  for(const row of outcomes){
    const conceptId=String(row.concept_id||"").trim();
    const view=String(row.view||"").trim();
    if(!conceptId||!view) continue;
    const current=grouped.get(conceptId)||{views:new Set<string>(),latestOutcomeAt:null};
    current.views.add(view);
    const createdAt=validTimestamp(row.created_at);
    if(createdAt!==null) current.latestOutcomeAt=Math.max(current.latestOutcomeAt||0,createdAt);
    grouped.set(conceptId,current);
  }

  const latestReviews=new Map<string,RenderIdentityReviewInput>();
  for(const review of reviews){
    const conceptId=String(review.concept_id||"").trim();
    if(!conceptId) continue;
    const current=latestReviews.get(conceptId);
    const incomingAt=validTimestamp(review.created_at)||0;
    const currentAt=current ? validTimestamp(current.created_at)||0 : -1;
    if(!current||incomingAt>currentAt) latestReviews.set(conceptId,review);
  }

  const states:CrossViewIdentityState[]=[];
  for(const [conceptId,group] of grouped){
    if(group.views.size<2) continue;
    const views=[...group.views].sort();
    const review=latestReviews.get(conceptId)||null;
    if(!review){
      states.push({conceptId,views,status:"pending",staleReason:"missing_review",review:null});
      continue;
    }

    const reviewedViews=new Set((review.reviewed_views||[]).map((view)=>String(view||"").trim()).filter(Boolean));
    if(!views.every((view)=>reviewedViews.has(view))){
      states.push({conceptId,views,status:"pending",staleReason:"view_set_changed",review});
      continue;
    }

    const reviewAt=validTimestamp(review.created_at);
    if(reviewAt!==null&&group.latestOutcomeAt!==null&&group.latestOutcomeAt>reviewAt){
      states.push({conceptId,views,status:"pending",staleReason:"render_changed",review});
      continue;
    }

    states.push({conceptId,views,status:review.status,staleReason:null,review});
  }
  return states;
}

export function summarizeCrossViewIdentity(
  outcomes:RenderOutcomeIdentityInput[],
  reviews:RenderIdentityReviewInput[],
){
  const states=buildCrossViewIdentityStates(outcomes,reviews);
  const passed=states.filter((state)=>state.status==="pass").length;
  const failed=states.filter((state)=>state.status==="fail").length;
  const reviewed=passed+failed;
  return {
    eligibleConcepts:states.length,
    reviewedConcepts:reviewed,
    pendingConcepts:states.length-reviewed,
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
  manualReviewSignoff:{
    status:"approved"|"review"|null;
  };
  patternCoverage:{
    requiredPairs:number;
    passedPairs:number;
    failedPairs:number;
    pendingPairs:number;
    gateComplete:boolean;
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
  const patternGateComplete=input.patternCoverage.gateComplete===true;
  const manualReviewGateComplete=input.manualReviewSignoff.status==="approved";
  const completedGates=[approvalGateComplete,identityGateComplete,costGateComplete,patternGateComplete,manualReviewGateComplete].filter(Boolean).length;

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
  const requiredPatternPairs=Math.max(0,Math.floor(Number(input.patternCoverage.requiredPairs)||0));
  const passedPatternPairs=Math.max(0,Math.floor(Number(input.patternCoverage.passedPairs)||0));
  const patternProgress=requiredPatternPairs
    ? Math.round(Math.min(1,passedPatternPairs/requiredPatternPairs)*100)
    : 0;

  return {
    approvalGateComplete,
    identityGateComplete,
    costGateComplete,
    patternGateComplete,
    manualReviewGateComplete,
    gateComplete:completedGates===5,
    completedGates,
    totalGates:5,
    progressPercent:Math.round((approvalProgress+identityProgress+costProgress+patternProgress+(manualReviewGateComplete?100:0))/5),
    approvalProgress,
    identityProgress,
    costProgress,
    patternProgress,
    remainingReviews:Math.max(0,FINAL_RENDER_REVIEW_TARGET-reviewed),
    approvalTargetPercent:FINAL_RENDER_APPROVAL_TARGET_PERCENT,
    identityEligibleConcepts:eligibleConcepts,
    identityPassedConcepts:passedConcepts,
  };
}
