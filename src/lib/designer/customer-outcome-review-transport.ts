import type {CustomerOutcomeEvidenceRow,CustomerOutcomeReviewRow,CustomerOutcomePolicyRow} from "./customer-outcome-learning.ts";
import {parseProductionEvidenceTimestamp} from "./production-delivery-evidence.ts";
import {CUSTOMER_OUTCOME_RATINGS,CUSTOMER_FIT_RESULTS} from "./customer-production-outcomes.ts";

/** Operator-only evidence. Database columns (including nested learning
 * metadata) are NOT automatically authorized browser fields. Reject malformed
 * records; do not drop them and resurrect an older positive review/policy. */
function obj(x:unknown):Record<string,unknown>{
  if(x===null||typeof x!=="object"||Array.isArray(x))
    throw new Error("Invalid customer learning evidence object.");
  return x as Record<string,unknown>;
}
function str(x:unknown,max:number):string{
  if(typeof x!=="string"||x.length>max)throw new Error("Invalid customer learning text.");
  return x;
}
function maybeStr(x:unknown,max:number):string|null{
  return x===null?null:str(x,max);
}
function rows(x:unknown,max:number):Record<string,unknown>[]{
  if(!Array.isArray(x)||x.length>max)
    throw new Error("Invalid or oversized customer learning evidence.");
  return x.map(obj);
}
/** Every recorded outcome, review and policy is one durable human evidence row.
 * Duplicate IDs would double-count an approval or make a rejected review ambiguous. */
function requireDistinctIds(ids:string[],kind:string):void{
  const seen=new Set<string>();
  for(const value of ids){
    const key=value.trim().toLowerCase();
    if(!key||seen.has(key))throw new Error("Duplicate or missing customer "+kind+" evidence ID.");
    seen.add(key);
  }
}
// A small bounded skew permits clock drift between the database and app
// server; a human review or policy recorded hours or days in the future is
// not present-day approval evidence.
const MAX_EVIDENCE_CLOCK_SKEW_MS=5*60*1000;
function date(x:unknown,observedAt:number):string{
  const s=str(x,64);
  const instant=parseProductionEvidenceTimestamp(s);
  if(!Number.isFinite(instant))
    throw new Error("Invalid customer learning timestamp.");
  if(instant>observedAt+MAX_EVIDENCE_CLOCK_SKEW_MS)
    throw new Error("Future-dated customer learning timestamp.");
  return s;
}
function exactContext(x:unknown){
  if(x===null||x===undefined)return null;
  const c=obj(x),inner=obj(c.context),fab=obj(c.fabrics),shirt=obj(c.shirt),trouser=obj(c.trouser);
  return {
    version:str(c.version,100),revisionId:str(c.revisionId,220),
    recipeHash:str(c.recipeHash,128),
    context:{occasion:str(inner.occasion,200)},
    fabrics:{shirtId:str(fab.shirtId,200),trouserId:str(fab.trouserId,200)},
    shirt:{fit:str(shirt.fit,200),collar:str(shirt.collar,200),
      cuff:str(shirt.cuff,200),wear:str(shirt.wear,200)},
    trouser:{shape:str(trouser.shape,200),rise:str(trouser.rise,200),
      break:str(trouser.break,200)},
  };
}
export function safeOutcomeReviewEvidence(
  rawOutcomes:unknown,rawReviews:unknown,rawPolicies:unknown,
  observedAt:number=Date.now(),
):{outcomes:CustomerOutcomeEvidenceRow[];reviews:CustomerOutcomeReviewRow[];policies:CustomerOutcomePolicyRow[]}{
  if(!Number.isSafeInteger(observedAt)||observedAt<0)
    throw new Error("Invalid customer evidence observation clock.");
  const outcomes=rows(rawOutcomes,1000).map(o=>{
    const worn=o.worn_confirmed;
    if(typeof worn!=="boolean")throw new Error("Invalid customer wear confirmation.");
    // The signed human learning gate must obey the same closed customer
    // feedback vocabulary and wear/fit consistency as the customer POST.
    // Unknown SQL labels and contradictory fit claims are not real evidence.
    const rating=str(o.overall_rating,40);
    const fit=str(o.fit_result,50);
    if(!CUSTOMER_OUTCOME_RATINGS.some(value=>value===rating))
      throw new Error("Invalid recorded customer overall rating.");
    if(!CUSTOMER_FIT_RESULTS.some(value=>value===fit))
      throw new Error("Invalid recorded customer fit result.");
    if(!worn&&fit!=="not_checked")
      throw new Error("Customer fit result lacks confirmed garment wear.");
    const note=str(o.note,1200);
    if((rating==="needs_work"||fit==="major_alteration")
      &&note.trim().length<3)
      throw new Error("Adverse customer fit evidence requires a recorded reason.");
    return {
      outcome_id:str(o.outcome_id,80),order_id:str(o.order_id,80),
      revision_id:str(o.revision_id,220),
      overall_rating:rating,fit_result:fit,
      worn_confirmed:worn,note,created_at:date(o.created_at,observedAt),
      learning_context:exactContext(o.learning_context),
    };
  });
  const reviews=rows(rawReviews,5000).map(r=>{
    if(r.decision!=="approved"&&r.decision!=="rejected")
      throw new Error("Invalid outcome review status.");
    return {
      review_id:str(r.review_id,80),outcome_id:str(r.outcome_id,80),
      decision:r.decision as CustomerOutcomeReviewRow["decision"],reviewer:str(r.reviewer,120),
      note:str(r.note,1200),created_at:date(r.created_at,observedAt),
    };
  });
  const policies=rows(rawPolicies,100).map(p=>{
    if(!Number.isSafeInteger(p.minimum_approved_cases)||
       (p.minimum_approved_cases as number)<1||
       (p.minimum_approved_cases as number)>10000)
      throw new Error("Invalid human evidence policy threshold.");
    return {
      policy_id:str(p.policy_id,80),
      minimum_approved_cases:p.minimum_approved_cases as number,
      approved_by:str(p.approved_by,120),
      note:str(p.note,1200),created_at:date(p.created_at,observedAt),
    };
  });
  requireDistinctIds(outcomes.map(row=>row.outcome_id),"outcome");
  requireDistinctIds(reviews.map(row=>row.review_id),"review");
  requireDistinctIds(policies.map(row=>row.policy_id),"policy");
  // Never grant a human review to customer feedback that did not yet exist.
  // Reviews of older outcomes outside the bounded latest-outcomes window stay
  // historically visible without falsely assuming the source is absent.
  const outcomeTimes=new Map(outcomes.map(o=>[
    o.outcome_id.toLowerCase(),parseProductionEvidenceTimestamp(o.created_at),
  ]));
  for(const review of reviews){
    const recordedAt=outcomeTimes.get(review.outcome_id.toLowerCase());
    if(recordedAt!==undefined
      &&parseProductionEvidenceTimestamp(review.created_at)<recordedAt)
      throw new Error("Customer review predates the recorded outcome.");
  }

  return {outcomes,reviews,policies};
}
