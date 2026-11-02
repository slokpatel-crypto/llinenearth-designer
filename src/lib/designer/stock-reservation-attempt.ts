import {createStockManualAttemptTracker} from "./stock-manual-attempt.ts";

// SQL reservation replay must retain the SAME key after a tab reload and
// after an ACK. Otherwise the same source sheet may reserve the same fabric
// twice. Only a changed, documented request gets a new identity.
export type StockReservationAttempt={
  fabricId:string;
  revisionId:string;
  quantityMetres:number;
  requestedBy:string;
  sourceReference:string;
};
type AttemptStorage={getItem(key:string):string|null;setItem(key:string,value:string):void};
const STORAGE_KEY="linen-earth:reservation-attempts:v2";

export function createStockReservationAttemptTracker(
  makeKey:()=>string,
  getStorage:()=>AttemptStorage=()=>window.sessionStorage,
){
  // Reuse the manual journal's SHA-256 evidence digest, validation, immutable
  // key history and fail-closed full/corrupted/storage-denied handling.
  // Store only hashes and opaque UUID keys, not customer, tailor or revision
  // data, and keep reservations isolated from manual fabric receipts.
  const journal=createStockManualAttemptTracker(makeKey,getStorage,STORAGE_KEY);
  return {
    async keyFor(request:StockReservationAttempt):Promise<string>{
      return journal.keyFor({
        fabricId:request.fabricId.trim().slice(0,160),
        eventType:"reservation",
        quantityMetres:request.quantityMetres,
        note:request.revisionId.trim().slice(0,220),
        recordedBy:request.requestedBy.trim().slice(0,120),
        sourceReference:request.sourceReference.trim().slice(0,240),
      });
    },
  };
}
