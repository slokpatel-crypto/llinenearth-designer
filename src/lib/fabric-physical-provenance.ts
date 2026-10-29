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

function clean(value:string){
  return value.replace(/\s+/g," ").trim();
}

export function normalizeFabricPhysicalEvidenceProvenance(value:unknown):FabricPhysicalEvidenceProvenance|null{
  if(!value||typeof value!=="object"||Array.isArray(value)) return null;
  const source=value as Record<string,unknown>;
  // Evidence identities must be supplied text, never coerced arrays/objects.
  if(typeof source.sourceType!=="string" || typeof source.reference!=="string" || typeof source.checkedBy!=="string") return null;
  for(const key of ["evidenceDate","sourceUrl"]){
    if(source[key]!=null && typeof source[key]!=="string") return null;
  }
  const sourceType=clean(source.sourceType) as FabricPhysicalEvidenceSourceType;
  if(!FABRIC_PHYSICAL_EVIDENCE_SOURCE_TYPES.includes(sourceType)) return null;
  const reference=clean(source.reference);
  const checkedBy=clean(source.checkedBy);
  // A truncated roll/source reference or checker identity is not genuine
  // evidence for the original physical material. Reject the whole receipt.
  if(reference.length<2||reference.length>220||checkedBy.length<2||checkedBy.length>120) return null;

  const evidenceDate=clean((source.evidenceDate as string|undefined)??"");
  if(evidenceDate){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(evidenceDate)) return null;
    const [year,month,day]=evidenceDate.split("-").map(Number);
    const calendarDate=new Date(Date.UTC(year,month-1,day));
    // A formatted string alone is not a real inspection date (e.g. 2026-02-31).
    if(calendarDate.getUTCFullYear()!==year ||
      calendarDate.getUTCMonth()+1!==month ||
      calendarDate.getUTCDate()!==day) return null;
  }

  const sourceUrl=clean((source.sourceUrl as string|undefined)??"");
  if(sourceUrl.length>500) return null;
  if(sourceUrl){
    try{
      const parsed=new URL(sourceUrl);
      if(!["https:","http:"].includes(parsed.protocol)) return null;
    }catch{return null;}
  }

  return {
    sourceType,
    reference,
    checkedBy,
    ...(evidenceDate?{evidenceDate}:{}),
    ...(sourceUrl?{sourceUrl}:{}),
  };
}

export function hasFabricPhysicalEvidenceProvenance(value:unknown){
  return normalizeFabricPhysicalEvidenceProvenance(value)!==null;
}
