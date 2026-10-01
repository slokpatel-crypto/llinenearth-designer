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

export function canonicalLockedDesignJson(spec:CanonicalGarmentSpec) {
  return JSON.stringify(canonicalize(spec));
}

async function sha256Hex(input:string) {
  const data=new TextEncoder().encode(input);
  const digest=await globalThis.crypto.subtle.digest("SHA-256",data);
  return Array.from(new Uint8Array(digest),(byte)=>byte.toString(16).padStart(2,"0")).join("");
}

function safeTimestamp(value:string) {
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) throw new Error("lockedAt must be a valid timestamp");
  return date.toISOString();
}

export async function lockGarmentSpec(
  spec:CanonicalGarmentSpec,
  options:{parentRevisionId?:string|null;lockedAt?:string}={},
):Promise<LockedDesignRevision> {
  if(spec.version!=="linen-earth-garment-spec-v1") throw new Error("Unsupported garment specification version.");
  const canonical=canonicalLockedDesignJson(spec);
  const recipeHash=await sha256Hex(canonical);
  const lockedAt=safeTimestamp(options.lockedAt ?? new Date().toISOString());
  const stamp=lockedAt.replace(/[-:.TZ]/g,"").slice(0,14);
  const revisionId=`LE-LOCK-${stamp}-${recipeHash.slice(0,12).toUpperCase()}`;
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

export async function verifyLockedDesignRevision(revision:LockedDesignRevision) {
  if(revision.version!==LOCKED_DESIGN_VERSION) return false;
  const hash=await sha256Hex(canonicalLockedDesignJson(revision.garmentSpec));
  return hash===revision.recipeHash;
}

export function reconstructLockedGarmentSpec(revision:LockedDesignRevision):CanonicalGarmentSpec {
  return JSON.parse(canonicalLockedDesignJson(revision.garmentSpec)) as CanonicalGarmentSpec;
}
