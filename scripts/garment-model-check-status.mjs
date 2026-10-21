// Standalone GLB inspection can prove engineering/structural correctness, but
// has no access to independently recorded, asset-bound promotion evidence.
// Keep the machine-readable CLI result truthful even for an otherwise perfect
// candidate: only the separate GarmentViewer promotion gate can approve it.
export const UNVERIFIED_GARMENT_PROMOTION_GATES = Object.freeze([
  "Physical stripe and check pattern-scale calibration",
  "Interaction-latency measurements for the exact model revision",
  "Independent multi-viewer realism assessments",
  "Neck, cuff, waist and trouser-gap visual boundary inspection",
  "Owner/tailor acceptance of the actual physical garment and model",
]);

export function standaloneGarmentModelCheckStatus({ candidateMode, candidateReady, structuralReady, manifestValid }) {
  const ready = candidateMode === true
    ? candidateReady === true
    : structuralReady === true && manifestValid === true;
  return {
    ready,
    mode: candidateMode === true ? "engineering_candidate" : "structural_validation",
    // Do not use ready alone to switch a customer-facing viewer.
    productionApproved: false,
    promotionEvidenceEvaluated: false,
    pendingPromotionGates: [...UNVERIFIED_GARMENT_PROMOTION_GATES],
  };
}
