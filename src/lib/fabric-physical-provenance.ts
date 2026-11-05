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
  if(typeof value!=="string" || value.length>limit) return null;
  // A bounded literal must not be shortened into a different supplier receipt.
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
  if(evidenceDate===null) return null;
  if(evidenceDate){
    // A formatted string is not proof of an actual inspection day.
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(evidenceDate);
    if(!match) return null;
    const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
    if(year<1 || month<1 || month>12 || day<1 || day>31) return null;
    const daysInMonth=[31,(year%4===0 && (year%100!==0 || year%400===0))?29:28,31,30,31,30,31,31,30,31,30,31];
    if(day>daysInMonth[month-1]) return null;
    // A future-dated inspection has not happened. UTC+14 locations may
    // already be in tomorrow's calendar day, so permit at most UTC tomorrow.
    // This limits impossible future receipts without rejecting real local
    // inspections around a UTC midnight; it is not proof of authenticity.
    const now=new Date();
    const utcToday=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
    if(Date.UTC(year,month-1,day)>utcToday+86_400_000) return null;
  }

  const sourceUrl=source.sourceUrl==null ? "" : clean(source.sourceUrl,500);
  if(sourceUrl===null) return null;
  if(sourceUrl){
    try{
      const parsed=new URL(sourceUrl);
      // A supplier verification link must use TLS, matching the evidence intake contract.
      if(parsed.protocol!=="https:" || !parsed.hostname) return null;
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
