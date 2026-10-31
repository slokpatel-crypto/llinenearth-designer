/** No customer details, tokens, notes or quote/order identifiers are persisted.
 * A pending marker is written BEFORE a potentially durable production POST.
 * Local storage is an operator UI crash/reload safeguard, not SQL idempotency. */
export const PRODUCTION_WRITE_HOLD_KEY="linen-earth:production:unverified-write:v1";
// Anonymous last-write generation survives a confirmed marker release, so an
// in-flight export can detect another tab's completed write, not just its hold.
export const PRODUCTION_WRITE_EPOCH_KEY="linen-earth:production:write-epoch:v1";

export type ProductionHoldStorage={
  getItem(key:string):string|null;
  setItem(key:string,value:string):void;
  removeItem(key:string):void;
};

export function productionWriteHoldPending(storage:ProductionHoldStorage|null|undefined):boolean{
  if(!storage)return true;
  try{return storage.getItem(PRODUCTION_WRITE_HOLD_KEY)!==null;}
  catch{return true;} // unavailable storage may conceal an unconfirmed write
}

/** Recover the original anonymous v4 UUID after a crash without copying
 * request bodies or secrets. Invalid/inaccessible marker never permits a retry. */
export function readProductionWriteHoldKey(storage:ProductionHoldStorage|null|undefined):string|null{
  if(!storage)return null;
  try{
    const token=storage.getItem(PRODUCTION_WRITE_HOLD_KEY);
    return typeof token==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token)
      ?token.toLowerCase():null;
  }catch{return null;}
}

/** Claim the marker synchronously before issuing POST, failing closed if
 * storage is unavailable or another unreviewed write is already pending. */
export function beginProductionWriteHold(storage:ProductionHoldStorage|null|undefined,token:string):boolean{
  if(!storage)return false;
  if(typeof token!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token))return false;
  try{
    if(storage.getItem(PRODUCTION_WRITE_HOLD_KEY)!==null)return false;
    storage.setItem(PRODUCTION_WRITE_HOLD_KEY,token);
    if(storage.getItem(PRODUCTION_WRITE_HOLD_KEY)!==token)return false;
    // Keep this anonymous generation after successful release. A failed epoch
    // write leaves the hold in place and MUST NOT authorize a production POST.
    storage.setItem(PRODUCTION_WRITE_EPOCH_KEY,token);
    return storage.getItem(PRODUCTION_WRITE_HOLD_KEY)===token
      && storage.getItem(PRODUCTION_WRITE_EPOCH_KEY)===token;
  }catch{return false;}
}

/** Never remove a marker created by another tab; only a matching token can
 * clear a confirmed write or an explicitly rejected pre-RPC request. */
export function releaseProductionWriteHold(storage:ProductionHoldStorage|null|undefined,token:string):boolean{
  if(!storage)return false;
  try{
    if(storage.getItem(PRODUCTION_WRITE_HOLD_KEY)!==token)return false;
    storage.removeItem(PRODUCTION_WRITE_HOLD_KEY);
    return storage.getItem(PRODUCTION_WRITE_HOLD_KEY)===null;
  }catch{return false;}
}

/** Explicit operator acknowledgement after a verified ledger refresh.
 * This does not prove that any unacknowledged write was uncommitted. */
export function acknowledgeProductionWriteHold(storage:ProductionHoldStorage|null|undefined):boolean{
  if(!storage)return false;
  try{
    const token=storage.getItem(PRODUCTION_WRITE_HOLD_KEY);
    return typeof token==="string"&&token.length>0
      &&releaseProductionWriteHold(storage,token);
  }catch{return false;}
}

/** Capture a stable, privacy-safe generation only when there is no pending
 * cross-tab write. The empty string represents a pre-upgrade clean browser.
 * Invalid or inaccessible storage fails closed. */
export function captureProductionWriteEpoch(storage:ProductionHoldStorage|null|undefined):string|null{
  if(!storage)return null;
  try{
    if(storage.getItem(PRODUCTION_WRITE_HOLD_KEY)!==null)return null;
    const epoch=storage.getItem(PRODUCTION_WRITE_EPOCH_KEY);
    if(epoch===null)return "";
    return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(epoch)
      ?epoch.toLowerCase():null;
  }catch{return null;}
}

/** A packet may be downloaded only if no other tab began a production write
 * (even one already confirmed) since its fresh ledger read started. */
export function productionWriteEpochUnchanged(
  storage:ProductionHoldStorage|null|undefined, captured:string|null,
):boolean{
  return captured!==null&&captureProductionWriteEpoch(storage)===captured;
}
