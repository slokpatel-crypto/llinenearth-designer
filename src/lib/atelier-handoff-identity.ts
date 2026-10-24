/**
 * A specification hash identifies *cloth and construction*, not the saved
 * design or customer. Two different designs can share that exact spec while
 * requiring independent consultations and notes.
 */
export function mergeDistinctAtelierHandoffs<T extends {designId:string;specHash:string}>(
  previous:readonly T[],
  next:T,
  limit=50,
):T[] {
  return [
    next,
    ...previous.filter((item)=>item.designId!==next.designId || item.specHash!==next.specHash),
  ].slice(0,limit);
}

/**
 * Browser storage is untrusted. A malformed/older JSON array must not crash
 * subsequent customer requests or the Atelier dashboard. This checks the
 * fields the existing handoff UI relies on, without rewriting valid records.
 */
export function validStoredAtelierHandoffs<T extends {
  id:string;designId:string;specHash:string;createdAt:string;title:string;status:string;
}>(value:unknown):T[] {
  if(!Array.isArray(value)) return [];
  return value.filter((candidate):candidate is T=>{
    if(!candidate || typeof candidate!=="object" || Array.isArray(candidate)) return false;
    const row=candidate as Record<string,unknown>;
    if(!["id","designId","specHash","createdAt","title","status"].every(
      (field)=>typeof row[field]==="string" && Boolean((row[field] as string).trim())
    )) return false;
    return Boolean(row.garmentSpec && typeof row.garmentSpec==="object" &&
      !Array.isArray(row.garmentSpec) && row.fabricAssessment &&
      typeof row.fabricAssessment==="object" && !Array.isArray(row.fabricAssessment) &&
      Array.isArray(row.palette) && Array.isArray(row.idealStoreFabrics));
  });
}
