/** No customer details, tokens, notes or quote/order identifiers are persisted.
 * A pending marker is written BEFORE a potentially durable production POST.
 * Local storage is an operator UI crash/reload safeguard, not SQL idempotency. */
export const PRODUCTION_WRITE_HOLD_KEY="linen-earth:production:unverified-write:v1";

export type ProductionHoldStorage={
  getItem(key:string):string|null;
  setItem(key:string,value:string):void;
  removeItem(key:string):void;
};

export function productionWriteHoldPending(storage:ProductionHoldStorage):boolean{
  try{return storage.getItem(PRODUCTION_WRITE_HOLD_KEY)!==null;}
  catch{return true;} // unavailable storage may conceal an unconfirmed write
}

/** Claim the marker synchronously before issuing POST, failing closed if
 * storage is unavailable or another unreviewed write is already pending. */
export function beginProductionWriteHold(storage:ProductionHoldStorage,token:string):boolean{
  if(typeof token!=="string"||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(token))return false;
  try{
    if(storage.getItem(PRODUCTION_WRITE_HOLD_KEY)!==null)return false;
    storage.setItem(PRODUCTION_WRITE_HOLD_KEY,token);
    return storage.getItem(PRODUCTION_WRITE_HOLD_KEY)===token;
  }catch{return false;}
}

/** Never remove a marker created by another tab; only a matching token can
 * clear a confirmed write or an explicitly rejected pre-RPC request. */
export function releaseProductionWriteHold(storage:ProductionHoldStorage,token:string):boolean{
  try{
    if(storage.getItem(PRODUCTION_WRITE_HOLD_KEY)!==token)return false;
    storage.removeItem(PRODUCTION_WRITE_HOLD_KEY);
    return storage.getItem(PRODUCTION_WRITE_HOLD_KEY)===null;
  }catch{return false;}
}

/** Explicit operator acknowledgement after a verified ledger refresh.
 * This does not prove that any unacknowledged write was uncommitted. */
export function acknowledgeProductionWriteHold(storage:ProductionHoldStorage):boolean{
  try{
    const token=storage.getItem(PRODUCTION_WRITE_HOLD_KEY);
    return typeof token==="string"&&token.length>0
      &&releaseProductionWriteHold(storage,token);
  }catch{return false;}
}
