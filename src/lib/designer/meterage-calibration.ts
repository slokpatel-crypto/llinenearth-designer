export type MeterageGarment="shirt"|"trouser";

export type MeterageCalibrationBand={
  label:string;
  minFabricWidthCm:number;
  maxFabricWidthCm:number;
  baseMetres:number;
  patternAllowanceMetres:number;
  cutContext:string;
};

type UnknownRecord=Record<string,unknown>;

function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}

function finite(value:unknown){
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}

export function normalizeMeterageCalibrationDraft(input:unknown){
  const source=record(input);
  const garment=source.garment;
  if(garment!=="shirt"&&garment!=="trouser") throw new Error("Garment must be shirt or trouser.");

  const version=typeof source.version==="string"?source.version.trim():"";
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(version)) {
    throw new Error("Version must be 3–80 characters using letters, numbers, dot, dash or underscore.");
  }

  if(!Array.isArray(source.bands)||source.bands.length<1||source.bands.length>12){
    throw new Error("Meterage table must contain 1–12 bands.");
  }

  const bands:MeterageCalibrationBand[]=source.bands.map((raw,index)=>{
    const item=record(raw);
    const label=typeof item.label==="string"?item.label.trim():"";
    const minFabricWidthCm=typeof item.minFabricWidthCm==="number"&&Number.isFinite(item.minFabricWidthCm)?item.minFabricWidthCm:null;
    const maxFabricWidthCm=typeof item.maxFabricWidthCm==="number"&&Number.isFinite(item.maxFabricWidthCm)?item.maxFabricWidthCm:null;
    const baseMetres=typeof item.baseMetres==="number"&&Number.isFinite(item.baseMetres)?item.baseMetres:null;
    const allowance=item.patternAllowanceMetres??0;
    const patternAllowanceMetres=typeof allowance==="number"&&Number.isFinite(allowance)?allowance:null;
    if(item.cutContext!==undefined&&item.cutContext!==null&&typeof item.cutContext!=="string") throw new Error("Band "+(index+1)+" cut context must be text.");
    const cutContext=typeof item.cutContext==="string"?item.cutContext.trim():"";
    if(cutContext.length>160) throw new Error("Band "+(index+1)+" cut context cannot exceed 160 characters.");

    if(!label||label.length>80) throw new Error("Band "+(index+1)+" needs a label of at most 80 characters.");
    if(minFabricWidthCm===null||maxFabricWidthCm===null||minFabricWidthCm<60||maxFabricWidthCm>220||maxFabricWidthCm<minFabricWidthCm){
      throw new Error("Band "+(index+1)+" has an invalid fabric-width range.");
    }
    if(baseMetres===null||baseMetres<=0||baseMetres>12){
      throw new Error("Band "+(index+1)+" has invalid base metres.");
    }
    if(patternAllowanceMetres===null||patternAllowanceMetres<0||patternAllowanceMetres>5){
      throw new Error("Band "+(index+1)+" has invalid pattern allowance.");
    }
    return {
      label,
      minFabricWidthCm:Math.round(minFabricWidthCm*10)/10,
      maxFabricWidthCm:Math.round(maxFabricWidthCm*10)/10,
      baseMetres:Math.round(baseMetres*100)/100,
      patternAllowanceMetres:Math.round(patternAllowanceMetres*100)/100,
      cutContext,
    };
  }).sort((a,b)=>a.minFabricWidthCm-b.minFabricWidthCm);

  for(let index=1;index<bands.length;index++){
    if(bands[index].minFabricWidthCm<=bands[index-1].maxFabricWidthCm){
      throw new Error("Meterage table fabric-width bands must not overlap.");
    }
  }

  if(source.note!==undefined&&source.note!==null&&typeof source.note!=="string") throw new Error("Meterage model note must be text.");
  const note=typeof source.note==="string"?source.note.trim():"";
  if(note.length>1200) throw new Error("Meterage model note cannot exceed 1200 characters.");
  return {garment,version,bands,note};
}

export function meterageForWidth(
  bands:MeterageCalibrationBand[],
  fabricWidthCm:number,
  patternMatching=false,
){
  const band=bands.find((item)=>fabricWidthCm>=item.minFabricWidthCm&&fabricWidthCm<=item.maxFabricWidthCm);
  if(!band) return null;
  const metres=band.baseMetres+(patternMatching?band.patternAllowanceMetres:0);
  return {
    bandLabel:band.label,
    metres:Math.round(metres*100)/100,
    baseMetres:band.baseMetres,
    patternAllowanceMetres:patternMatching?band.patternAllowanceMetres:0,
  };
}

export function canApproveMeterageModel(evidenceCount:number,approvedBy:string){
  return Number.isInteger(evidenceCount)&&evidenceCount>=20&&approvedBy.trim().length>=2;
}


export type VerifiedMeterageEvidenceCase={
  caseId:string;
  garment:MeterageGarment;
  fabricWidthCm:number;
  actualMetres:number;
  checkedBy:string;
  evidenceReference:string;
};

export function verifiedMeterageEvidenceCase(input:unknown,expectedGarment?:MeterageGarment):VerifiedMeterageEvidenceCase|null{
  const source=record(input);
  if(String(source.subtype||"")!=="production_usage_case") return null;
  if(String(source.version||"")!=="production-usage-v2") return null;
  const garment=String(source.garment||"") as MeterageGarment;
  if(garment!=="shirt"&&garment!=="trouser") return null;
  if(expectedGarment&&garment!==expectedGarment) return null;
  const caseId=String(source.caseId||"").trim();
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) return null;
  const fabricWidthCm=finite(source.fabricWidthCm);
  const actualMetres=finite(source.actualMetres);
  if(fabricWidthCm===null||fabricWidthCm<60||fabricWidthCm>220) return null;
  if(actualMetres===null||actualMetres<=0||actualMetres>12) return null;
  const checkedBy=typeof source.checkedBy==="string"?source.checkedBy.replace(/\s+/g," ").trim():"";
  const evidenceReference=typeof source.evidenceReference==="string"?source.evidenceReference.replace(/\s+/g," ").trim():"";
  if(checkedBy.length<2||checkedBy.length>120||evidenceReference.length<3||evidenceReference.length>240) return null;
  return {caseId,garment,fabricWidthCm,actualMetres,checkedBy,evidenceReference};
}


export function normalizeProductionCutEvidenceDraft(input:unknown){
  const source=record(input);
  const caseId=typeof source.caseId==="string"?source.caseId.trim():"";
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) throw new Error("Anonymous cut case ID is required.");
  const orderId=typeof source.orderId==="string"?source.orderId.trim():"";
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)){
    throw new Error("Valid production order ID is required.");
  }
  const garment=source.garment;
  if(garment!=="shirt"&&garment!=="trouser") throw new Error("Garment must be shirt or trouser.");
  const fabricId=typeof source.fabricId==="string"?source.fabricId.trim():"";
  if(fabricId.length<2||fabricId.length>160) throw new Error("Locked fabric ID must be 2–160 characters without truncation.");
  const fabricWidthCm=typeof source.fabricWidthCm==="number"&&Number.isFinite(source.fabricWidthCm)?source.fabricWidthCm:null;
  if(fabricWidthCm===null||fabricWidthCm<60||fabricWidthCm>220) throw new Error("Fabric width must be between 60 and 220 cm.");
  const actualMetres=typeof source.actualMetres==="number"&&Number.isFinite(source.actualMetres)?source.actualMetres:null;
  if(actualMetres===null||actualMetres<=0||actualMetres>12) throw new Error("Actual cloth usage must be greater than 0 and at most 12 metres.");
  const rawRepeat=source.patternRepeatMm;
  const repeatOmitted=rawRepeat===undefined||rawRepeat===null||rawRepeat==="";
  const repeatRaw=repeatOmitted?null:(typeof rawRepeat==="number"&&Number.isFinite(rawRepeat)?rawRepeat:null);
  if(!repeatOmitted&&(repeatRaw===null||repeatRaw<=0||repeatRaw>1000))
    throw new Error("Pattern repeat must be a measured number between 0 and 1000 mm.");
  if(source.patternMatching!==undefined&&typeof source.patternMatching!=="boolean")
    throw new Error("Pattern matching must be a literal boolean.");
  if(source.cutContext!==undefined&&source.cutContext!==null&&typeof source.cutContext!=="string")
    throw new Error("Cut context must be text.");
  const cutContext=typeof source.cutContext==="string"?source.cutContext.replace(/\s+/g," ").trim():"";
  if(cutContext.length>160) throw new Error("Cut context cannot exceed 160 characters.");
  if(source.note!==undefined&&source.note!==null&&typeof source.note!=="string")
    throw new Error("Cut evidence note must be text.");
  const note=typeof source.note==="string"?source.note.replace(/\s+/g," ").trim():"";
  if(note.length>1200) throw new Error("Cut evidence note cannot exceed 1200 characters.");
  const checkedBy=typeof source.checkedBy==="string"?source.checkedBy.replace(/\s+/g," ").trim():"";
  if(checkedBy.length<2||checkedBy.length>120) throw new Error("Named tailor or checker must be 2–120 characters.");
  const evidenceReference=typeof source.evidenceReference==="string"?source.evidenceReference.replace(/\s+/g," ").trim():"";
  if(evidenceReference.length<3||evidenceReference.length>240) throw new Error("Physical cutting evidence reference must be 3–240 characters.");
  return {
    caseId,orderId,garment,fabricId,
    fabricWidthCm:Math.round(fabricWidthCm*100)/100,
    actualMetres:Math.round(actualMetres*1000)/1000,
    patternRepeatMm:repeatRaw===null?null:Math.round(repeatRaw*100)/100,
    patternMatching:source.patternMatching===true,
    cutContext,
    checkedBy,evidenceReference,
    note,
  };
}

/** The calibration threshold counts unique recorded cut cases, never raw rows.
 * Invalid or duplicated case identities must be reconciled before approval.
 */
export function distinctMeasuredCutCaseIds(rows:unknown,garment:MeterageGarment):string[]|null {
  if(!Array.isArray(rows)) return null;
  const ids:string[]=[];
  const seen=new Set<string>();
  for(const candidate of rows){
    const row=record(candidate);
    if(row.garment!==garment) continue;
    const caseId=typeof row.case_id==="string"?row.case_id.trim():"";
    if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) return null;
    const key=caseId.toLowerCase();
    if(seen.has(key)) return null;
    seen.add(key);
    ids.push(caseId);
  }
  return ids;
}
