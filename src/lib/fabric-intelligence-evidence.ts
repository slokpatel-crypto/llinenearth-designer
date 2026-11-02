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
  const physical=intelligence.verifiedPhysical;
  const sourceUrl=String(physical.sourceUrl||"").trim();
  const evidenceNote=String(physical.evidenceNote||"").trim();
  let validSourceUrl=!sourceUrl;
  if(sourceUrl) {
    try {
      const parsed=new URL(sourceUrl);
      validSourceUrl=parsed.protocol==="https:" && Boolean(parsed.hostname);
    } catch { validSourceUrl=false; }
  }
  // An approved profile is not itself a physical measurement. Field-level
  // declaration/review AND a traceable source are both required.
  const auditablePhysicalSource=validSourceUrl && Boolean(sourceUrl || evidenceNote.length>=8);
  const physicalSource=(field:string)=>auditablePhysicalSource
    && ["declared","reviewed"].includes(String(provenance[field]||""));
  const validMm=(value:unknown)=>typeof value==="number" && Number.isFinite(value)
    && value>=.1 && value<=5000;
  const repeatMm=intelligence.measuredEvidence.repeatMm;
  const stripeWidthMm=intelligence.measuredEvidence.stripeWidthMm;
  const patternScaleVerified=Boolean(
    (physicalScale==="declared_repeat" || physicalScale==="declared_swatch_width")
    && validMm(repeatMm)
    && (stripeWidthMm===null || (validMm(stripeWidthMm) && stripeWidthMm!<=repeatMm!))
    && physicalSource("measured.pattern.physicalScale")
  );
  const gsmVerified=physicalSource("verifiedPhysical.gsm")
    && typeof physical.gsm==="number" && Number.isFinite(physical.gsm)
    && physical.gsm>=20 && physical.gsm<=1000;
  const drapeVerified=physicalSource("verifiedPhysical.drape")
    && ["Fluid","Balanced","Structured"].includes(String(physical.drape));
  const fiberVerified=physicalSource("verifiedPhysical.fiberContent")
    && typeof physical.fiberContent==="string" && physical.fiberContent.trim().length>0;
  return {
    ...fabric,
    ...(patternScaleVerified ? {
      patternScaleVerified:true,
      renderScale:{
        physicalScaleStatus:physicalScale as "declared_repeat"|"declared_swatch_width",
        repeatMm,
        stripeWidthMm,
      },
    } : {}),
    ...(fabric.weightGsm===null && intelligence.verifiedPhysical.gsm!=null && gsmVerified
      ? {weightGsm:intelligence.verifiedPhysical.gsm}
      : {}),
    ...(fabric.drape===null && intelligence.verifiedPhysical.drape && drapeVerified
      ? {drape:intelligence.verifiedPhysical.drape}
      : {}),
    ...(fabric.fiberContentVerified!==true && intelligence.verifiedPhysical.fiberContent && fiberVerified
      ? {
        fiberContent:intelligence.verifiedPhysical.fiberContent,
        fiberContentVerified:true,
      }
      : {}),
  };
}
