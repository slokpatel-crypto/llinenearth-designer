// Identical physical evidence must reuse the same stock movement key, even
// after a confirmed ACK whose ledger refresh fails. A new movement requires
// changed evidence, especially a distinct supplier/roll reference.
export type ManualStockAttempt={
  fabricId:string;eventType:string;quantityMetres:number;note:string;
  recordedBy:string;sourceReference:string;
};
function normalize(value:string):string{return value.replace(/\s+/g," ").trim();}
function fingerprint(record:ManualStockAttempt):string{
  return JSON.stringify([
    record.fabricId.trim(),record.eventType,record.quantityMetres,
    normalize(record.note),normalize(record.recordedBy),normalize(record.sourceReference),
  ]);
}
export function createStockManualAttemptTracker(makeKey:()=>string){
  let active:{fingerprint:string;key:string}|null=null;
  return {
    keyFor(record:ManualStockAttempt):string{
      const id=fingerprint(record);
      if(!active||active.fingerprint!==id)active={fingerprint:id,key:makeKey()};
      return active.key;
    },
  };
}
