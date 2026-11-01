// Keep the SQL manual stock key stable for an identical in-tab retry.
// This is not a cross-tab or cross-device guarantee: uncertain writes still
// require explicit operator ledger and physical-source reconciliation.
export type StockManualAttempt={
  fabricId:string;
  eventType:string;
  quantityMetres:number;
  recordedBy:string;
  sourceReference:string;
  note:string;
};

function fingerprint(request:StockManualAttempt):string{
  return JSON.stringify([
    request.fabricId.trim(),request.eventType,request.quantityMetres,
    request.recordedBy.trim(),request.sourceReference.trim(),request.note.trim(),
  ]);
}

export function createStockManualAttemptTracker(makeKey:()=>string){
  let active:{fingerprint:string;key:string}|null=null;
  return {
    keyFor(request:StockManualAttempt):string{
      const identity=fingerprint(request);
      if(!active||active.fingerprint!==identity)
        active={fingerprint:identity,key:makeKey()};
      return active.key;
    },
    confirmed(request:StockManualAttempt):void{
      if(active?.fingerprint===fingerprint(request)) active=null;
    },
  };
}
