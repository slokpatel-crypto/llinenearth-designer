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
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(char==='"'){
      if(quoted && text[i+1]==='"'){cell+='"';i+=1;}
      else quoted=!quoted;
      continue;
    }
    if(char==="," && !quoted){row.push(cell);cell="";continue;}
    if((char==="\n"||char==="\r") && !quoted){
      if(char==="\r"&&text[i+1]==="\n") i+=1;
      row.push(cell);cell="";
      if(row.some((value)=>value.trim())) rows.push(row);
      row=[];
      continue;
    }
    cell+=char;
  }
  row.push(cell);
  if(row.some((value)=>value.trim())) rows.push(row);
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
  return rows.slice(1).map((cells)=>{
    const raw=Object.fromEntries(header.map((key,index)=>[key,(cells[index]||"").trim()]));
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
  }).filter((item)=>item.fabricId || item.imageUrl || item.sourcePageUrl);
}

