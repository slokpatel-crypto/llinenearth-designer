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
    || String(input.verifiedFiberContent||"").trim()
    || Number.isFinite(input.verifiedStructure)
    || Number.isFinite(input.verifiedBreathability)
    || Number.isFinite(input.verifiedWrinkleResistance)
    || Number.isFinite(input.verifiedStretch)
  );
}

export function validateVerifiedPhysicalEvidence(input:VerifiedPhysicalEvidenceInput){
  const hasEvidence=hasVerifiedPhysicalEvidence(input);
  const sourceUrl=String(input.verifiedPhysicalSourceUrl||"").trim();
  const note=String(input.verifiedPhysicalEvidenceNote||"").replace(/\s+/g," ").trim();

  if(sourceUrl && !/^https:\/\//i.test(sourceUrl)) {
    throw new Error("Verified physical evidence source URL must use HTTPS.");
  }
  if(hasEvidence && !sourceUrl && note.length<8) {
    throw new Error("Add a physical-evidence source URL or a short evidence note explaining the owner/supplier measurement or inspection.");
  }
  if(Number.isFinite(input.verifiedGsm) && (Number(input.verifiedGsm)<20 || Number(input.verifiedGsm)>1000)) {
    throw new Error("Verified GSM must be between 20 and 1000.");
  }
  for(const [label,value] of [["structure",input.verifiedStructure],["breathability",input.verifiedBreathability],["wrinkle resistance",input.verifiedWrinkleResistance],["stretch",input.verifiedStretch]] as const) {
    if(value!==undefined && (!Number.isFinite(value) || Number(value)<0 || Number(value)>1)) {
      throw new Error(`Verified ${label} must be a number between 0 and 1.`);
    }
  }
  if(Number.isFinite(input.swatchRealWidthMm) && (Number(input.swatchRealWidthMm)<=0 || Number(input.swatchRealWidthMm)>5000)) {
    throw new Error("Photographed swatch width must be between 0 and 5000 mm.");
  }
  if(Number.isFinite(input.repeatRealMm) && (Number(input.repeatRealMm)<=0 || Number(input.repeatRealMm)>5000)) {
    throw new Error("Pattern repeat must be between 0 and 5000 mm.");
  }

  return {
    hasEvidence,
    sourceUrl:sourceUrl||null,
    evidenceNote:note||null,
  };
}
