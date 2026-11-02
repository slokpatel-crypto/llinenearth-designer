// Manual stock write identity survives a tab reload without putting supplier
// references or roll notes into browser storage. The server-side v3 SQL remains
// the authority for exact payload matching and replay protection.
export type ManualStockAttempt={
  fabricId:string;eventType:string;quantityMetres:number;note:string;
  recordedBy:string;sourceReference:string;
};
type AttemptStorage={getItem(key:string):string|null;setItem(key:string,value:string):void};
type StoredAttempt={fingerprint:string;key:string};
const STORAGE_KEY="linen-earth:manual-stock-attempts:v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256=/^[0-9a-f]{64}$/;
const MAX_ATTEMPTS=64;
function normalize(value:string,maxLength:number):string{
  // Keep this byte-for-byte equivalent to the manual event normalizer at the
  // operator API boundary. Otherwise two inputs which record the SAME SQL
  // evidence could acquire distinct request keys and double-count stock.
  return value.replace(/\s+/g," ").trim().slice(0,maxLength);
}
function fingerprint(record:ManualStockAttempt):string{
  return JSON.stringify([
    record.fabricId.trim().slice(0,160),record.eventType,
    Math.round(record.quantityMetres*1000)/1000,
    normalize(record.note,600),normalize(record.recordedBy,120),
    normalize(record.sourceReference,240),
  ]);
}
async function digest(value:string):Promise<string>{
  const bytes=new TextEncoder().encode(value);
  const result=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(result),x=>x.toString(16).padStart(2,"0")).join("");
}
function parseAttempts(raw:string|null):StoredAttempt[]{
  if(raw===null)return [];
  const value:unknown=JSON.parse(raw);
  if(!Array.isArray(value)||value.length>MAX_ATTEMPTS||!value.every(x=>
    x&&typeof x==="object"&&typeof x.fingerprint==="string"&&
    SHA256.test(x.fingerprint)&&typeof x.key==="string"&&UUID.test(x.key)))
    throw new Error("Invalid saved stock attempt journal.");
  return value as StoredAttempt[];
}
export function createStockManualAttemptTracker(
  makeKey:()=>string,
  getStorage:()=>AttemptStorage=()=>window.sessionStorage,
){
  return {
    async keyFor(record:ManualStockAttempt):Promise<string>{
      // Failure to read/persist retry identity must prevent the network write.
      // A fresh random key after losing a prior attempt could duplicate cloth.
      try{
        const identity=await digest(fingerprint(record));
        const storage=getStorage();
        const attempts=parseAttempts(storage.getItem(STORAGE_KEY));
        const previous=attempts.find(item=>item.fingerprint===identity);
        if(previous)return previous.key;
        // Evicting an old key would make the same physical receipt writable
        // again. Stop and reconcile instead of silently dropping retry history.
        if(attempts.length>=MAX_ATTEMPTS)
          throw new Error("Manual stock retry journal is full.");
        const key=makeKey();
        if(!UUID.test(key))throw new Error("Invalid generated stock key.");
        storage.setItem(STORAGE_KEY,JSON.stringify([...attempts,{fingerprint:identity,key}]));
        return key;
      }catch{
        throw new Error("Stock retry tracking is unavailable in this browser tab. No stock movement was sent; reconcile earlier entries before trying again.");
      }
    },
  };
}
