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
  const garment=String(source.garment||"") as MeterageGarment;
  if(garment!=="shirt"&&garment!=="trouser") throw new Error("Garment must be shirt or trouser.");

  const version=String(source.version||"").trim().slice(0,80);
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(version)) {
    throw new Error("Version must be 3–80 characters using letters, numbers, dot, dash or underscore.");
  }

  if(!Array.isArray(source.bands)||source.bands.length<1||source.bands.length>12){
    throw new Error("Meterage table must contain 1–12 bands.");
  }

  const bands:MeterageCalibrationBand[]=source.bands.map((raw,index)=>{
    const item=record(raw);
    const label=String(item.label||"").trim().slice(0,80);
    const minFabricWidthCm=finite(item.minFabricWidthCm);
    const maxFabricWidthCm=finite(item.maxFabricWidthCm);
    const baseMetres=finite(item.baseMetres);
    const patternAllowanceMetres=finite(item.patternAllowanceMetres??0);
    const cutContext=String(item.cutContext||"").trim().slice(0,160);

    if(!label) throw new Error("Band "+(index+1)+" needs a label.");
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

  const note=String(source.note||"").trim().slice(0,1200);
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
  const caseId=String(source.caseId||"").trim().slice(0,80);
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) return null;
  const fabricWidthCm=finite(source.fabricWidthCm);
  const actualMetres=finite(source.actualMetres);
  if(fabricWidthCm===null||fabricWidthCm<60||fabricWidthCm>220) return null;
  if(actualMetres===null||actualMetres<=0||actualMetres>12) return null;
  const checkedBy=String(source.checkedBy||"").replace(/\s+/g," ").trim().slice(0,120);
  const evidenceReference=String(source.evidenceReference||"").replace(/\s+/g," ").trim().slice(0,240);
  if(checkedBy.length<2||evidenceReference.length<3) return null;
  return {caseId,garment,fabricWidthCm,actualMetres,checkedBy,evidenceReference};
}


export function normalizeProductionCutEvidenceDraft(input:unknown){
  const source=record(input);
  const caseId=String(source.caseId||"").trim().slice(0,80);
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) throw new Error("Anonymous cut case ID is required.");
  const orderId=String(source.orderId||"").trim();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)){
    throw new Error("Valid production order ID is required.");
  }
  const garment=String(source.garment||"") as MeterageGarment;
  if(garment!=="shirt"&&garment!=="trouser") throw new Error("Garment must be shirt or trouser.");
  const fabricId=String(source.fabricId||"").trim().slice(0,160);
  if(fabricId.length<2) throw new Error("Locked fabric ID is required.");
  const fabricWidthCm=finite(source.fabricWidthCm);
  if(fabricWidthCm===null||fabricWidthCm<60||fabricWidthCm>220) throw new Error("Fabric width must be between 60 and 220 cm.");
  const actualMetres=finite(source.actualMetres);
  if(actualMetres===null||actualMetres<=0||actualMetres>12) throw new Error("Actual cloth usage must be greater than 0 and at most 12 metres.");
  const repeatRaw=source.patternRepeatMm===null||source.patternRepeatMm===undefined||String(source.patternRepeatMm).trim()===""
    ? null
    : finite(source.patternRepeatMm);
  if(repeatRaw!==null&&(repeatRaw<=0||repeatRaw>1000)) throw new Error("Pattern repeat must be between 0 and 1000 mm.");
  const checkedBy=String(source.checkedBy||"").replace(/\s+/g," ").trim().slice(0,120);
  if(checkedBy.length<2) throw new Error("Named tailor or checker is required.");
  const evidenceReference=String(source.evidenceReference||"").replace(/\s+/g," ").trim().slice(0,240);
  if(evidenceReference.length<3) throw new Error("Physical cutting evidence reference is required.");
  return {
    caseId,orderId,garment,fabricId,
    fabricWidthCm:Math.round(fabricWidthCm*100)/100,
    actualMetres:Math.round(actualMetres*1000)/1000,
    patternRepeatMm:repeatRaw===null?null:Math.round(repeatRaw*100)/100,
    patternMatching:source.patternMatching===true,
    cutContext:String(source.cutContext||"").replace(/\s+/g," ").trim().slice(0,160),
    checkedBy,evidenceReference,
    note:String(source.note||"").replace(/\s+/g," ").trim().slice(0,1200),
  };
}
