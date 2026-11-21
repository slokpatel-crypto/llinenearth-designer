import type { DesignerFabric, DesignerClimate, DesignerIntention, DesignerStyle, OccasionTier } from "./engine.ts";
import { DESIGNER_STYLE_CHOICES } from "./engine.ts";
import { verifyLockedDesignRevision, type LockedDesignRevision } from "./design-lock.ts";
import { validBodyPreviewProfile, type BodyPreviewProfile } from "./body-profile.ts";
import { fromLegacyStyle, toLegacyStyle, validateStyleSpecV2, type StyleSpecV2 } from "./style-spec-v2.ts";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OCCASIONS:readonly OccasionTier[]=["Casual","Smart-Casual","Semi-Formal","Formal"];
const CLIMATES:readonly DesignerClimate[]=["Not specified","Hot / humid","Cool","Air-conditioned"];
const INTENTIONS:readonly DesignerIntention[]=["Understated","Balanced","Expressive"];

export function ownedDesignResumePath(id:unknown):string|null {
  return typeof id==="string"&&UUID.test(id)
    ? "/designer-studio?resumeVault="+encodeURIComponent(id.toLowerCase())
    : null;
}

export type OwnedDesignDraft={
  shirtId:string;
  pantId:string;
  occasion:OccasionTier;
  climate:DesignerClimate;
  intention:DesignerIntention;
  style:DesignerStyle;
  styleSpec:StyleSpecV2;
  bodyProfile:BodyPreviewProfile|null;
  parentRevisionId:string;
};

/**
 * Reopening is NOT restoring a lock or a physical-stock guarantee. It is a
 * validated editable draft. The account vault remains the source of truth for
 * the immutable original revision and retains the exact old recipe.
 */
export async function ownedRevisionToDraft(
  revision:LockedDesignRevision,
  shirts:readonly DesignerFabric[],
  pants:readonly DesignerFabric[],
):Promise<OwnedDesignDraft|null> {
  try {
    if(!revision||!await verifyLockedDesignRevision(revision)) return null;
    const spec=revision.garmentSpec;
    if(spec?.version!=="linen-earth-garment-spec-v1"||!validateStyleSpecV2(spec.styleSpec)) return null;
    if(!OCCASIONS.includes(spec.context?.occasion)||
       !CLIMATES.includes(spec.context?.climate)||
       !INTENTIONS.includes(spec.context?.intention)) return null;
    if(spec.bodyProfile!==null&&spec.bodyProfile!==undefined&&!validBodyPreviewProfile(spec.bodyProfile)) return null;
    const shirt=shirts.find(item=>item.id===spec.fabrics?.shirt?.id&&item.allowedGarments.includes("shirt"));
    const pant=pants.find(item=>item.id===spec.fabrics?.trouser?.id&&item.allowedGarments.includes("pant"));
    if(!shirt||!pant) return null;
    const style=toLegacyStyle(spec.styleSpec);
    if((Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>)
      .some(key=>!DESIGNER_STYLE_CHOICES[key].includes(style[key]))) return null;
    return {
      shirtId:shirt.id,pantId:pant.id,
      occasion:spec.context.occasion,climate:spec.context.climate,intention:spec.context.intention,
      style:{...style},
      styleSpec:JSON.parse(JSON.stringify(spec.styleSpec)) as StyleSpecV2,
      bodyProfile:spec.bodyProfile?JSON.parse(JSON.stringify(spec.bodyProfile)) as BodyPreviewProfile:null,
      parentRevisionId:revision.revisionId,
    };
  }catch{return null;}
}

/**
 * A public share link is already signature-verified by its server page. The
 * resulting URL is nevertheless untrusted edit input: validate every routed
 * catalogue and construction choice again. It is NOT a lock or vault access.
 */
export function readSharedDesignDraft(
  params:URLSearchParams,
  shirts:readonly DesignerFabric[],
  pants:readonly DesignerFabric[],
):Omit<OwnedDesignDraft,"bodyProfile"|"parentRevisionId">|null {
  if(params.get("from")!=="shared-design"||params.toString().length>5000) return null;
  const shirt=shirts.find(item=>item.id===params.get("shirt")&&item.allowedGarments.includes("shirt"));
  const pant=pants.find(item=>item.id===params.get("pant")&&item.allowedGarments.includes("pant"));
  const occasion=params.get("occasion") as OccasionTier;
  const climate=params.get("climate") as DesignerClimate;
  const intention=params.get("intention") as DesignerIntention;
  if(!shirt||!pant||!OCCASIONS.includes(occasion)||!CLIMATES.includes(climate)||!INTENTIONS.includes(intention))
    return null;
  try{
    const raw=params.get("style");
    if(!raw||raw.length>2500) return null;
    const value=JSON.parse(raw);
    if(!value||typeof value!=="object"||Array.isArray(value)) return null;
    const style={} as DesignerStyle;
    for(const key of Object.keys(DESIGNER_STYLE_CHOICES) as Array<keyof DesignerStyle>) {
      const choice=value[key];
      if(typeof choice!=="string"||!DESIGNER_STYLE_CHOICES[key].includes(choice)) return null;
      style[key]=choice;
    }
    return {shirtId:shirt.id,pantId:pant.id,occasion,climate,intention,
      style,styleSpec:fromLegacyStyle(style)};
  }catch{return null;}
}

/** Owner-scoped or public recipe imports never hydrate unrelated local fit data. */
export function allowLocalFitHydration(params:URLSearchParams):boolean {
  return params.get("from")!=="shared-design"&&params.get("from")!=="fabric-catalog"&&!params.has("resumeVault");
}
