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
  if(!intelligence || intelligence.trust!=="reviewed" ||
    !["approved","corrected"].includes(intelligence.reviewStatus)) return fabric;
  const physicalScale=intelligence.measuredEvidence.patternPhysicalScale;
  const physical=intelligence.verifiedPhysical;
  const provenance=intelligence.fieldProvenance||{};

  // A persisted, reviewed profile can still contain malformed historic JSON.
  // Neither object-to-string coercion nor an arbitrary URL is physical proof.
  const sourceUrl=typeof physical.sourceUrl==="string"?physical.sourceUrl.trim():"";
  let hasSourceUrl=false;
  if(sourceUrl){
    try{
      const url=new URL(sourceUrl);
      hasSourceUrl=url.protocol==="https:" && Boolean(url.hostname) && !url.username && !url.password;
    }catch{ /* Invalid URLs are not evidence. */ }
  }
  const hasEvidenceNote=typeof physical.evidenceNote==="string" &&
    physical.evidenceNote.trim().length>=8;
  const auditablePhysicalSource=hasSourceUrl||hasEvidenceNote;
  const physicalSource=(field:string)=>auditablePhysicalSource &&
    (provenance[field]==="declared"||provenance[field]==="reviewed");

  const validMm=(value:unknown):value is number=>
    typeof value==="number"&&Number.isFinite(value)&&value>0&&value<=5000;
  const repeatMm=validMm(intelligence.measuredEvidence.repeatMm)
    ? intelligence.measuredEvidence.repeatMm:null;
  const rawStripeWidthMm=intelligence.measuredEvidence.stripeWidthMm;
  const stripeWidthMm=validMm(rawStripeWidthMm) &&
    (repeatMm===null||rawStripeWidthMm<=repeatMm)?rawStripeWidthMm:null;
  // A status label alone cannot certify true-scale pattern dimensions.
  const patternScaleVerified=physicalSource("measured.pattern.physicalScale") &&
    ((physicalScale==="declared_repeat"&&repeatMm!==null) ||
      (physicalScale==="declared_swatch_width"&&(repeatMm!==null||stripeWidthMm!==null)));

  const gsmVerified=physicalSource("verifiedPhysical.gsm") &&
    typeof physical.gsm==="number"&&Number.isFinite(physical.gsm) &&
    physical.gsm>=20&&physical.gsm<=1000;
  const drapeVerified=physicalSource("verifiedPhysical.drape") &&
    (physical.drape==="Fluid"||physical.drape==="Balanced"||physical.drape==="Structured");
  const fiberVerified=physicalSource("verifiedPhysical.fiberContent") &&
    typeof physical.fiberContent==="string" &&
    physical.fiberContent.trim().length>0&&physical.fiberContent.length<=220;

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
    ...(fabric.weightGsm===null && physical.gsm!=null && gsmVerified
      ? {weightGsm:physical.gsm}
      : {}),
    ...(fabric.drape===null && physical.drape && drapeVerified
      ? {drape:physical.drape}
      : {}),
    ...(physical.fiberContent && fiberVerified
      ? {
        fiberContent:physical.fiberContent,
        fiberContentVerified:true,
      }
      : {}),
  };
}
