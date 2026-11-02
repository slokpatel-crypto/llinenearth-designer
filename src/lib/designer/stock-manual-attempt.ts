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
function normalize(value:string):string{return value.replace(/\s+/g," ").trim();}
function fingerprint(record:ManualStockAttempt):string{
  return JSON.stringify([
    record.fabricId.trim(),record.eventType,record.quantityMetres,
    normalize(record.note),normalize(record.recordedBy),normalize(record.sourceReference),
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
        const key=makeKey();
        if(!UUID.test(key))throw new Error("Invalid generated stock key.");
        storage.setItem(STORAGE_KEY,JSON.stringify([
          ...attempts.slice(-(MAX_ATTEMPTS-1)),{fingerprint:identity,key},
        ]));
        return key;
      }catch{
        throw new Error("Stock retry tracking is unavailable in this browser tab. No stock movement was sent; reconcile earlier entries before trying again.");
      }
    },
  };
}
