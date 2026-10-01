export const CUSTOMER_OUTCOME_RATINGS=["love","good","needs_work"] as const;
export const CUSTOMER_FIT_RESULTS=["clean_first_fit","minor_alteration","major_alteration","not_checked"] as const;

export type CustomerOutcomeRating=typeof CUSTOMER_OUTCOME_RATINGS[number];
export type CustomerFitResult=typeof CUSTOMER_FIT_RESULTS[number];

export type CustomerProductionOutcomeDraft={
  overallRating:CustomerOutcomeRating;
  fitResult:CustomerFitResult;
  wornConfirmed:boolean;
  note:string;
};

export function normalizeCustomerProductionOutcome(input:Record<string,unknown>):CustomerProductionOutcomeDraft{
  const overallRating=String(input.overallRating||"") as CustomerOutcomeRating;
  const fitResult=String(input.fitResult||"") as CustomerFitResult;
  const wornConfirmed=input.wornConfirmed===true;
  const note=String(input.note||"").trim().slice(0,1000);

  if(!CUSTOMER_OUTCOME_RATINGS.includes(overallRating)) throw new Error("Choose an overall outcome.");
  if(!CUSTOMER_FIT_RESULTS.includes(fitResult)) throw new Error("Choose a fit outcome.");
  if(!wornConfirmed&&fitResult!=="not_checked") throw new Error("Confirm the garment was worn before recording a fit result.");
  if((overallRating==="needs_work"||fitResult==="major_alteration")&&note.length<3) {
    throw new Error("Add a short note describing what needs attention.");
  }

  return {overallRating,fitResult,wornConfirmed,note};
}
