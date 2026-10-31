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

/** Durable outcome UUIDs are case-insensitive. Resolve latest reviews once
 * and keep conflicting decisions at the same latest instant unresolved,
 * irrespective of SQL row ordering. The returned keys are lowercase IDs. */
export function resolveLatestCustomerReviews(reviews:CustomerOutcomeReviewRow[]){
  const latestByOutcome=new Map<string,CustomerOutcomeReviewRow>();
  const conflicts=new Set<string>();
  for(const review of [...reviews].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))){
    const key=review.outcome_id.toLowerCase();
    const current=latestByOutcome.get(key);
    if(!current){latestByOutcome.set(key,review);continue;}
    if(Date.parse(current.created_at)===Date.parse(review.created_at)
      &&current.decision!==review.decision)conflicts.add(key);
  }
  return {latestByOutcome,conflicts};
}

export function summarizeCustomerOutcomeLearning(
  outcomes:CustomerOutcomeEvidenceRow[],
  reviews:CustomerOutcomeReviewRow[],
  policies:CustomerOutcomePolicyRow[],
){
  // PostgreSQL may return different rows with identical timestamps in either
  // order. Never let array ordering select an approval over a tied rejection.
  const {latestByOutcome:latestReviewByOutcome,conflicts:allReviewConflicts}=
    resolveLatestCustomerReviews(reviews);
  // Latest review RPC can contain history for outcomes no longer present in
  // the bounded current-outcomes page. Such unrelated conflicts must not
  // block approval of the currently displayed human evidence.
  const currentOutcomeKeys=new Set(outcomes.map(o=>o.outcome_id.toLowerCase()));
  const conflictingReviewOutcomes=new Set([...allReviewConflicts].filter(
    outcomeId=>currentOutcomeKeys.has(outcomeId),
  ));
  // Two differently signed human policies at the same latest instant cannot
  // be resolved by whichever database row happens to be returned first.
  const orderedPolicies=[...policies].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const newestPolicy=orderedPolicies[0]||null;
  const policyConflict=Boolean(newestPolicy&&orderedPolicies.some(policy=>
    policy!==newestPolicy
    &&Date.parse(policy.created_at)===Date.parse(newestPolicy.created_at)
    &&(policy.minimum_approved_cases!==newestPolicy.minimum_approved_cases
      ||policy.approved_by!==newestPolicy.approved_by
      ||policy.note!==newestPolicy.note)));
  const latestPolicy=policyConflict?null:newestPolicy;

  let approved=0;
  let rejected=0;
  let unreviewed=0;
  let learningEligible=0;
  let approvedFitCases=0;
  for(const outcome of outcomes){
    // Preserve ambiguity as unresolved; never manufacture an approval or a
    // rejection when human decisions conflict at an identical timestamp.
    if(conflictingReviewOutcomes.has(outcome.outcome_id.toLowerCase())){
      unreviewed+=1;
      continue;
    }
    const review=latestReviewByOutcome.get(outcome.outcome_id.toLowerCase());
    if(!review){unreviewed+=1;continue;}
    if(review.decision==="rejected"){rejected+=1;continue;}
    approved+=1;
    if(validOutcomeLearningContext(outcome)){
      learningEligible+=1;
      // Fit success is strictly a confirmed clean first fit. Alteration cases remain eligible as human-reviewed learning evidence, but are not successful fit cases.
      if(outcome.worn_confirmed&&outcome.fit_result==="clean_first_fit") approvedFitCases+=1;
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
    reviewConflictCount:conflictingReviewOutcomes.size,
    policyConflict,
    gateComplete:Boolean(threshold&&learningEligible>=threshold
      &&conflictingReviewOutcomes.size===0&&!policyConflict),
  };
}
