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

function clean(value:unknown,limit:number){
  // Do not turn an object/number into an apparently human-signed physical receipt.
  if(typeof value!=="string"||value.length>limit*4) return "";
  const normalized=value.replace(/\s+/g," ").trim();
  return normalized.length<=limit?normalized:"";
}

function validEvidenceDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date=new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime())
    && date.toISOString().slice(0,10)===value
    && value<=new Date().toISOString().slice(0,10);
}

function validEvidenceUrl(value:string){
  try{
    const url=new URL(value);
    return url.protocol==="https:" && Boolean(url.hostname)
      && !url.username && !url.password;
  }catch{return false;}
}

export function normalizeFabricPhysicalEvidenceProvenance(value:unknown):FabricPhysicalEvidenceProvenance|null{
  if(!value||typeof value!=="object"||Array.isArray(value)) return null;
  const source=value as Record<string,unknown>;
  const sourceType=clean(source.sourceType,40) as FabricPhysicalEvidenceSourceType;
  if(!FABRIC_PHYSICAL_EVIDENCE_SOURCE_TYPES.includes(sourceType)) return null;
  const reference=clean(source.reference,220);
  const checkedBy=clean(source.checkedBy,120);
  if(reference.length<2||checkedBy.length<2) return null;

  const evidenceDate=clean(source.evidenceDate,20);
  if(source.evidenceDate!=null && source.evidenceDate!=="" && !evidenceDate) return null;
  if(evidenceDate&&!validEvidenceDate(evidenceDate)) return null;

  const sourceUrl=clean(source.sourceUrl,500);
  if(source.sourceUrl!=null && source.sourceUrl!=="" && !sourceUrl) return null;
  if(sourceUrl&&!validEvidenceUrl(sourceUrl)) return null;

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
