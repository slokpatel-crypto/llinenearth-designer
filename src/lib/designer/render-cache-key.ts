import { createHash } from "node:crypto";

type SelectedLookCacheInput={
  shirt:{id:string};
  pant:{id:string};
  style:unknown;
  styleSpec?:unknown;
  bodyProfile?:unknown;
  renderEvidence?:unknown;
};

function canonicalUrlIdentity(value:string|undefined) {
  const raw=String(value||"").trim();
  if(!raw) return "";
  try {
    const url=new URL(raw);
    return `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}`;
  } catch {
    return raw.slice(0,1800);
  }
}

function stableValue(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(stableValue);
  if(value && typeof value==="object") {
    return Object.fromEntries(
      Object.entries(value as Record<string,unknown>)
        .filter(([,item])=>item!==undefined)
        .sort(([a],[b])=>a.localeCompare(b))
        .map(([key,item])=>[key,stableValue(item)])
    );
  }
  return value;
}

function renderRelevantBodyProfile(value:unknown) {
  if(!value || typeof value!=="object") return null;
  const profile=value as Record<string,unknown>;
  const silhouette=profile.silhouette && typeof profile.silhouette==="object"
    ? profile.silhouette as Record<string,unknown>
    : null;
  return {
    build:profile.build??null,
    heightCm:profile.heightCm??null,
    skinTone:profile.skinTone??null,
    silhouette:silhouette ? {
      shoulderScale:silhouette.shoulderScale??null,
      chestScale:silhouette.chestScale??null,
      waistScale:silhouette.waistScale??null,
      seatScale:silhouette.seatScale??null,
      thighScale:silhouette.thighScale??null,
      legLengthScale:silhouette.legLengthScale??null,
    } : null,
  };
}

function renderRelevantEvidence(value:unknown) {
  if(!value || typeof value!=="object") return null;
  const root=value as Record<string,unknown>;
  const garment=(input:unknown)=>{
    if(!input || typeof input!=="object") return null;
    const item=input as Record<string,unknown>;
    return {
      gsm:item.gsm??null,
      drape:item.drape??null,
      fiberContent:item.fiberContent??null,
      measuredColorHex:item.measuredColorHex??null,
      patternContrastDeltaE:item.patternContrastDeltaE??null,
      patternOrientation:item.patternOrientation??null,
      repeatMm:item.repeatMm??null,
      stripeWidthMm:item.stripeWidthMm??null,
      physicalScaleStatus:item.physicalScaleStatus??null,
    };
  };
  return {shirt:garment(root.shirt),pant:garment(root.pant)};
}

export function selectedLookRenderCacheKey(
  input:SelectedLookCacheInput,
  view:"front"|"three-quarter"|"side"|"back"="front",
  frontImage?:string,
) {
  const canonical=stableValue({
    version:"linen-final-render-cache-v2-locked-preview-source",
    view,
    shirtId:input.shirt.id,
    pantId:input.pant.id,
    style:input.style,
    styleSpec:input.styleSpec||null,
    bodyProfile:renderRelevantBodyProfile(input.bodyProfile),
    renderEvidence:renderRelevantEvidence(input.renderEvidence),
    frontImage:view==="front"?"":canonicalUrlIdentity(frontImage),
  });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
