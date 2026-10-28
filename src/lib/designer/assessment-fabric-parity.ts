import type { DesignerFabric } from "./engine.ts";
import type { DesignerAssessmentResponse } from "./assessment-types.ts";
import { fabricRevisionKey } from "./creative-selection.ts";

/**
 * The server may load a newer supplier/stock/physics revision while an
 * assessment is in flight. Matching IDs alone cannot make that assessment
 * evidence for the fabric snapshot still visible to the customer.
 */
export function assessmentMatchesSelectedFabricRevisions(
  assessment:Pick<DesignerAssessmentResponse,"recommendation">|null|undefined,
  selectedShirt:DesignerFabric|null|undefined,
  selectedPant:DesignerFabric|null|undefined,
):boolean {
  if(!assessment?.recommendation || !selectedShirt || !selectedPant) return false;
  const shirtKey=fabricRevisionKey(selectedShirt);
  const pantKey=fabricRevisionKey(selectedPant);
  return shirtKey!=="missing" && pantKey!=="missing" &&
    shirtKey===fabricRevisionKey(assessment.recommendation.shirt) &&
    pantKey===fabricRevisionKey(assessment.recommendation.pant);
}
