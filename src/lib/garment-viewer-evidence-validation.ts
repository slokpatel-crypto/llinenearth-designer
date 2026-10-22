import {
  calibratedGarmentScaleErrorPct,
  GARMENT_VIEWER_LATENCY_STORAGE_KEY,
  GARMENT_VIEWER_REALISM_STORAGE_KEY,
  parseGarmentEvidenceFabricId,
  type GarmentViewerPatternScaleSample,
} from "./garment-viewer-readiness.ts";
import type { RealismAssessment } from "./designer/proof-scale.ts";

// Never coerce JSON evidence: Number(null), Number(false), and Number("")
// could fabricate a perfect measurement or zero-duration timing sample.
const parsePositive=(value:unknown,max:number)=>typeof value==="number"
  && Number.isFinite(value) && value>0 && value<=max ? value : null;

// Display rounding must not turn a finite, extreme failure into Infinity in JSON.
const displayScaleError=(error:number)=>error<=Number.MAX_VALUE/100
  ? Math.round(error*100)/100 : error;

export function parseGarmentPatternSamples(value:unknown):GarmentViewerPatternScaleSample[] {
  if(!Array.isArray(value)) return [];
  return value.slice(-20).flatMap((item)=>{
    if(!item || typeof item!=="object" || Array.isArray(item)) return [];
    const row=item as Record<string,unknown>;
    const fabricId=parseGarmentEvidenceFabricId(row.fabricId);
    const pattern=row.pattern;
    if(!fabricId || (pattern!=="stripe" && pattern!=="check" && pattern!=="other")) return [];
    const claimedPct=row.errorPct;
    const candidate:GarmentViewerPatternScaleSample={
      fabricId,pattern,errorPct:0,verified:false,
      ...(parsePositive(row.physicalRepeatMm,1000)!==null?{physicalRepeatMm:row.physicalRepeatMm as number}:{}),
      ...(parsePositive(row.renderedRepeatPx,10000)!==null?{renderedRepeatPx:row.renderedRepeatPx as number}:{}),
      ...(parsePositive(row.referenceLengthMm,3000)!==null?{referenceLengthMm:row.referenceLengthMm as number}:{}),
      ...(parsePositive(row.referenceLengthPx,10000)!==null?{referenceLengthPx:row.referenceLengthPx as number}:{}),
      ...(typeof row.evidenceReference==="string" && row.evidenceReference.length<=240
        ?{evidenceReference:row.evidenceReference.trim()}:{}),
    };
    const derived=calibratedGarmentScaleErrorPct(candidate);
    if(derived!==null) return [{...candidate,errorPct:displayScaleError(derived),verified:row.verified===true}];
    // Keep legacy records for audit, but explicitly revoke their unverifiable
    // "verified" flag. No claimed-only percentage can pass a future gate.
    if(typeof claimedPct!=="number" || !Number.isFinite(claimedPct) || claimedPct<0 || claimedPct>100) return [];
    return [{fabricId,pattern,errorPct:claimedPct,verified:false}];
  });
}

/**
 * A submitted operator QA event must never quietly lose a failing fabric row,
 * change a verified measurement into legacy history, or hide earlier rows by
 * exceeding the bounded audit sample limit. Historical persisted events are
 * still read through parseGarmentPatternSamples for backwards compatibility.
 */
export function garmentPatternSubmissionIsLossless(value:unknown):boolean {
  if(value===undefined) return true; // Older V1 writers may omit empty evidence.
  if(!Array.isArray(value) || value.length>20) return false;
  const parsed=parseGarmentPatternSamples(value);
  if(parsed.length!==value.length) return false;
  return value.every((row,index)=>{
    const submitted=row as Record<string,unknown>;
    return submitted.verified!==true || parsed[index].verified===true;
  });
}

export function parseGarmentLatencySamples(value:unknown):number[] {
  if(!Array.isArray(value)) return [];
  return value.filter((item):item is number=>typeof item==="number"
    && Number.isFinite(item) && item>0 && item<=10000).slice(-120);
}

export function parseGarmentRealismAssessments(value:unknown):RealismAssessment[] {
  if(!Array.isArray(value)) return [];
  return value.slice(-50).flatMap((item)=>{
    if(!item || typeof item!=="object" || Array.isArray(item)) return [];
    const row=item as Record<string,unknown>;
    const viewerId=typeof row.viewerId==="string" ? row.viewerId.trim().toLowerCase().slice(0,80) : "";
    const rating=row.rating;
    if(viewerId.length<2 || typeof rating!=="number" || !Number.isInteger(rating)
      || rating<1 || rating>5) return [];
    return [{viewerId,rating,recordedAt:typeof row.recordedAt==="string"
      ? row.recordedAt.slice(0,80) : ""}];
  });
}


/**
 * New operator submissions must retain every latency observation. Invalid or
 * out-of-range durations, or an oversized batch, can otherwise be removed by
 * the backwards-compatible parser and conceal a failing p95 result.
 */
export function garmentLatencySubmissionIsLossless(value:unknown):boolean {
  if(value===undefined) return true;
  if(!Array.isArray(value) || value.length>120) return false;
  const parsed=parseGarmentLatencySamples(value);
  // Preserve every finite timing sample exactly; rounding before storage can
  // turn a true p95 failure into a false pass near the latency threshold.
  return parsed.length===value.length;
}

/**
 * New realism ratings must not be silently dropped or have their viewer
 * identities truncated. Historical records still use the permissive reader.
 */
export function garmentRealismSubmissionIsLossless(value:unknown):boolean {
  if(value===undefined) return true;
  if(!Array.isArray(value) || value.length>50) return false;
  const parsed=parseGarmentRealismAssessments(value);
  if(parsed.length!==value.length) return false;
  const seen=new Set<string>();
  return value.every((item,index)=>{
    const row=item as Record<string,unknown>;
    if(typeof row.viewerId!=="string") return false;
    const viewerId=row.viewerId.trim().toLowerCase();
    if(viewerId.length<2 || viewerId.length>80 || seen.has(viewerId)) return false;
    seen.add(viewerId);
    if(row.recordedAt!==undefined
      && (typeof row.recordedAt!=="string" || row.recordedAt.length>80)) return false;
    return parsed[index].viewerId===viewerId;
  });
}


/** Read a model-revision-scoped lab cache without hiding corrupt observations. */
export function readGarmentViewerScopedCache<T>(
  raw:string|null,
  storageKey:string,
  assetKey:string,
  fallback:T,
):T|null {
  if(raw===null) return fallback;
  try {
    const parsed:unknown=JSON.parse(raw);
    if(!parsed || typeof parsed!=="object" || Array.isArray(parsed)) return null;
    const cache=parsed as Record<string,unknown>;
    if(typeof cache.assetKey!=="string" || !cache.assetKey) return null;
    // A valid older asset cache is irrelevant to this model revision.
    if(cache.assetKey!==assetKey) return fallback;
    if(storageKey===GARMENT_VIEWER_LATENCY_STORAGE_KEY) {
      return Array.isArray(cache.samples)?cache.samples as T:null;
    }
    if(storageKey===GARMENT_VIEWER_REALISM_STORAGE_KEY) {
      return Object.prototype.hasOwnProperty.call(cache,"value")?cache.value as T:null;
    }
    return null;
  } catch {
    return null;
  }
}

const measure=(text:string,max:number)=>{
  const input=text.trim();
  if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(input)) return null;
  return parsePositive(Number(input),max);
};

export function parseMeasuredScaleInput(
  fabricId:string,
  physicalRepeatMmInput:string,
  renderedRepeatPxInput:string,
  referenceLengthMmInput:string,
  referenceLengthPxInput:string,
  evidenceReferenceInput:string,
  pattern:"stripe"|"check",
  verified:boolean,
):GarmentViewerPatternScaleSample|null {
  const fabric=parseGarmentEvidenceFabricId(fabricId);
  const physicalRepeatMm=measure(physicalRepeatMmInput,1000);
  const renderedRepeatPx=measure(renderedRepeatPxInput,10000);
  const referenceLengthMm=measure(referenceLengthMmInput,3000);
  const referenceLengthPx=measure(referenceLengthPxInput,10000);
  const evidenceReference=evidenceReferenceInput.trim();
  if(fabric===null || physicalRepeatMm===null || renderedRepeatPx===null
    || referenceLengthMm===null || referenceLengthPx===null
    || evidenceReference.length<8 || evidenceReference.length>240) return null;
  const candidate:GarmentViewerPatternScaleSample={
    fabricId:fabric,pattern,errorPct:0,verified,physicalRepeatMm,renderedRepeatPx,
    referenceLengthMm,referenceLengthPx,evidenceReference,
  };
  const derived=calibratedGarmentScaleErrorPct(candidate);
  return derived===null ? null : {...candidate,errorPct:displayScaleError(derived)};
}

export function normalizeGarmentViewerEvidenceForStorage(payload:Record<string,unknown>) {
  return {
    patternScaleSamples:parseGarmentPatternSamples(payload.patternScaleSamples),
    interactionLatencyMs:parseGarmentLatencySamples(payload.interactionLatencyMs),
    realismAssessments:parseGarmentRealismAssessments(payload.realismAssessments),
  };
}
