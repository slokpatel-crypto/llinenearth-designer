import type { DesignerFabric } from "@/lib/designer/engine";
import type { DesignerFabricIntelligence } from "@/lib/fabric-intelligence-types";

/**
 * Applies only human-reviewed physical fields to the customer-facing fabric
 * contract. Unreviewed / model-only measurements stay provisional and cannot
 * silently upgrade scale, GSM, drape or fibre claims.
 */
export function applyVerifiedPhysicalFabricEvidence(
  fabric:DesignerFabric,
  intelligence:DesignerFabricIntelligence|undefined,
):DesignerFabric {
  if(!intelligence || intelligence.trust!=="reviewed") return fabric;
  const physicalScale=intelligence.measuredEvidence.patternPhysicalScale;
  const patternScaleVerified=Boolean(physicalScale && physicalScale!=="unknown");
  return {
    ...fabric,
    ...(patternScaleVerified ? {
      patternScaleVerified:true,
      renderScale:{
        physicalScaleStatus:physicalScale as "declared_repeat"|"declared_swatch_width",
        repeatMm:intelligence.measuredEvidence.repeatMm,
        stripeWidthMm:intelligence.measuredEvidence.stripeWidthMm,
      },
    } : {}),
    ...(fabric.weightGsm===null && intelligence.verifiedPhysical.gsm!=null
      ? {weightGsm:intelligence.verifiedPhysical.gsm}
      : {}),
    ...(fabric.drape===null && intelligence.verifiedPhysical.drape
      ? {drape:intelligence.verifiedPhysical.drape}
      : {}),
    ...(intelligence.verifiedPhysical.fiberContent
      ? {
        fiberContent:intelligence.verifiedPhysical.fiberContent,
        fiberContentVerified:true,
      }
      : {}),
  };
}
