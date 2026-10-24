/**
 * Browser feedback describes one customer's saved design version. Cloth and
 * construction hashes are not customer identifiers. This local cache is
 * untrusted and must never be confused with a production feedback inbox.
 */
export function validStoredFeedback<T>(value:unknown,limit=100):T[] {
  if(!Array.isArray(value)) return [];
  const record=(v:unknown):v is Record<string,unknown>=>v!==null && typeof v==="object" && !Array.isArray(v);
  const named=(v:unknown):v is string=>typeof v==="string" && Boolean(v.trim());
  return value.filter((item):item is T=>{
    if(!record(item)) return false;
    if(!["id","designId","specHash","createdAt"].every((field)=>named(item[field]))) return false;
    if(!["love","good","needs_work"].includes(String(item.rating))) return false;
    if(!["pending_review","reviewed"].includes(String(item.reviewStatus))) return false;
    return typeof item.note==="string" && Array.isArray(item.reasons) &&
      item.reasons.every((reason)=>typeof reason==="string");
  }).slice(0,limit);
}

export function mergeDistinctDesignFeedback<T extends {designId:string;specHash:string}>(
  previous:readonly T[],
  item:T,
  limit=100,
):T[] {
  return [item,...previous.filter((row)=>
    row.designId!==item.designId || row.specHash!==item.specHash
  )].slice(0,limit);
}

export function makeFeedbackId(specHash:string,randomBytes:Uint8Array):string {
  if(randomBytes.length!==16) throw new Error("Feedback ID requires 128 cryptographic bits.");
  const suffix=Array.from(randomBytes,(byte)=>byte.toString(16).padStart(2,"0")).join("").toUpperCase();
  return `FB-${specHash}-${suffix}`;
}
