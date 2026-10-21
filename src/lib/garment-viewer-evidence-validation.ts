import {
  calibratedGarmentScaleErrorPct,
  type GarmentViewerPatternScaleSample,
} from "./garment-viewer-readiness.ts";
import type { RealismAssessment } from "./designer/proof-scale.ts";

// Never coerce JSON evidence: Number(null), Number(false), and Number("")
// could fabricate a perfect measurement or zero-duration timing sample.
const parsePositive=(value:unknown,max:number)=>typeof value==="number"
  && Number.isFinite(value) && value>0 && value<=max ? value : null;

export function parseGarmentPatternSamples(value:unknown):GarmentViewerPatternScaleSample[] {
  if(!Array.isArray(value)) return [];
  return value.slice(-20).flatMap((item)=>{
    if(!item || typeof item!=="object" || Array.isArray(item)) return [];
    const row=item as Record<string,unknown>;
    const fabricId=typeof row.fabricId==="string" ? row.fabricId.trim().slice(0,160) : "";
    const pattern=row.pattern;
    if(!fabricId || (pattern!=="stripe" && pattern!=="check" && pattern!=="other")) return [];
    const claimedPct=row.errorPct;
    const candidate:GarmentViewerPatternScaleSample={
      fabricId,pattern,errorPct:0,verified:false,
      ...(parsePositive(row.physicalRepeatMm,1000)!==null?{physicalRepeatMm:row.physicalRepeatMm as number}:{}),
      ...(parsePositive(row.renderedRepeatPx,10000)!==null?{renderedRepeatPx:row.renderedRepeatPx as number}:{}),
      ...(parsePositive(row.referenceLengthMm,3000)!==null?{referenceLengthMm:row.referenceLengthMm as number}:{}),
      ...(parsePositive(row.referenceLengthPx,10000)!==null?{referenceLengthPx:row.referenceLengthPx as number}:{}),
      ...(typeof row.evidenceReference==="string"?{evidenceReference:row.evidenceReference.trim().slice(0,240)}:{}),
    };
    const derived=calibratedGarmentScaleErrorPct(candidate);
    if(derived!==null) return [{...candidate,errorPct:Math.round(derived*100)/100,verified:row.verified===true}];
    // Keep legacy records for audit, but explicitly revoke their unverifiable
    // "verified" flag. No claimed-only percentage can pass a future gate.
    if(typeof claimedPct!=="number" || !Number.isFinite(claimedPct) || claimedPct<0 || claimedPct>100) return [];
    return [{fabricId,pattern,errorPct:claimedPct,verified:false}];
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
  const fabric=fabricId.trim().slice(0,160);
  const physicalRepeatMm=measure(physicalRepeatMmInput,1000);
  const renderedRepeatPx=measure(renderedRepeatPxInput,10000);
  const referenceLengthMm=measure(referenceLengthMmInput,3000);
  const referenceLengthPx=measure(referenceLengthPxInput,10000);
  const evidenceReference=evidenceReferenceInput.trim();
  if(!fabric || physicalRepeatMm===null || renderedRepeatPx===null
    || referenceLengthMm===null || referenceLengthPx===null
    || evidenceReference.length<8 || evidenceReference.length>240) return null;
  const candidate:GarmentViewerPatternScaleSample={
    fabricId:fabric,pattern,errorPct:0,verified,physicalRepeatMm,renderedRepeatPx,
    referenceLengthMm,referenceLengthPx,evidenceReference,
  };
  const derived=calibratedGarmentScaleErrorPct(candidate);
  return derived===null ? null : {...candidate,errorPct:Math.round(derived*100)/100};
}

export function normalizeGarmentViewerEvidenceForStorage(payload:Record<string,unknown>) {
  return {
    patternScaleSamples:parseGarmentPatternSamples(payload.patternScaleSamples),
    interactionLatencyMs:parseGarmentLatencySamples(payload.interactionLatencyMs)
      .map((sample)=>Math.round(sample*10)/10).filter((sample)=>sample>0),
    realismAssessments:parseGarmentRealismAssessments(payload.realismAssessments),
  };
}
