/**
 * Non-cryptographic local integrity fingerprint. This only prevents deleting an
 * unrelated browser measurement snapshot after named profile switches/edits.
 * It is NOT a security/authentication signature.
 */
export const ACTIVE_CUSTOMER_MEASUREMENT_LINK_KEY="linen-earth-active-customer-measurement-link-v1";

export type ActiveCustomerMeasurementLink={version:1;profileId:string;digest:string};

function digestSnapshot(snapshot:string):string{
  let hash=0xcbf29ce484222325n;
  for(const char of snapshot){
    hash=BigInt.asUintN(64,(hash^BigInt(char.codePointAt(0)||0))*0x100000001b3n);
  }
  return hash.toString(16).padStart(16,"0");
}

export function serializeActiveCustomerMeasurementLink(profileId:string,snapshot:string):string{
  if(!profileId.trim()||!snapshot) throw new Error("Cannot link an empty measurement snapshot.");
  return JSON.stringify({version:1,profileId,digest:digestSnapshot(snapshot)});
}

export function parseActiveCustomerMeasurementLink(raw:string|null):ActiveCustomerMeasurementLink|null{
  if(!raw) return null;
  try{
    const item:unknown=JSON.parse(raw);
    if(!item||typeof item!=="object"||Array.isArray(item)) return null;
    const value=item as Record<string,unknown>;
    if(value.version!==1||typeof value.profileId!=="string"||!value.profileId.trim()||
      typeof value.digest!=="string"||!/^[0-9a-f]{16}$/.test(value.digest)) return null;
    return {version:1,profileId:value.profileId,digest:value.digest};
  }catch{return null;}
}

export function matchesActiveCustomerMeasurementSnapshot(
  link:ActiveCustomerMeasurementLink|null,profileId:string,snapshot:string|null,
):boolean{
  return Boolean(link&&snapshot&&link.profileId===profileId&&link.digest===digestSnapshot(snapshot));
}
