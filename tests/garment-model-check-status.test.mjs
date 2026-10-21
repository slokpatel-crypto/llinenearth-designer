import assert from "node:assert/strict";
import test from "node:test";
import {
  standaloneGarmentModelCheckStatus,
  UNVERIFIED_GARMENT_PROMOTION_GATES,
} from "../scripts/garment-model-check-status.mjs";

test("standalone model check never claims production approval, even if structural checks pass", () => {
  for (const candidateMode of [false, true]) {
    for (const structuralReady of [false, true]) {
      for (const manifestValid of [false, true]) {
        for (const candidateReady of [false, true]) {
          const result = standaloneGarmentModelCheckStatus({
            candidateMode, structuralReady, manifestValid, candidateReady,
          });
          assert.equal(result.productionApproved, false);
          assert.equal(result.promotionEvidenceEvaluated, false);
          assert.deepEqual(result.pendingPromotionGates, UNVERIFIED_GARMENT_PROMOTION_GATES);
          assert.equal(result.ready,
            candidateMode ? candidateReady : structuralReady && manifestValid);
          assert.equal(result.mode, candidateMode ? "engineering_candidate" : "structural_validation");
        }
      }
    }
  }
});

test("CLI status returns an independent copy of its outstanding promotion gates", () => {
  const first = standaloneGarmentModelCheckStatus({
    candidateMode: false, candidateReady: true, structuralReady: true, manifestValid: true,
  });
  first.pendingPromotionGates.length = 0;
  const next = standaloneGarmentModelCheckStatus({
    candidateMode: false, candidateReady: true, structuralReady: true, manifestValid: true,
  });
  assert.equal(next.ready, true);
  assert.equal(next.productionApproved, false);
  assert.equal(next.pendingPromotionGates.length, 5);
});
