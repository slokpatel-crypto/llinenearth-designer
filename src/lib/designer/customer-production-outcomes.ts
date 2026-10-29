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

const PRODUCTION_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A customer-supplied record identity must be a literal DB UUID, never JSON-coerced. */
export function parseCustomerProductionRecordId(value:unknown):string|null{
  if(typeof value!=="string") return null;
  const id=value.trim();
  return PRODUCTION_UUID.test(id)?id.toLowerCase():null;
}

export function normalizeCustomerProductionOutcome(input:Record<string,unknown>):CustomerProductionOutcomeDraft{
  if(typeof input.overallRating!=="string" || !CUSTOMER_OUTCOME_RATINGS.some(value=>value===input.overallRating))
    throw new Error("Choose an overall outcome.");
  if(typeof input.fitResult!=="string" || !CUSTOMER_FIT_RESULTS.some(value=>value===input.fitResult))
    throw new Error("Choose a fit outcome.");
  if(input.wornConfirmed!==undefined&&input.wornConfirmed!==null&&typeof input.wornConfirmed!=="boolean")
    throw new Error("Wear confirmation must be true or false.");
  if(input.note!==undefined&&input.note!==null&&typeof input.note!=="string")
    throw new Error("Feedback note must be text.");

  const overallRating=input.overallRating as CustomerOutcomeRating;
  const fitResult=input.fitResult as CustomerFitResult;
  const wornConfirmed=input.wornConfirmed===true;
  const note=typeof input.note==="string"?input.note.trim():"";
  if(note.length>1000) throw new Error("Feedback note must be 1000 characters or fewer.");

  if(!wornConfirmed&&fitResult!=="not_checked") throw new Error("Confirm the garment was worn before recording a fit result.");
  if((overallRating==="needs_work"||fitResult==="major_alteration")&&note.length<3)
    throw new Error("Add a short note describing what needs attention.");

  return {overallRating,fitResult,wornConfirmed,note};
}
