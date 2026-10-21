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

/** Validate the complete identity before canonicalizing; never truncate asset hashes. */
export function parseGarmentViewerAssetIdentity(value:unknown):GarmentViewerAssetIdentity|null {
  if(!value || typeof value!=="object" || Array.isArray(value)) return null;
  const row=value as Record<string,unknown>;
  if(typeof row.modelId!=="string" || typeof row.modelSha256!=="string"
    || typeof row.manifestSha256!=="string") return null;
  const modelId=row.modelId.trim();
  const modelSha256=row.modelSha256.trim().toLowerCase();
  const manifestSha256=row.manifestSha256.trim().toLowerCase();
  if(!/^LE-[A-Z0-9-]{2,90}$/.test(modelId)
    || !/^[a-f0-9]{64}$/.test(modelSha256)
    || !/^[a-f0-9]{64}$/.test(manifestSha256)) return null;
  return {modelId,modelSha256,manifestSha256};
}

export function garmentViewerAssetIdentityKey(identity:GarmentViewerAssetIdentity|null|undefined){
  const parsed=parseGarmentViewerAssetIdentity(identity);
  if(!parsed) return "";
  return [parsed.modelId,parsed.modelSha256,parsed.manifestSha256].join(":");
}

export function garmentViewerAssetIdentityMatches(
  current:GarmentViewerAssetIdentity|null|undefined,
  evidence:GarmentViewerAssetIdentity|null|undefined,
){
  const currentIdentity=parseGarmentViewerAssetIdentity(current);
  const evidenceIdentity=parseGarmentViewerAssetIdentity(evidence);
  return Boolean(
    currentIdentity
    && evidenceIdentity
    && currentIdentity.modelId===evidenceIdentity.modelId
    && currentIdentity.modelSha256===evidenceIdentity.modelSha256
    && currentIdentity.manifestSha256===evidenceIdentity.manifestSha256
  );
}

export type GarmentViewerPatternScaleSample = {
  fabricId:string;
  pattern:"stripe"|"check"|"other";
  errorPct:number;
  verified:boolean;
  // Physical repeat is measured on the cloth; repeat and reference pixels
  // are measured in the same rendered image at the same depth.
  physicalRepeatMm?:number;
  renderedRepeatPx?:number;
  referenceLengthMm?:number;
  referenceLengthPx?:number;
  evidenceReference?:string;
};

/** Preserve the complete evidence subject identity; never alias it by truncation. */
export function parseGarmentEvidenceFabricId(value:unknown):string|null {
  if(typeof value!=="string") return null;
  const fabricId=value.trim();
  return fabricId.length>0 && fabricId.length<=160 ? fabricId : null;
}

/** Recompute scale error from the underlying measurement, never a claimed percentage. */
export function calibratedGarmentScaleErrorPct(sample:GarmentViewerPatternScaleSample):number|null {
  const {physicalRepeatMm,renderedRepeatPx,referenceLengthMm,referenceLengthPx,evidenceReference}=sample;
  if(typeof physicalRepeatMm!=="number" || !Number.isFinite(physicalRepeatMm) || physicalRepeatMm<=0 || physicalRepeatMm>1000
    || typeof renderedRepeatPx!=="number" || !Number.isFinite(renderedRepeatPx) || renderedRepeatPx<=0 || renderedRepeatPx>10000
    || typeof referenceLengthMm!=="number" || !Number.isFinite(referenceLengthMm) || referenceLengthMm<=0 || referenceLengthMm>3000
    || typeof referenceLengthPx!=="number" || !Number.isFinite(referenceLengthPx) || referenceLengthPx<=0 || referenceLengthPx>10000
    || typeof evidenceReference!=="string" || evidenceReference.trim().length<8 || evidenceReference.length>240) return null;
  const expectedPx=physicalRepeatMm*referenceLengthPx/referenceLengthMm;
  if(!Number.isFinite(expectedPx) || expectedPx<=0) return null;
  const error=Math.abs(renderedRepeatPx-expectedPx)/expectedPx*100;
  // A finite measured failure must remain in the sample set, even above
  // 100%. Dropping it could leave other samples falsely passing the gate.
  return Number.isFinite(error) ? error : null;
}

/** Exact, revision-agnostic measurement trace. Customer approval remains a separate gate. */
export function garmentViewerScaleAudit(samples:GarmentViewerPatternScaleSample[]) {
  return samples.slice(-20).map((sample)=>{
    const measuredErrorPct=calibratedGarmentScaleErrorPct(sample);
    const passes=sample.verified===true
      && parseGarmentEvidenceFabricId(sample.fabricId)!==null
      && (sample.pattern==="stripe"||sample.pattern==="check"||sample.pattern==="other")
      && measuredErrorPct!==null
      && measuredErrorPct<=ROADMAP_SCALE_TOLERANCE_PCT;
    return {sample,measuredErrorPct,passes};
  });
}

export type GarmentViewerPromotionInput = {
  contract:GarmentViewerModelContractResult|null;
  manifest:GarmentViewerManifestValidation|null;
  patternScaleSamples:GarmentViewerPatternScaleSample[];
  interactionLatencyMs:number[];
  realismAssessments:RealismAssessment[];
  boundaryChecks:Phase1BoundaryChecks|null;
};

export function garmentViewerPromotionReadiness(input:GarmentViewerPromotionInput) {
  const contractReady=input.contract?.readiness==="contract_ready" && input.contract.physicallyScalable;
  const manifestReady=input.manifest?.valid===true;

  // Legacy percent-only rows remain inspectable but cannot pass physical QA.
  // Compute from exact calibrated dimensions even if a stored errorPct was altered.
  const scaleAudit=garmentViewerScaleAudit(input.patternScaleSamples);
  const calibratedRows=scaleAudit.filter((row)=>row.sample.verified===true
    && row.measuredErrorPct!==null
    && parseGarmentEvidenceFabricId(row.sample.fabricId)!==null);
  const scaleSamples=calibratedRows.map(({sample})=>sample);
  const stripeFabricIds=new Set(scaleSamples
    .filter((sample)=>sample.pattern==="stripe")
    .map((sample)=>parseGarmentEvidenceFabricId(sample.fabricId) as string));
  const checkFabricIds=new Set(scaleSamples
    .filter((sample)=>sample.pattern==="check")
    .map((sample)=>parseGarmentEvidenceFabricId(sample.fabricId) as string));
  const hasIndependentPatternSubjects=[...stripeFabricIds]
    .some((fabricId)=>[...checkFabricIds].some((checkId)=>checkId!==fabricId));
  const scaleReady=scaleSamples.length>=GARMENT_VIEWER_MIN_PATTERN_SCALE_SAMPLES
    && hasIndependentPatternSubjects
    && calibratedRows.every((row)=>row.passes)
    && !scaleAudit.some((row)=>row.sample.verified===true && row.measuredErrorPct===null);

  const latency=summarizeLatencySamples(input.interactionLatencyMs);
  const latencyReady=latency.count>=PHASE1_PROOF_MIN_LATENCY_SAMPLES
    && latency.p95Ms!==null
    && latency.p95Ms<PHASE1_PROOF_MAX_P95_MS;

  const realism=summarizeIndependentRealism(input.realismAssessments);
  const realismReady=realism.uniqueViewers>=PHASE1_PROOF_MIN_REALISM_VIEWERS
    && realism.strongRatings>=PHASE1_PROOF_MIN_STRONG_REALISM;

  const boundaryReady=phase1BoundaryChecksReady(input.boundaryChecks);
  const reasons:string[]=[];
  if(!contractReady) reasons.push("Approved GLB has not passed the six-panel production material contract.");
  if(!manifestReady) reasons.push("Approved GLB physical panel manifest is missing or invalid.");
  if(!scaleReady) reasons.push("Distinct stripe and check fabric samples both require physical repeat, rendered repeat pixels, same-plane reference calibration and traceable evidence within the <=8% scale gate.");
  if(!latencyReady) reasons.push("3D interaction needs at least 12 samples with p95 below 300 ms.");
  if(!realismReady) reasons.push("At least 6 of 8 independent viewers must rate the realistic model 4/5 or 5/5.");
  if(!boundaryReady) reasons.push("Neck, cuffs, waist and trouser-gap boundaries must all pass visual QA.");

  return {
    version:"linen-earth-garment-viewer-readiness-v1" as const,
    ready:contractReady&&manifestReady&&scaleReady&&latencyReady&&realismReady&&boundaryReady,
    contractReady,
    manifestReady,
    scaleReady,
    latencyReady,
    realismReady,
    boundaryReady,
    scaleSamples,
    scaleAudit,
    latency,
    realism,
    reasons,
  };
}
