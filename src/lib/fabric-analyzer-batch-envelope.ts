/**
 * A successful batch response must account for *every* submitted record.
 * Never silently slice a CSV batch: operators would otherwise believe that
 * records 13+ were analyzed when they were never dispatched.
 */
export class FabricAnalyzerBatchInputError extends Error {
  constructor(message:string) {
    super(message);
    this.name="FabricAnalyzerBatchInputError";
  }
}

export const FABRIC_ANALYZER_BATCH_LIMIT=12;

export function parseFabricAnalyzerBatchEnvelope<T extends object>(body:unknown,limit=FABRIC_ANALYZER_BATCH_LIMIT):T[] {
  if(!body || typeof body!=="object" || Array.isArray(body)) {
    throw new FabricAnalyzerBatchInputError("Expected a batch request with an items array.");
  }
  const items=(body as Record<string,unknown>).items;
  if(!Array.isArray(items)||items.length===0) {
    throw new FabricAnalyzerBatchInputError("Provide at least one fabric analysis item.");
  }
  if(items.length>limit) {
    throw new FabricAnalyzerBatchInputError(
      `Submit at most ${limit} fabrics per batch; none of this oversized batch was processed.`
    );
  }
  if(!items.every((item)=>item!==null && typeof item==="object" && !Array.isArray(item))) {
    throw new FabricAnalyzerBatchInputError("Each fabric analysis item must be an object.");
  }
  return items as T[];
}
