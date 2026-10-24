/**
 * Distinguish confirmed server acknowledgements from an unverified chunk:
 * a timed-out or malformed response may follow a successful server write.
 */
export function describeBatchStop(input:{
  total:number;succeeded:number;failed:number;error:string;
}):string {
  const confirmed=input.succeeded+input.failed;
  return `Batch interrupted: ${confirmed}/${input.total} rows have confirmed outcomes (${input.succeeded} analyzed, ${input.failed} failed). ${input.error} The current chunk's result is unknown; inspect saved Analyzer profiles before retrying to avoid duplicate processing.`;
}

/** A post-batch UI refresh cannot retroactively undo successful ingestion. */
export function describeBatchRefreshFailure(succeeded:number,failed:number):string{
  return `Batch processing finished: ${succeeded} analyzed, ${failed} failed. The operator view could not refresh; reload the page instead of resubmitting the worksheet.`;
}
