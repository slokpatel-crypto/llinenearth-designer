import "server-only";

import {
  DESIGNER_STYLE_CHOICES,
  designerFabricFromStock,
  type DesignerStyle,
} from "@/lib/designer/engine";
import { applyDesignerFabricMetadataToStock, loadDesignerFabricMetadata } from "@/lib/designer-fabric-metadata";
import { loadDesignerFabricIntelligence } from "@/lib/fabric-intelligence-server";
import {
  toLegacyStyle,
  validateStyleSpecV2,
  type StyleSpecV2,
} from "@/lib/designer/style-spec-v2";
import {
  validBodyPreviewProfile,
  type BodyPreviewProfile,
} from "@/lib/designer/body-profile";
import type { SelectedLookFashnRequest } from "@/lib/ai-visualization";

function validLegacyStyle(value:unknown):value is DesignerStyle {
  if(!value || typeof value!=="object" || Array.isArray(value)) return false;
  const input=value as Partial<DesignerStyle>;
  return (Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>).every((key)=>
    typeof input[key]==="string" && DESIGNER_STYLE_CHOICES[key].includes(input[key] as never)
  );
}

function requestedId(value:unknown) {
  if(!value || typeof value!=="object") return "";
  return String((value as {id?:unknown}).id||"").trim().slice(0,160);
}

export async function resolveSelectedLookRequest(raw:unknown):Promise<SelectedLookFashnRequest|null> {
  if(!raw || typeof raw!=="object" || Array.isArray(raw)) return null;
  const input=raw as Record<string,unknown>;
  const shirtId=requestedId(input.shirt);
  const pantId=requestedId(input.pant);
  if(!shirtId || !pantId) return null;

  const styleSpec:StyleSpecV2|undefined=validateStyleSpecV2(input.styleSpec)
    ? input.styleSpec as StyleSpecV2
    : undefined;
  const bodyProfile:BodyPreviewProfile|undefined=validBodyPreviewProfile(input.bodyProfile)
    ? input.bodyProfile as BodyPreviewProfile
    : undefined;

  if(input.styleSpec!==undefined && !styleSpec) return null;
  if(input.bodyProfile!==undefined && !bodyProfile) return null;

  const legacyStyle=styleSpec ? toLegacyStyle(styleSpec) : input.style;
  if(!validLegacyStyle(legacyStyle)) return null;

  const metadata=await loadDesignerFabricMetadata();
  const fabrics=applyDesignerFabricMetadataToStock(metadata)
    .filter((fabric)=>fabric.inStock)
    .map(designerFabricFromStock);
  const shirt=fabrics.find((fabric)=>fabric.id===shirtId && fabric.allowedGarments.includes("shirt"));
  const pant=fabrics.find((fabric)=>fabric.id===pantId && fabric.allowedGarments.includes("pant"));
  if(!shirt || !pant) return null;

  return {
    shirt:{
      id:shirt.id,
      name:shirt.name,
      line:shirt.line,
      image:shirt.image,
      hex:shirt.hex,
      patternType:shirt.patternType,
    },
    pant:{
      id:pant.id,
      name:pant.name,
      line:pant.line,
      image:pant.image,
      hex:pant.hex,
      patternType:pant.patternType,
    },
    style:{...legacyStyle},
    ...(styleSpec?{styleSpec}:{}),
    ...(bodyProfile?{bodyProfile}:{}),
    locked:input.locked===true,
    lookKey:typeof input.lookKey==="string" ? input.lookKey.slice(0,1200) : undefined,
  };
}

export async function enrichSelectedLookEvidence(input:SelectedLookFashnRequest):Promise<SelectedLookFashnRequest> {
  const intelligence=await loadDesignerFabricIntelligence([input.shirt.id,input.pant.id]);
  const renderFacts=(fabricId:string)=>{
    const value=intelligence[fabricId];
    if(!value) return undefined;
    return {
      gsm:value.verifiedPhysical.gsm,
      drape:value.verifiedPhysical.drape,
      fiberContent:value.verifiedPhysical.fiberContent,
      repeatMm:value.measuredEvidence.patternPhysicalScale==="unknown" ? null : value.measuredEvidence.repeatMm,
      stripeWidthMm:value.measuredEvidence.patternPhysicalScale==="unknown" ? null : value.measuredEvidence.stripeWidthMm,
      physicalScaleStatus:value.measuredEvidence.patternPhysicalScale,
    };
  };
  return {
    ...input,
    renderEvidence:{
      shirt:renderFacts(input.shirt.id),
      pant:renderFacts(input.pant.id),
    },
  };
}
