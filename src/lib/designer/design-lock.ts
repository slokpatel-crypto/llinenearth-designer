import type { CanonicalGarmentSpec } from "@/lib/designer/garment-spec";

export const LOCKED_DESIGN_VERSION="linen-earth-design-lock-v1" as const;

export type LockedDesignRevision={
  version:typeof LOCKED_DESIGN_VERSION;
  revisionId:string;
  parentRevisionId:string|null;
  recipeHash:string;
  lockedAt:string;
  garmentSpec:CanonicalGarmentSpec;
};

function canonicalize(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(canonicalize);
  if(value && typeof value==="object") {
    return Object.fromEntries(
      Object.entries(value as Record<string,unknown>)
        .sort(([a],[b])=>a.localeCompare(b))
        .map(([key,item])=>[key,canonicalize(item)]),
    );
  }
  return value;
}

// A SHA256 of JSON is not proof of physical validity. JSON.stringify silently
// converts NaN/Infinity to null; reject malformed finished-garment targets
// before such values can be locked or printed as tailor-ready centimetres.
function validFinishedTargets(spec:CanonicalGarmentSpec):boolean {
  for(const part of [spec.shirt,spec.trouser]){
    if(!part||!Array.isArray(part.finishedTargets)) return false;
    for(const target of part.finishedTargets){
      if(!target||typeof target!=="object"||
        typeof target.label!=="string"||!target.label.trim()||
        typeof target.bodyCm!=="number"||!Number.isFinite(target.bodyCm)||
        target.bodyCm<=0||target.bodyCm>350||
        !target.finishedCm||typeof target.finishedCm!=="object"||
        !Number.isFinite(target.finishedCm.min)||!Number.isFinite(target.finishedCm.max)||
        target.finishedCm.min<=0||target.finishedCm.max>450||
        target.finishedCm.min>target.finishedCm.max||
        !["body_plus_ease","recorded_anchor","customer_desired"].includes(target.basis)) return false;
      if(target.easeCm!==undefined&&(
        !target.easeCm||typeof target.easeCm!=="object"||
        !Number.isFinite(target.easeCm.min)||!Number.isFinite(target.easeCm.max)||
        target.easeCm.min>target.easeCm.max||
        target.easeCm.min< -100||target.easeCm.max>150)) return false;
    }
  }
  return true;
}

export function canonicalLockedDesignJson(spec:CanonicalGarmentSpec) {
  return JSON.stringify(canonicalize(spec));
}

async function sha256Hex(input:string) {
  const data=new TextEncoder().encode(input);
  const digest=await globalThis.crypto.subtle.digest("SHA-256",data);
  return Array.from(new Uint8Array(digest),(byte)=>byte.toString(16).padStart(2,"0")).join("");
}

// Existing stored revisions use the 14-digit UTC timestamp and first 12
// recipe-hash hex digits. Newer revisions append a random 64-bit nonce.
// Preserve both formats and detect malformed or mismatched timestamp/hash
// prefixes. The random nonce is not signed; vault ownership must be checked
// separately, and this validator cannot authenticate revision identity.
const REVISION_ID=/^LE-LOCK-(\d{14})-([0-9A-F]{12})(?:-([0-9A-F]{16}))?$/;

function safeTimestamp(value:string) {
  if(typeof value!=="string") throw new Error("lockedAt must be a valid timestamp");
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if(!match) throw new Error("lockedAt must be a valid timestamp");
  const [,yy,mm,dd,hh,mi,ss,zone]=match;
  const year=Number(yy),month=Number(mm),day=Number(dd);
  const calendar=new Date(Date.UTC(year,month-1,day));
  if(year<2000||month<1||month>12||day<1||day>31||
    calendar.getUTCFullYear()!==year||calendar.getUTCMonth()+1!==month||
    calendar.getUTCDate()!==day||Number(hh)>23||Number(mi)>59||Number(ss)>59)
    throw new Error("lockedAt must be a valid timestamp");
  if(zone!=="Z"){
    const hour=Number(zone.slice(1,3)),minute=Number(zone.slice(4,6));
    if(hour>14||minute>59||(hour===14&&minute!==0))
      throw new Error("lockedAt must be a valid timestamp");
  }
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) throw new Error("lockedAt must be a valid timestamp");
  return date.toISOString();
}

function revisionIdentityMatches(id:string,lockedAt:string,recipeHash:string) {
  const match=REVISION_ID.exec(id);
  return Boolean(match&&
    match[1]===lockedAt.replace(/[-:.TZ]/g,"").slice(0,14)&&
    match[2]===recipeHash.slice(0,12).toUpperCase());
}

export async function lockGarmentSpec(
  spec:CanonicalGarmentSpec,
  options:{parentRevisionId?:string|null;lockedAt?:string}={},
):Promise<LockedDesignRevision> {
  if(spec.version!=="linen-earth-garment-spec-v1") throw new Error("Unsupported garment specification version.");
  if(!validFinishedTargets(spec)) throw new Error("Invalid finished-garment measurement targets.");
  if(options.parentRevisionId!=null&&!REVISION_ID.test(options.parentRevisionId))
    throw new Error("Invalid parent revision identity.");
  const canonical=canonicalLockedDesignJson(spec);
  const recipeHash=await sha256Hex(canonical);
  const lockedAt=safeTimestamp(options.lockedAt ?? new Date().toISOString());
  const stamp=lockedAt.replace(/[-:.TZ]/g,"").slice(0,14);
  // A timestamp rounded to seconds plus a recipe hash is NOT a unique order
  // identity: two customers locking an identical recipe within one second
  // previously shared the same revision ID. A fresh 64-bit nonce separates
  // independently locked revisions while leaving the recipe hash stable.
  const nonce=Array.from(globalThis.crypto.getRandomValues(new Uint8Array(8)),
    byte=>byte.toString(16).padStart(2,"0")).join("").toUpperCase();
  const revisionId=`LE-LOCK-${stamp}-${recipeHash.slice(0,12).toUpperCase()}-${nonce}`;
  const clone=JSON.parse(canonical) as CanonicalGarmentSpec;
  return {
    version:LOCKED_DESIGN_VERSION,
    revisionId,
    parentRevisionId:options.parentRevisionId??null,
    recipeHash,
    lockedAt,
    garmentSpec:clone,
  };
}

/**
 * Remote vault payloads and browser restores are untrusted JSON. A malformed
 * locked revision must be a rejected design, not an uncaught TypeError that
 * turns a corrupt record into an unrelated vault-service outage.
 *
 * A recipe hash proves integrity of the garment recipe; it is not a signature
 * on account ownership, identity metadata, or physical tailoring acceptance.
 */
export async function verifyLockedDesignRevision(value:unknown):Promise<boolean> {
  if(!value||typeof value!=="object"||Array.isArray(value)) return false;
  const revision=value as Partial<LockedDesignRevision>;
  if(revision.version!==LOCKED_DESIGN_VERSION ||
    typeof revision.revisionId!=="string"||
    typeof revision.lockedAt!=="string"||
    !(revision.parentRevisionId===null||
      (typeof revision.parentRevisionId==="string"&&REVISION_ID.test(revision.parentRevisionId))) ||
    typeof revision.recipeHash!=="string"||!/^[0-9a-f]{64}$/.test(revision.recipeHash) ||
    !revision.garmentSpec||typeof revision.garmentSpec!=="object"||
    Array.isArray(revision.garmentSpec)||revision.garmentSpec.version!=="linen-earth-garment-spec-v1"
  ) return false;
  try{
    // Locked revisions always store normalized ISO UTC. This rejects
    // impossible/normalized dates and protects the timestamp/hash fields
    // embedded in the revision ID; it does not authenticate vault ownership.
    if(!validFinishedTargets(revision.garmentSpec)||
      safeTimestamp(revision.lockedAt)!==revision.lockedAt||
      !revisionIdentityMatches(revision.revisionId,revision.lockedAt,revision.recipeHash)||
      revision.parentRevisionId===revision.revisionId) return false;
    const hash=await sha256Hex(canonicalLockedDesignJson(revision.garmentSpec));
    return hash===revision.recipeHash;
  }catch{return false;}
}

export function reconstructLockedGarmentSpec(revision:LockedDesignRevision):CanonicalGarmentSpec {
  return JSON.parse(canonicalLockedDesignJson(revision.garmentSpec)) as CanonicalGarmentSpec;
}
