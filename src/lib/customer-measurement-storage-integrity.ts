/**
 * Browser-local measurement profiles may predate the current UI or contain
 * partially written / edited JSON. Never trust a parsed localStorage array.
 * Keep valid legacy identities without silently rewriting customer records.
 */
const measurementKeys=new Set([
  "chest","waist","shoulder","sleeveLength","neck","hip","shirtLength",
  "trouserWaist","trouserLength","inseam",
]);

type StoredProfile={
  id:string;name:string;unit:"cm"|"in";updatedAt:string;
  measurements:Record<string,number>;
};

function record(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}

export function validStoredCustomerMeasurementProfiles<T extends StoredProfile>(raw:unknown):T[]{
  if(!Array.isArray(raw)) return [];
  const seen=new Set<string>();
  const valid:T[]=[];
  for(const entry of raw){
    if(!record(entry)) continue;
    if(typeof entry.id!=="string"||!entry.id.trim()||seen.has(entry.id)) continue;
    if(typeof entry.name!=="string"||!entry.name.trim()) continue;
    if(entry.unit!=="cm"&&entry.unit!=="in") continue;
    if(typeof entry.updatedAt!=="string"||!Number.isFinite(Date.parse(entry.updatedAt))) continue;
    if(!record(entry.measurements)) continue;
    if(!Object.entries(entry.measurements).every(([key,value])=>
      measurementKeys.has(key)&&typeof value==="number"&&
      Number.isFinite(value)&&value>0&&value<=254
    )) continue;
    seen.add(entry.id);
    valid.push(entry as T);
    if(valid.length>=20) break;
  }
  return valid;
}

export function makeCustomerMeasurementProfileId(randomBytes:Uint8Array,now:number):string{
  if(randomBytes.length<16||!Number.isSafeInteger(now)||now<0)
    throw new Error("Invalid customer measurement profile ID entropy.");
  const nonce=Array.from(randomBytes.slice(0,16),byte=>byte.toString(16).padStart(2,"0")).join("");
  return `CMP-${now}-${nonce}`;
}
