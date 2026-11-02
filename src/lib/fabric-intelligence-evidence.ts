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
  // Values may come from persisted JSON even when TypeScript declares them as
  // strings. Do not coerce arrays/objects into supplier notes or HTTPS links.
  const sourceTextValid=(physical.sourceUrl==null || typeof physical.sourceUrl==="string")
    && (physical.evidenceNote==null || typeof physical.evidenceNote==="string");
  const sourceUrl=typeof physical.sourceUrl==="string" ? physical.sourceUrl.trim() : "";
  const evidenceNote=typeof physical.evidenceNote==="string" ? physical.evidenceNote.trim() : "";
  let validSourceUrl=sourceTextValid && sourceUrl.length<=1800 && evidenceNote.length<=500 && !sourceUrl;
  if(sourceUrl) {
    try {
      const parsed=new URL(sourceUrl);
      validSourceUrl=sourceTextValid && sourceUrl.length<=1800 && evidenceNote.length<=500
        && parsed.protocol==="https:" && Boolean(parsed.hostname);
    } catch { validSourceUrl=false; }
  }
  // An approved profile is not itself a physical measurement. Field-level
  // declaration/review AND a traceable source are both required.
  const auditablePhysicalSource=validSourceUrl && Boolean(sourceUrl || evidenceNote.length>=8);
  const physicalSource=(field:string)=>auditablePhysicalSource
    && (provenance[field]==="declared" || provenance[field]==="reviewed");
  const validMm=(value:unknown)=>typeof value==="number" && Number.isFinite(value)
    && value>=.1 && value<=5000;
  const repeatMm=intelligence.measuredEvidence.repeatMm;
  const stripeWidthMm=intelligence.measuredEvidence.stripeWidthMm;
  const orientation=intelligence.measuredEvidence.patternOrientation;
  // A width-only swatch calibrates X-axis period, therefore vertical stripes
  // only. An externally declared repeat may use X or Y, but still requires an
  // observed stripe direction. Older incomplete profiles remain unverified.
  const calibratedAxis=(physicalScale==="declared_swatch_width" && orientation==="vertical")
    || (physicalScale==="declared_repeat" && (orientation==="vertical" || orientation==="horizontal"));
  const patternScaleVerified=Boolean(
    calibratedAxis
    && validMm(repeatMm)
    && (stripeWidthMm===null || (validMm(stripeWidthMm) && stripeWidthMm!<=repeatMm!))
    && physicalSource("measured.pattern.physicalScale")
  );
  const gsmVerified=physicalSource("verifiedPhysical.gsm")
    && typeof physical.gsm==="number" && Number.isFinite(physical.gsm)
    && physical.gsm>=20 && physical.gsm<=1000;
  const drapeVerified=physicalSource("verifiedPhysical.drape")
    && typeof physical.drape==="string"
    && ["Fluid","Balanced","Structured"].includes(physical.drape);
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
