// Keep the SQL idempotency key stable for an uncertain retry of the SAME
// reservation. A changed request must never be replayed under an old key,
// because fabric_stock_reserve_v2 looks up an existing reservation by key.
export type StockReservationAttempt={
  fabricId:string;
  revisionId:string;
  quantityMetres:number;
  requestedBy:string;
  sourceReference:string;
};

function fingerprint(request:StockReservationAttempt):string {
  return JSON.stringify([
    request.fabricId.trim(),
    request.revisionId.trim(),
    request.quantityMetres,
    request.requestedBy.trim(),
    request.sourceReference.trim(),
  ]);
}

export function createStockReservationAttemptTracker(makeKey:()=>string){
  let active:{fingerprint:string;key:string}|null=null;
  return {
    keyFor(request:StockReservationAttempt):string{
      const identity=fingerprint(request);
      if(!active||active.fingerprint!==identity)
        active={fingerprint:identity,key:makeKey()};
      return active.key;
    },
    confirmed(request:StockReservationAttempt):void {
      if(active?.fingerprint===fingerprint(request))active=null;
    },
  };
}
