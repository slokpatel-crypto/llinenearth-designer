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
import { REQUIRED_GARMENT_VIEWER_MATERIALS } from "./garment-viewer-model-contract.ts";
import type {
  GarmentViewerManifestValidation,
  GarmentViewerModelContractResult,
} from "./garment-viewer-model-contract.ts";
import { LINEN_EARTH_MODEL_REFERENCE_IMAGE } from "./designer/model-identity.ts";

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

export type GarmentViewerProductionUvEvidence={
  modelSha256:string;
  panels:Record<string,{
    uAxisMedianDriftPct:number|null;
    vAxisMedianDriftPct:number|null;
    sourceOrCandidateCollapsedUvTriangles:number;
    physicalRepeatVerified:boolean;
  }>;
};
export type GarmentViewerStudioDrapeApproval={
  modelSha256:string;
  referenceImage:string;
  selectedStyleMatchesReference:boolean;
  approvedAngles:string[];
  reviewedByOwner:boolean;
  calibratedLinenColourAndDrape:boolean;
};

export type GarmentViewerPromotionInput = {
  contract:GarmentViewerModelContractResult|null;
  manifest:GarmentViewerManifestValidation|null;
  styleVariantCoverage:{ready:boolean;required:number;present:number;missing:string[]}|null;
  patternScaleSamples:GarmentViewerPatternScaleSample[];
  interactionLatencyMs:number[];
  realismAssessments:RealismAssessment[];
  boundaryChecks:Phase1BoundaryChecks|null;
  // Required to promote a REALISTIC material/UV/photo candidate. No generated
  // geometry screenshot or "verified:true" flag can substitute for signed
  // photographic, textile, and exact-GLB source evidence.
  assetIdentity?:GarmentViewerAssetIdentity|null;
  uvAxisEvidence?:GarmentViewerProductionUvEvidence|null;
  studioDrapeApproval?:GarmentViewerStudioDrapeApproval|null;
};

export function garmentViewerPromotionReadiness(input:GarmentViewerPromotionInput) {
  const contractReady=input.contract?.readiness==="contract_ready" && input.contract.physicallyScalable;
  const manifestReady=input.manifest?.valid===true;
  const productionAssetReady=input.manifest?.productionAssetReady===true;
  const styleVariantReady=input.styleVariantCoverage?.ready===true;

  const scaleSamples=input.patternScaleSamples
    .filter((sample)=>sample.verified&&Number.isFinite(sample.errorPct)&&sample.errorPct>=0)
    .slice(-20);
  const hasStripe=scaleSamples.some((sample)=>sample.pattern==="stripe");
  const hasCheck=scaleSamples.some((sample)=>sample.pattern==="check");
  const scaleReady=scaleSamples.length>=GARMENT_VIEWER_MIN_PATTERN_SCALE_SAMPLES
    && hasStripe
    && hasCheck
    && scaleSamples.every((sample)=>sample.errorPct<=ROADMAP_SCALE_TOLERANCE_PCT);

  const latency=summarizeLatencySamples(input.interactionLatencyMs);
  const latencyReady=latency.count>=PHASE1_PROOF_MIN_LATENCY_SAMPLES
    && latency.p95Ms!==null
    && latency.p95Ms<PHASE1_PROOF_MAX_P95_MS;

  const realism=summarizeIndependentRealism(input.realismAssessments);
  const realismReady=realism.uniqueViewers>=PHASE1_PROOF_MIN_REALISM_VIEWERS
    && realism.strongRatings>=PHASE1_PROOF_MIN_STRONG_REALISM;

  const boundaryReady=phase1BoundaryChecksReady(input.boundaryChecks);
  const identity=input.assetIdentity;
  const uvEvidence=input.uvAxisEvidence;
  const uvAxisReady=Boolean(identity&&uvEvidence
    &&uvEvidence.modelSha256===identity.modelSha256
    &&REQUIRED_GARMENT_VIEWER_MATERIALS.every((name)=>{
      const panel=uvEvidence.panels[name];
      return Boolean(panel
        &&panel.physicalRepeatVerified===true
        &&Number.isFinite(panel.uAxisMedianDriftPct)
        &&Number.isFinite(panel.vAxisMedianDriftPct)
        &&(panel.uAxisMedianDriftPct as number)>=0
        &&(panel.vAxisMedianDriftPct as number)>=0
        &&(panel.uAxisMedianDriftPct as number)<=ROADMAP_SCALE_TOLERANCE_PCT
        &&(panel.vAxisMedianDriftPct as number)<=ROADMAP_SCALE_TOLERANCE_PCT
        &&panel.sourceOrCandidateCollapsedUvTriangles===0);
    }));
  const studio=input.studioDrapeApproval;
  const studioReady=Boolean(identity&&studio
    &&studio.modelSha256===identity.modelSha256
    &&studio.referenceImage===LINEN_EARTH_MODEL_REFERENCE_IMAGE
    &&studio.selectedStyleMatchesReference===true
    &&studio.reviewedByOwner===true
    &&studio.calibratedLinenColourAndDrape===true
    &&["front","three-quarter","side","back"].every((view)=>studio.approvedAngles.includes(view)));
  const reasons:string[]=[];
  if(!contractReady) reasons.push("Approved GLB has not passed the six-panel production material contract.");
  if(!manifestReady) reasons.push("Approved GLB physical panel manifest is missing or invalid.");
  if(!productionAssetReady) reasons.push("Production promotion requires a realistic-body Blender candidate with measured panel provenance and Blender fit/boundary evidence.");
  if(!styleVariantReady) {
    const present=input.styleVariantCoverage?.present||0;
    const required=input.styleVariantCoverage?.required||0;
    reasons.push(`Production 3D tailoring variants are incomplete (${present}/${required} variant material slots present).`);
  }
  if(!scaleReady) reasons.push("Verified stripe and check renders must both stay within the <=8% physical-scale gate.");
  if(!latencyReady) reasons.push("3D interaction needs at least 12 samples with p95 below 300 ms.");
  if(!realismReady) reasons.push("At least 6 of 8 independent viewers must rate the realistic model 4/5 or 5/5.");
  if(!boundaryReady) reasons.push("Neck, cuffs, waist and trouser-gap boundaries must all pass visual QA.");
  if(!uvAxisReady) reasons.push("All six garment UV axes require <=8% verified physical repeat drift, no collapsed UVs and evidence tied to the current GLB.");
  if(!studioReady) reasons.push("Owner must approve four-angle reference identity and real calibrated linen colour/drape for the current GLB.");

  return {
    version:"linen-earth-garment-viewer-readiness-v1" as const,
    ready:contractReady&&manifestReady&&productionAssetReady&&styleVariantReady&&scaleReady&&latencyReady&&realismReady&&boundaryReady&&uvAxisReady&&studioReady,
    contractReady,
    manifestReady,
    productionAssetReady,
    styleVariantReady,
    styleVariantCoverage:input.styleVariantCoverage,
    scaleReady,
    latencyReady,
    realismReady,
    boundaryReady,
    uvAxisReady,
    studioReady,
    scaleSamples,
    latency,
    realism,
    reasons,
  };
}
