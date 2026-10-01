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
