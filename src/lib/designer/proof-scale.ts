export const ROADMAP_SCALE_TOLERANCE_PCT = 8;

export function pxPerMmFromMarker(pixelDistance:number, markerMm:number) {
  if(!Number.isFinite(pixelDistance) || pixelDistance<=0) throw new Error("pixelDistance must be > 0");
  if(!Number.isFinite(markerMm) || markerMm<=0) throw new Error("markerMm must be > 0");
  return pixelDistance/markerMm;
}

export function expectedPeriodPx(repeatMm:number, pxPerMm:number) {
  if(!Number.isFinite(repeatMm) || repeatMm<=0) throw new Error("repeatMm must be > 0");
  if(!Number.isFinite(pxPerMm) || pxPerMm<=0) throw new Error("pxPerMm must be > 0");
  return repeatMm*pxPerMm;
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

export function summarizeIndependentRealism(assessments:RealismAssessment[]){
  const latest=new Map<string,RealismAssessment>();
  for(const item of assessments){
    const viewerId=String(item.viewerId||"").trim().toLowerCase();
    const rating=Math.round(Number(item.rating));
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

export type Phase1ProofAcceptanceInput={
  repeatMm:number|null;
  scaleGatePass:boolean|null;
  realModelSamples:number;
  realModelP95Ms:number|null;
  realismRatings:number[];
};

export function phase1ProofAcceptance(input:Phase1ProofAcceptanceInput) {
  const strongRatings=input.realismRatings.filter((rating)=>rating>=4&&rating<=5).length;
  const scaleReady=Boolean(input.repeatMm && input.repeatMm>0 && input.scaleGatePass===true);
  const latencyReady=input.realModelSamples>=PHASE1_PROOF_MIN_LATENCY_SAMPLES
    && input.realModelP95Ms!==null
    && input.realModelP95Ms<PHASE1_PROOF_MAX_P95_MS;
  const realismReady=input.realismRatings.length>=PHASE1_PROOF_MIN_REALISM_VIEWERS
    && strongRatings>=PHASE1_PROOF_MIN_STRONG_REALISM;
  const reasons:string[]=[];
  if(!scaleReady) reasons.push("Physical repeat scale has not passed the <=8% gate.");
  if(!latencyReady) reasons.push("Real-model p95 needs at least 12 samples and must stay below 300 ms.");
  if(!realismReady) reasons.push("At least 6 of 8 viewers must rate realism 4/5 or 5/5.");
  return {
    accepted:scaleReady&&latencyReady&&realismReady,
    scaleReady,
    latencyReady,
    realismReady,
    strongRatings,
    reasons,
  };
}
