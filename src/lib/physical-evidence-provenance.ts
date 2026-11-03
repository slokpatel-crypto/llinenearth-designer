export type VerifiedPhysicalEvidenceInput={
  swatchRealWidthMm?:number;
  repeatRealMm?:number;
  verifiedGsm?:number;
  verifiedDrape?:"Fluid"|"Balanced"|"Structured";
  verifiedFiberContent?:string;
  verifiedStructure?:number;
  verifiedBreathability?:number;
  verifiedWrinkleResistance?:number;
  verifiedStretch?:number;
  verifiedPhysicalSourceUrl?:string;
  verifiedPhysicalEvidenceNote?:string;
};

export function hasVerifiedPhysicalEvidence(input:VerifiedPhysicalEvidenceInput){
  return Boolean(
    Number.isFinite(input.swatchRealWidthMm)
    || Number.isFinite(input.repeatRealMm)
    || Number.isFinite(input.verifiedGsm)
    || input.verifiedDrape
    || (typeof input.verifiedFiberContent==="string" && input.verifiedFiberContent.trim())
    || Number.isFinite(input.verifiedStructure)
    || Number.isFinite(input.verifiedBreathability)
    || Number.isFinite(input.verifiedWrinkleResistance)
    || Number.isFinite(input.verifiedStretch)
  );
}

export function validateVerifiedPhysicalEvidence(input:VerifiedPhysicalEvidenceInput){
  // JSON bodies are not trusted TypeScript values. Arrays and objects must not
  // impersonate supplier documents, inspector notes or certified composition.
  for(const [label,value] of [
    ["fibre content",input.verifiedFiberContent],
    ["source URL",input.verifiedPhysicalSourceUrl],
    ["evidence note",input.verifiedPhysicalEvidenceNote],
  ] as const) {
    if(value!==undefined && value!==null && typeof value!=="string") {
      throw new Error(`Verified physical ${label} must be a text string.`);
    }
  }
  // Check the original, unnormalized supplier literals before trim/collapse.
  // Otherwise a padded receipt can exceed its API bound yet be accepted as
  // a shorter, apparently valid physical source after normalization.
  if([
    [input.verifiedFiberContent,220],
    [input.verifiedPhysicalSourceUrl,1800],
    [input.verifiedPhysicalEvidenceNote,500],
  ].some(([value,limit])=>typeof value==="string" && value.length>(limit as number))) {
    throw new Error("Verified physical evidence exceeds the field's allowed length.");
  }
  const fiberContent=(input.verifiedFiberContent??"").trim();
  const sourceUrl=(input.verifiedPhysicalSourceUrl??"").trim();
  const note=(input.verifiedPhysicalEvidenceNote??"").replace(/\s+/g," ").trim();
  if(fiberContent.length>220 || sourceUrl.length>1800 || note.length>500) {
    throw new Error("Verified physical evidence exceeds the field's allowed length.");
  }
  if(input.verifiedFiberContent && !fiberContent) {
    throw new Error("Verified fibre content cannot be whitespace-only.");
  }
  const hasEvidence=hasVerifiedPhysicalEvidence(input);

  if(sourceUrl) {
    try {
      const url=new URL(sourceUrl);
      if(url.protocol!=="https:" || !url.hostname) throw new Error("Invalid HTTPS URL");
    } catch {
      throw new Error("Verified physical evidence source URL must use HTTPS and be a valid URL.");
    }
  }
  if(hasEvidence && !sourceUrl && note.length<8) {
    throw new Error("Add a physical-evidence source URL or a short evidence note explaining the owner/supplier measurement or inspection.");
  }
  if(input.verifiedDrape!==undefined && input.verifiedDrape!==null
    && !["Fluid","Balanced","Structured"].includes(input.verifiedDrape)) {
    throw new Error("Verified drape must be Fluid, Balanced or Structured.");
  }
  // Reject supplied-but-invalid values, not just finite out-of-range ones.
  // Otherwise NaN, Infinity, strings and negatives are silently downgraded
  // to "not supplied" and can later be replayed as purported physical facts.
  if(input.verifiedGsm!==undefined && input.verifiedGsm!==null
    && (typeof input.verifiedGsm!=="number" || !Number.isFinite(input.verifiedGsm)
      || input.verifiedGsm<20 || input.verifiedGsm>1000)) {
    throw new Error("Verified GSM must be a finite number between 20 and 1000.");
  }
  for(const [label,value] of [["structure",input.verifiedStructure],["breathability",input.verifiedBreathability],["wrinkle resistance",input.verifiedWrinkleResistance],["stretch",input.verifiedStretch]] as const) {
    if(value!==undefined && (!Number.isFinite(value) || Number(value)<0 || Number(value)>1)) {
      throw new Error(`Verified ${label} must be a number between 0 and 1.`);
    }
  }
  if(input.swatchRealWidthMm!==undefined && input.swatchRealWidthMm!==null
    && (typeof input.swatchRealWidthMm!=="number" || !Number.isFinite(input.swatchRealWidthMm)
      || input.swatchRealWidthMm<=0 || input.swatchRealWidthMm>5000)) {
    throw new Error("Photographed swatch width must be a finite number between 0 and 5000 mm.");
  }
  if(input.repeatRealMm!==undefined && input.repeatRealMm!==null
    && (typeof input.repeatRealMm!=="number" || !Number.isFinite(input.repeatRealMm)
      || input.repeatRealMm<=0 || input.repeatRealMm>5000)) {
    throw new Error("Pattern repeat must be a finite number between 0 and 5000 mm.");
  }

  return {
    hasEvidence,
    sourceUrl:sourceUrl||null,
    evidenceNote:note||null,
  };
}
