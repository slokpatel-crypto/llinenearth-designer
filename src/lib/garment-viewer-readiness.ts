import {
  PHASE1_PROOF_MAX_P95_MS,
  PHASE1_PROOF_MIN_LATENCY_SAMPLES,
  PHASE1_PROOF_MIN_REALISM_VIEWERS,
  PHASE1_PROOF_MIN_STRONG_REALISM,
  ROADMAP_SCALE_TOLERANCE_PCT,
  phase1BoundaryChecksReady,
  summarizeIndependentRealism,
  summarizeLatencySamples,
  type Phase1BoundaryChecks,
  type RealismAssessment,
} from "./designer/proof-scale.ts";
import type {
  GarmentViewerManifestValidation,
  GarmentViewerModelContractResult,
} from "./garment-viewer-model-contract.ts";

export const GARMENT_VIEWER_MIN_PATTERN_SCALE_SAMPLES = 2;
export const GARMENT_VIEWER_LATENCY_STORAGE_KEY = "linen-earth-garment-viewer-latency-v1";
export const GARMENT_VIEWER_REALISM_STORAGE_KEY = "linen-earth-garment-viewer-realism-v1";
export const GARMENT_VIEWER_REALISM_RUBRIC_VERSION = "linen-earth-garment-viewer-realism-rubric-v1";

export type GarmentViewerAssetIdentity={
  modelId:string;
  modelSha256:string;
  manifestSha256:string;
};

export function garmentViewerAssetIdentityKey(identity:GarmentViewerAssetIdentity|null|undefined){
  if(!identity) return "";
  return [identity.modelId,identity.modelSha256,identity.manifestSha256].join(":");
}

export function garmentViewerAssetIdentityMatches(
  current:GarmentViewerAssetIdentity|null|undefined,
  evidence:GarmentViewerAssetIdentity|null|undefined,
){
  return Boolean(
    current
    && evidence
    && current.modelId===evidence.modelId
    && current.modelSha256===evidence.modelSha256
    && current.manifestSha256===evidence.manifestSha256
  );
}

export type GarmentViewerPatternScaleSample = {
  fabricId:string;
  pattern:"stripe"|"check"|"other";
  errorPct:number;
  verified:boolean;
};

// Stored operator evidence is untrusted JSON. Never coerce null/booleans,
// strings or decimal reviewer ratings into a passing physical/realism claim.
export function normalizeGarmentViewerPatternSamples(value:unknown):GarmentViewerPatternScaleSample[]{
  if(!Array.isArray(value)) return [];
  const rows=value.slice(-20);
  const normalized:GarmentViewerPatternScaleSample[]=[];
  for(const item of rows){
    if(!item||typeof item!=="object"||Array.isArray(item)) return [];
    const row=item as Record<string,unknown>;
    if(typeof row.fabricId!=="string"||!row.fabricId.trim()||row.fabricId.length>160
      ||(row.pattern!=="stripe"&&row.pattern!=="check"&&row.pattern!=="other")
      ||typeof row.errorPct!=="number"||!Number.isFinite(row.errorPct)
      ||row.errorPct<0||row.errorPct>100||typeof row.verified!=="boolean") return [];
    normalized.push({fabricId:row.fabricId.trim(),pattern:row.pattern,errorPct:row.errorPct,verified:row.verified});
  }
  return normalized;
}

export function parseGarmentViewerScaleSampleInput(
  fabricId:string,errorText:string,pattern:"stripe"|"check",verified:boolean,
):GarmentViewerPatternScaleSample|null{
  // Number("") and Number("  ") are zero, which would forge a perfect scale
  // result from an empty operator field. Never round away >8% drift.
  const error=errorText.trim();
  if(!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(error)) return null;
  const samples=normalizeGarmentViewerPatternSamples([
    {fabricId:fabricId.trim(),pattern,errorPct:Number(error),verified},
  ]);
  return samples[0]??null;
}

export function normalizeGarmentViewerLatencies(value:unknown):number[]{
  if(!Array.isArray(value)) return [];
  const rows=value.slice(-120);
  if(rows.some((item)=>typeof item!=="number"||!Number.isFinite(item)||item<0||item>10000)) return [];
  return rows;
}

export function normalizeGarmentViewerRealism(value:unknown):RealismAssessment[]{
  if(!Array.isArray(value)) return [];
  const rows=value.slice(-50);
  const normalized:RealismAssessment[]=[];
  for(const item of rows){
    if(!item||typeof item!=="object"||Array.isArray(item)) return [];
    const row=item as Record<string,unknown>;
    if(typeof row.viewerId!=="string"||row.viewerId.trim().length<2||row.viewerId.length>80
      ||typeof row.rating!=="number"||!Number.isInteger(row.rating)||row.rating<1||row.rating>5
      ||(row.recordedAt!==undefined&&typeof row.recordedAt!=="string")) return [];
    normalized.push({
      viewerId:row.viewerId.trim().toLowerCase(),
      rating:row.rating,
      recordedAt:typeof row.recordedAt==="string"?row.recordedAt.slice(0,80):"",
    });
  }
  return normalized;
}

export function normalizeGarmentViewerBoundaries(value:unknown):Phase1BoundaryChecks{
  const input=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
  return {neck:input.neck===true,cuffs:input.cuffs===true,waist:input.waist===true,trouserGap:input.trouserGap===true};
}

export function normalizeGarmentViewerOperatorEvidencePayload(payload:Record<string,unknown>){
  const patterns=payload.patternScaleSamples;
  const timings=payload.interactionLatencyMs;
  const reviews=payload.realismAssessments;
  const boundaries=payload.boundaryChecks;
  if(!Array.isArray(patterns)||patterns.length>20
    ||!Array.isArray(timings)||timings.length>120
    ||!Array.isArray(reviews)||reviews.length>50
    ||!boundaries||typeof boundaries!=="object"||Array.isArray(boundaries)) return null;
  const checks=boundaries as Record<string,unknown>;
  if(["neck","cuffs","waist","trouserGap"].some((key)=>typeof checks[key]!=="boolean")) return null;
  const patternScaleSamples=normalizeGarmentViewerPatternSamples(patterns);
  const interactionLatencyMs=normalizeGarmentViewerLatencies(timings);
  const realismAssessments=normalizeGarmentViewerRealism(reviews);
  // Never silently discard malformed evidence during authenticated writes:
  // otherwise a forged null/boolean becomes a seemingly complete QA receipt.
  if(patternScaleSamples.length!==patterns.length
    ||interactionLatencyMs.length!==timings.length
    ||realismAssessments.length!==reviews.length) return null;
  return {
    patternScaleSamples,interactionLatencyMs,realismAssessments,
    boundaryChecks:normalizeGarmentViewerBoundaries(boundaries),
  };
}

export type GarmentViewerPromotionInput = {
  contract:GarmentViewerModelContractResult|null;
  manifest:GarmentViewerManifestValidation|null;
  nativePreflightVerified?:boolean;
  patternScaleSamples:GarmentViewerPatternScaleSample[];
  interactionLatencyMs:number[];
  realismAssessments:RealismAssessment[];
  boundaryChecks:Phase1BoundaryChecks|null;
};

export function garmentViewerPromotionReadiness(input:GarmentViewerPromotionInput) {
  const contractReady=input.contract?.readiness==="contract_ready" && input.contract.physicallyScalable;
  const manifestReady=input.manifest?.valid===true;
  // Only a trusted server-side native scene/QA registry may set this. The
  // operator-submitted readiness event is never itself native Blender proof.
  const nativePreflightReady=input.nativePreflightVerified===true;

  const scaleSamples=normalizeGarmentViewerPatternSamples(input.patternScaleSamples)
    .filter((sample)=>sample.verified);
  const scaleKeys=scaleSamples.map((sample)=>sample.fabricId+":"+sample.pattern);
  const uniqueSamples=new Set(scaleKeys).size===scaleKeys.length;
  const independentStripeAndCheck=scaleSamples.some((stripe)=>stripe.pattern==="stripe"
    &&scaleSamples.some((check)=>check.pattern==="check"&&check.fabricId!==stripe.fabricId));
  const scaleReady=scaleSamples.length>=GARMENT_VIEWER_MIN_PATTERN_SCALE_SAMPLES
    &&uniqueSamples&&independentStripeAndCheck
    &&scaleSamples.every((sample)=>sample.errorPct<=ROADMAP_SCALE_TOLERANCE_PCT);

  const latency=summarizeLatencySamples(normalizeGarmentViewerLatencies(input.interactionLatencyMs));
  const latencyReady=latency.count>=PHASE1_PROOF_MIN_LATENCY_SAMPLES
    && latency.p95Ms!==null
    && latency.p95Ms<PHASE1_PROOF_MAX_P95_MS;

  const realism=summarizeIndependentRealism(normalizeGarmentViewerRealism(input.realismAssessments));
  const realismReady=realism.uniqueViewers>=PHASE1_PROOF_MIN_REALISM_VIEWERS
    && realism.strongRatings>=PHASE1_PROOF_MIN_STRONG_REALISM;

  const boundaryReady=phase1BoundaryChecksReady(input.boundaryChecks);
  const reasons:string[]=[];
  if(!contractReady) reasons.push("Approved GLB has not passed the six-panel production material contract.");
  if(!manifestReady) reasons.push("Approved GLB physical panel manifest is missing or invalid.");
  if(!nativePreflightReady) reasons.push("Native Blender geometry/UV and four-angle candidate evidence have not been independently verified.");
  if(!scaleReady) reasons.push("Verified stripe and check renders must both stay within the <=8% physical-scale gate.");
  if(!latencyReady) reasons.push("3D interaction needs at least 12 samples with p95 below 300 ms.");
  if(!realismReady) reasons.push("At least 6 of 8 independent viewers must rate the realistic model 4/5 or 5/5.");
  if(!boundaryReady) reasons.push("Neck, cuffs, waist and trouser-gap boundaries must all pass visual QA.");

  return {
    version:"linen-earth-garment-viewer-readiness-v1" as const,
    ready:contractReady&&manifestReady&&nativePreflightReady&&scaleReady&&latencyReady&&realismReady&&boundaryReady,
    contractReady,
    manifestReady,
    nativePreflightReady,
    scaleReady,
    latencyReady,
    realismReady,
    boundaryReady,
    scaleSamples,
    latency,
    realism,
    reasons,
  };
}
