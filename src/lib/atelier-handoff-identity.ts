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
  const hasText=(value:unknown):value is string=>typeof value==="string" && Boolean(value.trim());
  const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value) && typeof value==="object" && !Array.isArray(value);
  return value.filter((candidate):candidate is T=>{
    if(!isRecord(candidate)) return false;
    const row=candidate;
    if(!["id","designId","specHash","createdAt","title"].every((field)=>hasText(row[field]))) return false;
    if(!["requested","in_review","fabric_check","ready_for_consultation"].includes(String(row.status))) return false;
    if(!["customerNote","occasion","venue","aesthetic","uploadedFabric"].every((field)=>typeof row[field]==="string")) return false;
    if(row.staffNote!==undefined && typeof row.staffNote!=="string") return false;
    if(!isRecord(row.garmentSpec) || !["shirt","trouser","layer","footwear"].every(
      (field)=>typeof (row.garmentSpec as Record<string,unknown>)[field]==="string"
    )) return false;
    if(!isRecord(row.fabricAssessment)) return false;
    const assessment=row.fabricAssessment;
    if(typeof assessment.score!=="number" || !Number.isFinite(assessment.score) ||
      !hasText(assessment.verdict) || !hasText(assessment.preferredRole) ||
      typeof assessment.bestOutfitType!=="string" ||
      !Array.isArray(assessment.reasons) || !assessment.reasons.every((reason)=>typeof reason==="string")) return false;
    if(!Array.isArray(row.palette) || !row.palette.every((color)=>typeof color==="string")) return false;
    if(!Array.isArray(row.idealStoreFabrics) || !row.idealStoreFabrics.every((fabric)=>
      isRecord(fabric) && ["id","name","reason"].every((field)=>typeof fabric[field]==="string")
    )) return false;
    return true;
  }).slice(0,50);
}

/** Generate a collision-resistant browser-local handoff ID without a timestamp-only nonce. */
export function makeAtelierHandoffId(specHash:string,designId:string,randomBytes:Uint8Array):string {
  if(randomBytes.length!==16) throw new Error("Atelier handoff identity requires 128 bits of randomness.");
  const suffix=Array.from(randomBytes,(byte)=>byte.toString(16).padStart(2,"0")).join("").toUpperCase();
  return `HO-${specHash||designId}-${suffix}`;
}
