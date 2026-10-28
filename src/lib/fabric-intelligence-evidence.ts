import type { DesignerFabric } from "@/lib/designer/engine";
import type { DesignerFabricIntelligence } from "@/lib/fabric-intelligence-types";

function hasAuditablePhysicalSource(sourceUrl:unknown,note:unknown){
  if(typeof sourceUrl==="string"&&sourceUrl.trim()){
    try{
      const url=new URL(sourceUrl.trim());
      return url.protocol==="https:" && Boolean(url.hostname) && !url.username && !url.password;
    }catch{return false;}
  }
  return typeof note==="string" && note.replace(/\s+/g," ").trim().length>=8;
}

function finitePhysicalMm(value:unknown){
  return typeof value==="number" && Number.isFinite(value) && value>0 && value<=5000;
}

/**
 * Applies only human-reviewed physical fields to the customer-facing fabric
 * contract. Unreviewed / model-only measurements stay provisional and cannot
 * silently upgrade scale, GSM, drape or fibre claims.
 */
export function applyVerifiedPhysicalFabricEvidence(
  fabric:DesignerFabric,
  intelligence:DesignerFabricIntelligence|undefined,
):DesignerFabric {
  if(!intelligence || intelligence.trust!=="reviewed"
    || !["approved","corrected"].includes(intelligence.reviewStatus)) return fabric;
  const physical=intelligence.verifiedPhysical;
  const measured=intelligence.measuredEvidence;
  if(!physical||!measured) return fabric;
  const physicalScale=measured.patternPhysicalScale;
  const provenance=intelligence.fieldProvenance||{};
  const auditablePhysicalSource=hasAuditablePhysicalSource(physical.sourceUrl,physical.evidenceNote);
  const physicalSource=(field:string)=>auditablePhysicalSource&&["declared","reviewed"].includes(String(provenance[field]||""));
  const patternScaleVerified=Boolean(
    (physicalScale==="declared_repeat"||physicalScale==="declared_swatch_width")
    && finitePhysicalMm(measured.repeatMm)
    && (measured.stripeWidthMm==null||finitePhysicalMm(measured.stripeWidthMm))
    && physicalSource("measured.pattern.physicalScale")
  );
  const gsmVerified=physicalSource("verifiedPhysical.gsm")
    && typeof physical.gsm==="number" && Number.isFinite(physical.gsm)
    && physical.gsm>=20 && physical.gsm<=1000;
  const drapeVerified=physicalSource("verifiedPhysical.drape")
    && ["Fluid","Balanced","Structured"].includes(String(physical.drape));
  const fiberVerified=physicalSource("verifiedPhysical.fiberContent")
    && typeof physical.fiberContent==="string"
    && physical.fiberContent.trim().length>=2 && physical.fiberContent.length<=200;
  return {
    ...fabric,
    ...(patternScaleVerified ? {
      patternScaleVerified:true,
      renderScale:{
        physicalScaleStatus:physicalScale as "declared_repeat"|"declared_swatch_width",
        repeatMm:measured.repeatMm,
        stripeWidthMm:measured.stripeWidthMm,
      },
    } : {}),
    ...(fabric.weightGsm===null && gsmVerified
      ? {weightGsm:physical.gsm}
      : {}),
    ...(fabric.drape===null && drapeVerified
      ? {drape:physical.drape}
      : {}),
    ...(fiberVerified
      ? {
        fiberContent:physical.fiberContent,
        fiberContentVerified:true,
      }
      : {}),
  };
}
