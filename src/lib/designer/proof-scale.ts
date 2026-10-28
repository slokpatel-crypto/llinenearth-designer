import { validateVerifiedPhysicalEvidence } from "../physical-evidence-provenance.ts";

export const ROADMAP_SCALE_TOLERANCE_PCT = 8;

export function pxPerMmFromMarker(pixelDistance:number, markerMm:number) {
  if(!Number.isFinite(pixelDistance) || pixelDistance<=0) throw new Error("pixelDistance must be > 0");
  if(!Number.isFinite(markerMm) || markerMm<=0) throw new Error("markerMm must be > 0");
  const ratio=pixelDistance/markerMm;
  if(!Number.isFinite(ratio)||ratio<=0) throw new Error("photo px/mm ratio must be finite and > 0");
  return ratio;
}

export function expectedPeriodPx(repeatMm:number, pxPerMm:number) {
  if(!Number.isFinite(repeatMm) || repeatMm<=0) throw new Error("repeatMm must be > 0");
  if(!Number.isFinite(pxPerMm) || pxPerMm<=0) throw new Error("pxPerMm must be > 0");
  const period=repeatMm*pxPerMm;
  if(!Number.isFinite(period)||period<=0) throw new Error("expected repeat period must be finite and > 0");
  return period;
}

export function scaleErrorPct(measuredPeriodPx:number, repeatMm:number, pxPerMm:number) {
  const expected=expectedPeriodPx(repeatMm,pxPerMm);
  if(!Number.isFinite(measuredPeriodPx) || measuredPeriodPx<=0) throw new Error("measuredPeriodPx must be > 0");
  return Math.abs(measuredPeriodPx-expected)/expected*100;
}

export function passesScaleGate(measuredPeriodPx:number, repeatMm:number, pxPerMm:number, tolerancePct=ROADMAP_SCALE_TOLERANCE_PCT) {
  if(!Number.isFinite(tolerancePct) || tolerancePct<0) throw new Error("tolerancePct must be >= 0");
  return scaleErrorPct(measuredPeriodPx,repeatMm,pxPerMm)<=tolerancePct;
}

export type ProofFabric={
  id:"plain-sky"|"stripe-formal-03"|"check-formal-04";
  label:string;
  image:string;
  cataloguePattern:string;
  repeatMm:number|null;
};

export const PREMIUM_SHIRT_PROOF_FABRICS:ProofFabric[]=[
  {
    id:"plain-sky",
    label:"Sky Blue · Linen Plain 60 Lea",
    image:"/fabrics/plain-60-01.webp",
    cataloguePattern:"Plain",
    repeatMm:null,
  },
  {
    id:"stripe-formal-03",
    label:"Formal Shirting 03 · Stripe",
    image:"/fabrics/formal-shirts-03.webp",
    cataloguePattern:"Stripe",
    repeatMm:null,
  },
  {
    id:"check-formal-04",
    label:"Formal Shirting 04 · Check",
    image:"/fabrics/formal-shirts-04.webp",
    cataloguePattern:"Check",
    repeatMm:null,
  },
];


export const PHASE1_PROOF_MIN_REALISM_VIEWERS=8;
export const PHASE1_PROOF_MIN_STRONG_REALISM=6;
export const PHASE1_PROOF_MIN_LATENCY_SAMPLES=12;
export const PHASE1_PROOF_MAX_P95_MS=300;

export type RealismAssessment={
  viewerId:string;
  rating:number;
  recordedAt?:string;
};

export function summarizeIndependentRealism(assessments:unknown){
  const latest=new Map<string,RealismAssessment>();
  for(const item of Array.isArray(assessments)?assessments:[]){
    if(!item||typeof item!=="object"||Array.isArray(item)) continue;
    // Reviewer identity and the closed 1..5 rating must be genuine JSON types.
    // Coercing object IDs or rounding 3.5/4.5 would fabricate independent proof.
    const viewerId=typeof item.viewerId==="string"?item.viewerId.trim().toLowerCase():"";
    if(typeof item.rating!=="number"||!Number.isInteger(item.rating)) continue;
    const rating=item.rating;
    if(viewerId.length<2||viewerId.length>80||rating<1||rating>5) continue;
    latest.set(viewerId,{...item,viewerId,rating});
  }
  const unique=[...latest.values()];
  const ratings=unique.map((item)=>item.rating);
  const strongRatings=ratings.filter((rating)=>rating>=4).length;
  return {
    uniqueViewers:unique.length,
    strongRatings,
    ratings,
    assessments:unique,
    ready:unique.length>=PHASE1_PROOF_MIN_REALISM_VIEWERS&&strongRatings>=PHASE1_PROOF_MIN_STRONG_REALISM,
  };
}

export type Phase1BoundaryChecks={
  neck:boolean;
  cuffs:boolean;
  waist:boolean;
  trouserGap:boolean;
};

export function phase1BoundaryChecksReady(value:unknown){
  if(!value||typeof value!=="object"||Array.isArray(value)) return false;
  const input=value as Partial<Phase1BoundaryChecks>;
  return input.neck===true&&input.cuffs===true&&input.waist===true&&input.trouserGap===true;
}

export function summarizeLatencySamples(values:unknown){
  // Proof samples must be actual numeric timings, never JSON coercions:
  // Number(null), Number(false) and Number("") all fabricate a 0 ms render.
  const samples=Array.isArray(values)
    ? values.filter((value):value is number=>
        typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=10_000).slice(-120)
    : [];
  if(!samples.length) return {samples:[],count:0,p95Ms:null as number|null,medianMs:null as number|null,maxMs:null as number|null};
  const ordered=[...samples].sort((a,b)=>a-b);
  const percentile=(fraction:number)=>ordered[Math.min(ordered.length-1,Math.max(0,Math.ceil(ordered.length*fraction)-1))];
  return {
    samples:samples.map((value)=>Math.round(value*10)/10),
    count:samples.length,
    p95Ms:Math.round(percentile(.95)*10)/10,
    medianMs:Math.round(percentile(.5)*10)/10,
    maxMs:Math.round(ordered[ordered.length-1]*10)/10,
  };
}

export type Phase1ProofAcceptanceInput={
  repeatMm:number|null;
  scaleGatePass:boolean|null;
  realModelSamples:number;
  realModelP95Ms:number|null;
  realismRatings:number[];
  boundaryChecks?:Phase1BoundaryChecks|null;
};

export function phase1ProofAcceptance(input:Phase1ProofAcceptanceInput|null|undefined) {
  // A direct caller can bypass the recorded-evidence adapter; a malformed
  // envelope must yield a blocked gate rather than throw or certify proof.
  input=input&&typeof input==="object"&&!Array.isArray(input)?input:{
    repeatMm:null,scaleGatePass:null,realModelSamples:0,
    realModelP95Ms:null,realismRatings:[],boundaryChecks:null,
  };
  const validRatings=Array.isArray(input.realismRatings)?input.realismRatings.filter((rating)=>
    typeof rating==="number"&&Number.isInteger(rating)&&rating>=1&&rating<=5):[];
  const strongRatings=validRatings.filter((rating)=>rating>=4).length;
  const scaleReady=typeof input.repeatMm==="number"
    && Number.isFinite(input.repeatMm)&&input.repeatMm>0&&input.scaleGatePass===true;
  const latencyReady=Number.isSafeInteger(input.realModelSamples)
    && input.realModelSamples>=PHASE1_PROOF_MIN_LATENCY_SAMPLES
    && typeof input.realModelP95Ms==="number"
    && Number.isFinite(input.realModelP95Ms)
    && input.realModelP95Ms>=0
    && input.realModelP95Ms<PHASE1_PROOF_MAX_P95_MS;
  const realismReady=validRatings.length>=PHASE1_PROOF_MIN_REALISM_VIEWERS
    && strongRatings>=PHASE1_PROOF_MIN_STRONG_REALISM;
  const boundaryReady=phase1BoundaryChecksReady(input.boundaryChecks);
  const reasons:string[]=[];
  if(!scaleReady) reasons.push("Physical repeat scale has not passed the <=8% gate.");
  if(!latencyReady) reasons.push("Real-model p95 needs at least 12 samples and must stay below 300 ms.");
  if(!realismReady) reasons.push("At least 6 of 8 viewers must rate realism 4/5 or 5/5.");
  if(!boundaryReady) reasons.push("Neck, cuffs, waist and trouser-gap boundary checks must all be visually confirmed.");
  return {
    accepted:scaleReady&&latencyReady&&realismReady&&boundaryReady,
    scaleReady,
    latencyReady,
    realismReady,
    boundaryReady,
    strongRatings,
    reasons,
  };
}

export const PHASE1_PROOF_EVIDENCE_VERSION="linen-earth-phase1-proof-v4";
export const PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM="photo-1024x1536-fixture";

export function evaluateRecordedPhase1ProofEvidence(payload:Record<string,unknown>|null|undefined){
  // Untrusted event payloads may be null or arrays despite the static contract.
  // Normalize to empty blocked evidence instead of throwing on property access.
  payload=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload:{};
  // Version and coordinate-system contracts must not be satisfied by
  // String(["expected-version"]) or object-defined coercion.
  const version=typeof payload.version==="string"?payload.version:"";
  // Stored operator JSON is untrusted. Number(null), Number(true) and numeric
  // strings are not physical measurements, even when their ratios look right.
  const repeatMm=typeof payload.repeatMm==="number"?payload.repeatMm:Number.NaN;
  const measuredPreviewRepeatPx=typeof payload.measuredPreviewRepeatPx==="number"?payload.measuredPreviewRepeatPx:Number.NaN;
  const photoReferenceMm=typeof payload.photoReferenceMm==="number"?payload.photoReferenceMm:Number.NaN;
  const photoReferencePx=typeof payload.photoReferencePx==="number"?payload.photoReferencePx:Number.NaN;

  const physicalEvidenceNote=typeof payload.physicalEvidenceNote==="string"
    ?payload.physicalEvidenceNote.replace(/\s+/g," ").trim().slice(0,700):"";
  let physicalEvidenceReady=false;
  try {
    physicalEvidenceReady=validateVerifiedPhysicalEvidence({
      repeatRealMm:Number.isFinite(repeatMm)?repeatMm:undefined,
      verifiedPhysicalEvidenceNote:physicalEvidenceNote,
    }).hasEvidence;
  } catch {
    physicalEvidenceReady=false;
  }

  const fixtureInputsValid=
    version===PHASE1_PROOF_EVIDENCE_VERSION &&
    payload.scaleCoordinateSystem===PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM &&
    physicalEvidenceReady &&
    Number.isFinite(photoReferenceMm)&&photoReferenceMm>0 &&
    Number.isFinite(photoReferencePx)&&photoReferencePx>0;

  let photoPxPerMm:number|null=null;
  if(fixtureInputsValid){
    try { photoPxPerMm=pxPerMmFromMarker(photoReferencePx,photoReferenceMm); }
    catch { photoPxPerMm=null; }
  }

  const expectedPhotoPeriod=photoPxPerMm===null?null:repeatMm*photoPxPerMm;
  const scaleInputsValid=
    photoPxPerMm!==null && Number.isFinite(photoPxPerMm)&&photoPxPerMm>0 &&
    Number.isFinite(repeatMm)&&repeatMm>0 &&
    Number.isFinite(measuredPreviewRepeatPx)&&measuredPreviewRepeatPx>0 &&
    expectedPhotoPeriod!==null&&Number.isFinite(expectedPhotoPeriod)&&expectedPhotoPeriod>0;

  const scaleGatePass=scaleInputsValid
    ? passesScaleGate(measuredPreviewRepeatPx,repeatMm,photoPxPerMm as number)
    : false;
  const scaleErrorPctValue=scaleInputsValid
    ? scaleErrorPct(measuredPreviewRepeatPx,repeatMm,photoPxPerMm as number)
    : null;

  const realismAssessments:Array<RealismAssessment>=Array.isArray(payload.realismAssessments)
    ? payload.realismAssessments.flatMap((item)=>{
        if(!item||typeof item!=="object") return [];
        const value=item as Record<string,unknown>;
        return [{
          viewerId:typeof value.viewerId==="string"?value.viewerId.slice(0,80):"",
          rating:value.rating as number,
          recordedAt:String(value.recordedAt||"").slice(0,80),
        }];
      })
    : [];
  const realism=summarizeIndependentRealism(realismAssessments);

  const latency=summarizeLatencySamples(payload.realModelSampleDurationsMs);
  const realModelSamples=latency.count;
  const realModelP95Ms=latency.p95Ms;
  const boundaryChecksRaw=payload.boundaryChecks;
  const boundaryChecks:Phase1BoundaryChecks={
    neck:Boolean(boundaryChecksRaw&&typeof boundaryChecksRaw==="object"&&!Array.isArray(boundaryChecksRaw)&&(boundaryChecksRaw as Record<string,unknown>).neck===true),
    cuffs:Boolean(boundaryChecksRaw&&typeof boundaryChecksRaw==="object"&&!Array.isArray(boundaryChecksRaw)&&(boundaryChecksRaw as Record<string,unknown>).cuffs===true),
    waist:Boolean(boundaryChecksRaw&&typeof boundaryChecksRaw==="object"&&!Array.isArray(boundaryChecksRaw)&&(boundaryChecksRaw as Record<string,unknown>).waist===true),
    trouserGap:Boolean(boundaryChecksRaw&&typeof boundaryChecksRaw==="object"&&!Array.isArray(boundaryChecksRaw)&&(boundaryChecksRaw as Record<string,unknown>).trouserGap===true),
  };
  const acceptance=phase1ProofAcceptance({
    repeatMm:scaleInputsValid?repeatMm:null,
    scaleGatePass,
    realModelSamples,
    realModelP95Ms,
    realismRatings:realism.ratings,
    boundaryChecks,
  });

  return {
    version,
    coreAccepted:acceptance.accepted,
    acceptance,
    repeatMm:scaleInputsValid?repeatMm:null,
    measuredPreviewRepeatPx:scaleInputsValid?measuredPreviewRepeatPx:null,
    photoReferenceMm:scaleInputsValid?photoReferenceMm:null,
    photoReferencePx:scaleInputsValid?photoReferencePx:null,
    photoPxPerMm:scaleInputsValid?photoPxPerMm:null,
    scaleCoordinateSystem:scaleInputsValid?PHASE1_PROOF_PHOTO_COORDINATE_SYSTEM:null,
    physicalEvidenceNote:physicalEvidenceReady?physicalEvidenceNote:null,
    physicalEvidenceReady,
    scaleErrorPct:scaleErrorPctValue,
    scaleGatePass,
    realModelSamples,
    realModelP95Ms,
    realModelSampleDurationsMs:latency.samples,
    realModelMedianMs:latency.medianMs,
    realModelMaxMs:latency.maxMs,
    realism,
    boundaryChecks,
    boundaryReady:acceptance.boundaryReady,
  };
}

