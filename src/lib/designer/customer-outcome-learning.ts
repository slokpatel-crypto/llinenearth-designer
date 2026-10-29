import { PRODUCTION_LEARNING_CONTEXT_VERSION } from "./production-learning-context.ts";

export type CustomerOutcomeEvidenceRow={
  outcome_id:string;
  order_id:string;
  revision_id:string;
  overall_rating:string;
  fit_result:string;
  worn_confirmed:boolean;
  note:string;
  created_at:string;
  learning_context?:Record<string,unknown>|null;
};

export type CustomerOutcomeReviewDecision="approved"|"rejected";
export type CustomerOutcomeReviewRow={
  review_id:string;
  outcome_id:string;
  decision:CustomerOutcomeReviewDecision;
  reviewer:string;
  note:string;
  created_at:string;
};

export type CustomerOutcomePolicyRow={
  policy_id:string;
  minimum_approved_cases:number;
  approved_by:string;
  note:string;
  created_at:string;
};

const REVIEW_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeCustomerOutcomeReview(input:Record<string,unknown>){
  const outcomeId=typeof input.outcomeId==="string"?input.outcomeId.trim():"";
  const decision=input.decision;
  const reviewer=typeof input.reviewer==="string"?input.reviewer.trim():"";
  if(input.note!==undefined&&input.note!==null&&typeof input.note!=="string") throw new Error("Review note must be text.");
  const note=typeof input.note==="string"?input.note.trim():"";

  if(!REVIEW_UUID.test(outcomeId)) throw new Error("Valid outcome ID is required.");
  if(decision!=="approved"&&decision!=="rejected") throw new Error("Choose an outcome review decision.");
  if(reviewer.length<2||reviewer.length>120) throw new Error("Named reviewer must be 2–120 characters.");
  if(note.length>1200) throw new Error("Review note must be 1200 characters or fewer.");
  if(decision==="rejected"&&note.length<3) throw new Error("Add a short rejection reason.");
  return {outcomeId:outcomeId.toLowerCase(),decision,reviewer,note};
}

export function normalizeCustomerOutcomePolicy(input:Record<string,unknown>){
  const minimumApprovedCases=input.minimumApprovedCases;
  const approvedBy=typeof input.approvedBy==="string"?input.approvedBy.trim():"";
  const note=typeof input.note==="string"?input.note.trim():"";
  if(typeof minimumApprovedCases!=="number"||!Number.isSafeInteger(minimumApprovedCases)||minimumApprovedCases<1||minimumApprovedCases>10000)
    throw new Error("Enter a whole-number approved-case threshold.");
  if(approvedBy.length<2||approvedBy.length>120) throw new Error("Named policy approver must be 2–120 characters.");
  if(note.length<3||note.length>1200) throw new Error("Document the source or reasoning for this threshold (3–1200 characters).");
  return {minimumApprovedCases,approvedBy,note};
}

function validOutcomeLearningContext(outcome:CustomerOutcomeEvidenceRow){
  const context=outcome.learning_context;
  if(!context||typeof context!=="object"||Array.isArray(context)) return false;
  if(context.version!==PRODUCTION_LEARNING_CONTEXT_VERSION) return false;
  if(String(context.revisionId||"").trim()!==String(outcome.revision_id||"").trim()) return false;
  if(!/^[a-f0-9]{64}$/i.test(String(context.recipeHash||"").trim())) return false;
  const fabrics=context.fabrics;
  if(!fabrics||typeof fabrics!=="object"||Array.isArray(fabrics)) return false;
  const pair=fabrics as Record<string,unknown>;
  return String(pair.shirtId||"").trim().length>1&&String(pair.trouserId||"").trim().length>1;
}

export function summarizeCustomerOutcomeLearning(
  outcomes:CustomerOutcomeEvidenceRow[],
  reviews:CustomerOutcomeReviewRow[],
  policies:CustomerOutcomePolicyRow[],
){
  const latestReviewByOutcome=new Map<string,CustomerOutcomeReviewRow>();
  for(const review of [...reviews].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
    if(!latestReviewByOutcome.has(review.outcome_id)) latestReviewByOutcome.set(review.outcome_id,review);
  }
  const latestPolicy=[...policies].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0]||null;

  let approved=0;
  let rejected=0;
  let unreviewed=0;
  let learningEligible=0;
  let approvedFitCases=0;
  for(const outcome of outcomes){
    const review=latestReviewByOutcome.get(outcome.outcome_id);
    if(!review){unreviewed+=1;continue;}
    if(review.decision==="rejected"){rejected+=1;continue;}
    approved+=1;
    if(validOutcomeLearningContext(outcome)){
      learningEligible+=1;
      if(outcome.worn_confirmed&&outcome.fit_result!=="not_checked") approvedFitCases+=1;
    }
  }

  const threshold=latestPolicy?.minimum_approved_cases||null;
  return {
    totalOutcomes:outcomes.length,
    approved,
    rejected,
    unreviewed,
    learningEligible,
    approvedFitCases,
    threshold,
    policy:latestPolicy,
    gateComplete:Boolean(threshold&&learningEligible>=threshold),
  };
}
