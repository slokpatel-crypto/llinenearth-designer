import { normalizeFabricPhysicalEvidenceProvenance } from "./fabric-physical-provenance.ts";

export type CatalogPhysicalTemplateMetadata={
  weightGsm?:number;
  drape?:string;
  physicalEvidence?:unknown;
};

/**
 * Only a source-backed, operator-reviewed catalogue value may enter the
 * template's "verified" columns. Unproven metadata stays blank for review.
 */
export function catalogPhysicalCsvPrefill(metadata:CatalogPhysicalTemplateMetadata|undefined){
  const provenance=normalizeFabricPhysicalEvidenceProvenance(metadata?.physicalEvidence);
  const blank={
    verifiedGsm:"" as number|string,
    verifiedDrape:"",
    verifiedPhysicalSourceUrl:"",
    verifiedPhysicalEvidenceNote:"",
  };
  if(!provenance) return blank;
  const mappedDrape=metadata?.drape==="structured"?"Structured"
    : metadata?.drape==="medium"?"Balanced"
      : metadata?.drape==="fluid"||metadata?.drape==="soft"?"Fluid":"";
  const note=[
    provenance.sourceType,
    provenance.reference,
    "checked by "+provenance.checkedBy,
    provenance.evidenceDate||"",
  ].filter(Boolean).join(" · ");
  // Older operator records can contain HTTP links. Retain their auditable
  // written provenance but never export an HTTP link as verified HTTPS evidence.
  const sourceUrl=provenance.sourceUrl?.startsWith("https://")?provenance.sourceUrl:"";
  return {
    verifiedGsm:typeof metadata?.weightGsm==="number"&&Number.isFinite(metadata.weightGsm)&&metadata.weightGsm>=40&&metadata.weightGsm<=1000?metadata.weightGsm:"",
    verifiedDrape:mappedDrape,
    verifiedPhysicalSourceUrl:sourceUrl,
    verifiedPhysicalEvidenceNote:note,
  };
}

export type BatchItem={
  fabricId?:string;
  imageUrl?:string;
  macroImageUrl?:string;
  foldImageUrl?:string;
  sourcePageUrl?:string;
  sourceId?:string;
  declaredMaterial?:string;
  declaredFabricType?:string;
  supplierColorName?:string;
  supplierPatternName?:string;
  notes?:string;
  swatchRealWidthMm?:number|string;
  repeatRealMm?:number|string;
  verifiedGsm?:number|string;
  verifiedDrape?:string;
  verifiedFiberContent?:string;
  verifiedStructure?:number|string;
  verifiedBreathability?:number|string;
  verifiedWrinkleResistance?:number|string;
  verifiedStretch?:number|string;
  verifiedPhysicalSourceUrl?:string;
  verifiedPhysicalEvidenceNote?:string;
};

function parseCsv(text:string){
  const rows:string[][]=[];
  let row:string[]=[];
  let cell="";
  let quoted=false;
  let closedQuote=false;
  const pushCell=()=>{row.push(cell);cell="";closedQuote=false;};
  const pushRow=()=>{
    if(row.some((value)=>value.trim())) rows.push(row);
    row=[];
  };
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){
      if(char==='"'){
        if(text[i+1]==='"'){cell+='"';i+=1;}
        else {quoted=false;closedQuote=true;}
      }else cell+=char;
      continue;
    }
    if(char==='"'){
      if(cell.length||closedQuote) throw new Error("Unexpected quote inside CSV cell.");
      quoted=true;
      continue;
    }
    if(char==="," || char==="\n" || char==="\r"){
      pushCell();
      if(char!==","){
        if(char==="\r" && text[i+1]==="\n") i+=1;
        pushRow();
      }
      continue;
    }
    if(closedQuote){
      if(char!==" "&&char!=="\t") throw new Error("Unexpected text after closing CSV quote.");
      continue;
    }
    cell+=char;
  }
  if(quoted) throw new Error("CSV has an unclosed quoted field.");
  pushCell();
  pushRow();
  return rows;
}

// Keep invalid nonblank physical values intact for strict server rejection.
function numberOrUntrusted(value:string):number|string|undefined {
  const raw=value.trim();
  if(!raw) return undefined;
  if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) return raw;
  const number=Number(raw);
  return Number.isFinite(number)?number:raw;
}

export function itemsFromCsv(text:string){
  const rows=parseCsv(text);
  if(rows.length<2) return [] as BatchItem[];
  const header=rows[0].map((value)=>value.trim());
  if(header.some((key)=>!key) || new Set(header).size!==header.length) {
    throw new Error("CSV contains an empty or duplicate column header.");
  }
  // Unknown headings (including misspelled verified columns) otherwise disappear
  // when mapped into BatchItem, silently losing a supplier's entered facts.
  const supported=new Set([
    "fabricId","imageUrl","macroImageUrl","foldImageUrl","sourcePageUrl","sourceId",
    "declaredMaterial","declaredFabricType","supplierColorName","supplierPatternName",
    "notes","swatchRealWidthMm","repeatRealMm","verifiedGsm","verifiedDrape",
    "verifiedFiberContent","verifiedStructure","verifiedBreathability",
    "verifiedWrinkleResistance","verifiedStretch","verifiedPhysicalSourceUrl",
    "verifiedPhysicalEvidenceNote",
  ]);
  const unsupported=header.filter((key)=>!supported.has(key));
  if(unsupported.length) throw new Error(`Unsupported CSV column: ${unsupported.join(", ")}. Correct the worksheet headings before analysis.`);
  for(const [index,cells] of rows.slice(1).entries()) {
    if(cells.length!==header.length) {
      throw new Error(`CSV data row ${index+2} has ${cells.length} columns; expected ${header.length}.`);
    }
  }
  return rows.slice(1).map((cells,index)=>{
    const raw=Object.fromEntries(header.map((key,index)=>[key,(cells[index]||"").trim()]));
    // Every nonblank parsed row must be accounted for. No identity/source means
    // the batch API cannot process it; dropping the row would report false success.
    if(!raw.fabricId && !raw.imageUrl && !raw.sourcePageUrl) {
      throw new Error(`CSV data row ${index+2} contains no fabricId, imageUrl or sourcePageUrl; none of this worksheet was processed.`);
    }
    const drape=raw.verifiedDrape||undefined;
    return {
      fabricId:raw.fabricId||undefined,
      imageUrl:raw.imageUrl||undefined,
      macroImageUrl:raw.macroImageUrl||undefined,
      foldImageUrl:raw.foldImageUrl||undefined,
      sourcePageUrl:raw.sourcePageUrl||undefined,
      sourceId:raw.sourceId||undefined,
      declaredMaterial:raw.declaredMaterial||undefined,
      declaredFabricType:raw.declaredFabricType||undefined,
      supplierColorName:raw.supplierColorName||undefined,
      supplierPatternName:raw.supplierPatternName||undefined,
      swatchRealWidthMm:numberOrUntrusted(raw.swatchRealWidthMm||""),
      repeatRealMm:numberOrUntrusted(raw.repeatRealMm||""),
      verifiedGsm:numberOrUntrusted(raw.verifiedGsm||""),
      verifiedDrape:drape,
      verifiedFiberContent:raw.verifiedFiberContent||undefined,
      verifiedStructure:numberOrUntrusted(raw.verifiedStructure||""),
      verifiedBreathability:numberOrUntrusted(raw.verifiedBreathability||""),
      verifiedWrinkleResistance:numberOrUntrusted(raw.verifiedWrinkleResistance||""),
      verifiedStretch:numberOrUntrusted(raw.verifiedStretch||""),
      verifiedPhysicalSourceUrl:raw.verifiedPhysicalSourceUrl||undefined,
      verifiedPhysicalEvidenceNote:raw.verifiedPhysicalEvidenceNote||undefined,
      notes:raw.notes||undefined,
    };
  });
}


/**
 * Safe client-facing parser: malformed worksheets never reach the batch API
 * and never throw during React rendering. Keep errors visible to the operator.
 */
export function inspectBatchCsvWorksheet(text:string){
  try{
    return {items:itemsFromCsv(text),error:null as string|null};
  }catch(error){
    return {items:[] as BatchItem[],error:error instanceof Error?error.message:"Invalid CSV worksheet."};
  }
}
