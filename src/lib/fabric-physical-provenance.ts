export const FABRIC_PHYSICAL_EVIDENCE_SOURCE_TYPES=[
  "physical_roll",
  "supplier_document",
  "lab_report",
  "owner_measurement",
] as const;

export type FabricPhysicalEvidenceSourceType=typeof FABRIC_PHYSICAL_EVIDENCE_SOURCE_TYPES[number];

export type FabricPhysicalEvidenceProvenance={
  sourceType:FabricPhysicalEvidenceSourceType;
  reference:string;
  checkedBy:string;
  evidenceDate?:string;
  sourceUrl?:string;
};

function clean(value:unknown,limit:number):string|null{
  // Do not coerce JSON arrays/objects or shorten a signed supplier reference.
  if(typeof value!=="string") return null;
  const normalized=value.replace(/\s+/g," ").trim();
  return normalized.length<=limit ? normalized : null;
}

export function normalizeFabricPhysicalEvidenceProvenance(value:unknown):FabricPhysicalEvidenceProvenance|null{
  if(!value||typeof value!=="object"||Array.isArray(value)) return null;
  const source=value as Record<string,unknown>;
  const sourceType=clean(source.sourceType,40);
  if(!sourceType || !FABRIC_PHYSICAL_EVIDENCE_SOURCE_TYPES.includes(sourceType as FabricPhysicalEvidenceSourceType)) return null;
  const reference=clean(source.reference,220);
  const checkedBy=clean(source.checkedBy,120);
  if(!reference || reference.length<2 || !checkedBy || checkedBy.length<2) return null;

  const evidenceDate=source.evidenceDate==null ? "" : clean(source.evidenceDate,20);
  if(evidenceDate===null || (evidenceDate&&!/^\d{4}-\d{2}-\d{2}$/.test(evidenceDate))) return null;

  const sourceUrl=source.sourceUrl==null ? "" : clean(source.sourceUrl,500);
  if(sourceUrl===null) return null;
  if(sourceUrl){
    try{
      const parsed=new URL(sourceUrl);
      if(!["https:","http:"].includes(parsed.protocol)) return null;
    }catch{return null;}
  }

  return {
    sourceType:sourceType as FabricPhysicalEvidenceSourceType,
    reference,
    checkedBy,
    ...(evidenceDate?{evidenceDate}:{}),
    ...(sourceUrl?{sourceUrl}:{}),
  };
}

export function hasFabricPhysicalEvidenceProvenance(value:unknown){
  return normalizeFabricPhysicalEvidenceProvenance(value)!==null;
}
