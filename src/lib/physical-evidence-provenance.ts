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

const PHYSICAL_NUMBER_FIELDS=[
  ["swatchRealWidthMm","photographed swatch width"],
  ["repeatRealMm","pattern repeat"],
  ["verifiedGsm","verified GSM"],
  ["verifiedStructure","verified structure"],
  ["verifiedBreathability","verified breathability"],
  ["verifiedWrinkleResistance","verified wrinkle resistance"],
  ["verifiedStretch","verified stretch"],
] as const;

function optionalPhysicalNumber(value:unknown,label:string){
  if(value===undefined||value===null||value==="") return undefined;
  if(typeof value!=="number"||!Number.isFinite(value)) {
    throw new Error(`${label} must be supplied as a finite number.`);
  }
  return value;
}

function optionalPhysicalText(value:unknown,label:string,limit:number){
  if(value===undefined||value===null||value==="") return undefined;
  if(typeof value!=="string") throw new Error(`${label} must be supplied as text.`);
  const normalized=value.replace(/\s+/g," ").trim();
  if(!normalized) return undefined;
  if(normalized.length>limit) throw new Error(`${label} must be ${limit} characters or fewer.`);
  return normalized;
}

/**
 * Normalize untrusted API or persisted JSON without coercing physical facts.
 * Callers must not silently turn numeric strings, objects or unknown drape
 * labels into verified evidence or drop them from an otherwise valid record.
 */
export function normalizeVerifiedPhysicalEvidenceInput(input:Record<string,unknown>){
  const normalized:VerifiedPhysicalEvidenceInput={};
  for(const [field,label] of PHYSICAL_NUMBER_FIELDS){
    const value=optionalPhysicalNumber(input[field],label);
    if(value!==undefined) normalized[field]=value;
  }

  const drape=input.verifiedDrape;
  if(drape!==undefined&&drape!==null&&drape!==""){
    if(typeof drape!=="string"||!["Fluid","Balanced","Structured"].includes(drape)) {
      throw new Error("Verified drape must use the supported physical drape list.");
    }
    normalized.verifiedDrape=drape as VerifiedPhysicalEvidenceInput["verifiedDrape"];
  }

  const fiberContent=optionalPhysicalText(input.verifiedFiberContent,"Verified fibre content",220);
  const sourceUrl=optionalPhysicalText(input.verifiedPhysicalSourceUrl,"Physical evidence source URL",1800);
  const evidenceNote=optionalPhysicalText(input.verifiedPhysicalEvidenceNote,"Physical evidence note",500);
  if(fiberContent!==undefined) normalized.verifiedFiberContent=fiberContent;
  if(sourceUrl!==undefined) normalized.verifiedPhysicalSourceUrl=sourceUrl;
  if(evidenceNote!==undefined) normalized.verifiedPhysicalEvidenceNote=evidenceNote;
  validateVerifiedPhysicalEvidence(normalized);
  return normalized;
}

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
