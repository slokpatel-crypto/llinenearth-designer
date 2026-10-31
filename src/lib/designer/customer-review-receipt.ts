import {verifiedOperatorProductionCreateId} from "./operator-production-receipt.ts";
import type {CustomerOutcomePolicyRow,CustomerOutcomeReviewRow,CustomerOutcomeReviewDecision} from "./customer-outcome-learning.ts";

/** A successful POST status is not enough to certify a persisted human
 * decision. Require the exact server-issued immutable review receipt to be
 * visible on the correct outcome in a new validated list. */
export function verifiedCustomerReviewReadback(
  receiptId:unknown,
  outcomeId:unknown,
  decision:CustomerOutcomeReviewDecision,
  reviews:unknown,
):boolean{
  const receipt=verifiedOperatorProductionCreateId(receiptId);
  const outcome=verifiedOperatorProductionCreateId(outcomeId);
  if(!receipt||!outcome||(decision!=="approved"&&decision!=="rejected")
    ||!Array.isArray(reviews))return false;
  return reviews.some((value:unknown)=>{
    if(!value||typeof value!=="object"||Array.isArray(value))return false;
    const row=value as CustomerOutcomeReviewRow;
    return verifiedOperatorProductionCreateId(row.review_id)===receipt
      &&verifiedOperatorProductionCreateId(row.outcome_id)===outcome
      &&row.decision===decision;
  });
}

/** A posted policy is not established until the same ID, actual threshold,
 * approver and written rationale are visible in refreshed human evidence. */
export function verifiedCustomerPolicyReadback(
  receiptId:unknown,
  minimumApprovedCases:unknown,
  approvedBy:unknown,
  note:unknown,
  policies:unknown,
):boolean{
  const receipt=verifiedOperatorProductionCreateId(receiptId);
  if(!receipt||!Number.isSafeInteger(minimumApprovedCases)
    ||typeof approvedBy!=="string"||typeof note!=="string"
    ||!Array.isArray(policies))return false;
  return policies.some((value:unknown)=>{
    if(!value||typeof value!=="object"||Array.isArray(value))return false;
    const row=value as CustomerOutcomePolicyRow;
    return verifiedOperatorProductionCreateId(row.policy_id)===receipt
      &&row.minimum_approved_cases===minimumApprovedCases
      &&row.approved_by===approvedBy
      &&row.note===note;
  });
}
