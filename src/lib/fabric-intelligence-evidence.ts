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
  const provenance=intelligence.fieldProvenance||{};
  const auditablePhysicalSource=Boolean(
    String(intelligence.verifiedPhysical.sourceUrl||"").trim()
    || String(intelligence.verifiedPhysical.evidenceNote||"").trim().length>=8
  );
  const physicalSource=(field:string)=>auditablePhysicalSource&&["declared","reviewed"].includes(String(provenance[field]||""));
  const patternScaleVerified=Boolean(
    physicalScale
    && physicalScale!=="unknown"
    && physicalSource("measured.pattern.physicalScale")
  );
  const gsmVerified=physicalSource("verifiedPhysical.gsm");
  const drapeVerified=physicalSource("verifiedPhysical.drape");
  const fiberVerified=physicalSource("verifiedPhysical.fiberContent");
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
    ...(fabric.weightGsm===null && intelligence.verifiedPhysical.gsm!=null && gsmVerified
      ? {weightGsm:intelligence.verifiedPhysical.gsm}
      : {}),
    ...(fabric.drape===null && intelligence.verifiedPhysical.drape && drapeVerified
      ? {drape:intelligence.verifiedPhysical.drape}
      : {}),
    ...(intelligence.verifiedPhysical.fiberContent && fiberVerified
      ? {
        fiberContent:intelligence.verifiedPhysical.fiberContent,
        fiberContentVerified:true,
      }
      : {}),
  };
}
