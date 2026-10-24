/**
 * Batch success must account for each submitted fabric exactly once. HTTP 200
 * alone is not an acknowledgement that all records were processed.
 */
export function verifyFabricAnalyzerBatchResult(
  value:unknown,
  expectedItems:number,
):{succeeded:number;failed:number} {
  const invalid=()=>new Error("Analyzer batch response did not account for every submitted fabric. Review progress and retry unresolved rows.");
  if(!Number.isSafeInteger(expectedItems) || expectedItems<1) throw invalid();
  if(!value || typeof value!=="object" || Array.isArray(value)) throw invalid();
  const body=value as Record<string,unknown>;
  const {total,succeeded,failed,results}=body;
  if(typeof total!=="number" || !Number.isSafeInteger(total) ||
    typeof succeeded!=="number" || !Number.isSafeInteger(succeeded) ||
    typeof failed!=="number" || !Number.isSafeInteger(failed) ||
    total!==expectedItems || succeeded<0 || failed<0 ||
    succeeded+failed!==expectedItems ||
    !Array.isArray(results) || results.length!==expectedItems) throw invalid();
  let countedSuccess=0;
  for(let index=0;index<results.length;index++){
    const row=results[index];
    if(!row || typeof row!=="object" || Array.isArray(row)) throw invalid();
    if(row.index!==index || typeof row.ok!=="boolean") throw invalid();
    if(row.ok) countedSuccess+=1;
  }
  if(countedSuccess!==succeeded || expectedItems-countedSuccess!==failed) throw invalid();
  return {succeeded,failed};
}
