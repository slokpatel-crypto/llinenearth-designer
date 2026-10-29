import type {
  EaseRangeCm,
  ShirtEaseClass,
  TrouserEaseClass,
} from "./house-ease.ts";

export const SHIRT_EASE_FIELDS=["chest","waist","bicep","neck","wrist"] as const;
export const TROUSER_EASE_FIELDS=["waist","seat","thigh","knee"] as const;
export const SHIRT_EASE_CLASSES=["slim","regular","relaxed"] as const satisfies readonly ShirtEaseClass[];
export const TROUSER_EASE_CLASSES=["flat","pleated","wide","cropped","other"] as const satisfies readonly TrouserEaseClass[];

export type ShirtEaseField=typeof SHIRT_EASE_FIELDS[number];
export type TrouserEaseField=typeof TROUSER_EASE_FIELDS[number];
export type EaseCalibrationGarment="shirt"|"trouser";

export type HouseEaseCalibrationTable={
  shirt:Record<ShirtEaseClass,Record<ShirtEaseField,EaseRangeCm>>;
  trouser:Record<TrouserEaseClass,Record<TrouserEaseField,EaseRangeCm>>;
};

type UnknownRecord=Record<string,unknown>;

function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}
function text(value:unknown,limit:number){
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
}
function literalText(value:unknown,limit:number,label:string){
  if(value===undefined||value===null) return "";
  if(typeof value!=="string") throw new Error(label+" must be literal text.");
  const cleaned=value.replace(/\s+/g," ").trim();
  if(cleaned.length>limit) throw new Error(label+" is too long; physical evidence must not be truncated.");
  return cleaned;
}
function literalFinite(value:unknown){
  return typeof value==="number"&&Number.isFinite(value)?value:null;
}
function round(value:number){
  return Math.round(value*100)/100;
}

export function normalizeEaseEvidenceDraft(input:unknown){
  const source=record(input);
  const caseId=literalText(source.caseId,80,"Anonymous garment-evidence case ID");
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)) throw new Error("Anonymous garment-evidence case ID is required.");

  const garment=source.garment;
  if(garment!=="shirt"&&garment!=="trouser") throw new Error("Garment must be shirt or trouser.");

  const fitClass=literalText(source.fitClass,30,"Fit class");
  const validClass=garment==="shirt"
    ? SHIRT_EASE_CLASSES.includes(fitClass as ShirtEaseClass)
    : TROUSER_EASE_CLASSES.includes(fitClass as TrouserEaseClass);
  if(!validClass) throw new Error("Fit class does not match the selected garment.");

  const field=literalText(source.field,30,"Measurement field");
  const validField=garment==="shirt"
    ? SHIRT_EASE_FIELDS.includes(field as ShirtEaseField)
    : TROUSER_EASE_FIELDS.includes(field as TrouserEaseField);
  if(!validField) throw new Error("Measurement field does not match the selected garment.");

  const bodyCm=literalFinite(source.bodyCm);
  const finishedCm=literalFinite(source.finishedCm);
  if(bodyCm===null||finishedCm===null||bodyCm<=0||finishedCm<=0||bodyCm>300||finishedCm>350){
    throw new Error("Body and finished-garment measurements must be valid centimetre values.");
  }

  const easeCm=round(finishedCm-bodyCm);
  const tailor=literalText(source.tailor,120,"Tailor/inspector");
  const garmentRef=literalText(source.garmentRef,120,"Finished-garment reference");
  const note=literalText(source.note,1000,"Physical ease observation");
  if(tailor.length<2) throw new Error("Tailor/inspector initials or name are required.");
  if(garmentRef.length<2) throw new Error("A real finished-garment reference is required.");

  return {
    caseId,
    garment,
    fitClass,
    field,
    bodyCm:round(bodyCm),
    finishedCm:round(finishedCm),
    easeCm,
    tailor,
    garmentRef,
    note,
  };
}

function range(value:unknown,label:string):EaseRangeCm{
  const item=record(value);
  const min=literalFinite(item.min);
  const max=literalFinite(item.max);
  if(min===null||max===null||min<0||max<min||max>80){
    throw new Error(label+" has an invalid ease range.");
  }
  return {min:round(min),max:round(max)};
}

function normalizeGarmentTable(
  raw:unknown,
  garment:EaseCalibrationGarment,
){
  const source=record(raw);
  const classes=garment==="shirt"?SHIRT_EASE_CLASSES:TROUSER_EASE_CLASSES;
  const fields=garment==="shirt"?SHIRT_EASE_FIELDS:TROUSER_EASE_FIELDS;
  const output:Record<string,Record<string,EaseRangeCm>>={};

  for(const fitClass of classes){
    const row=record(source[fitClass]);
    output[fitClass]={};
    for(const field of fields){
      output[fitClass][field]=range(row[field],garment+" "+fitClass+" "+field);
    }
  }
  return output;
}

export function normalizeHouseEaseCalibrationDraft(input:unknown){
  const source=record(input);
  const version=literalText(source.version,80,"Ease model version");
  if(!/^[A-Za-z0-9._-]{3,80}$/.test(version)){
    throw new Error("Version must be 3–80 characters using letters, numbers, dot, dash or underscore.");
  }

  const shirt=normalizeGarmentTable(source.shirt,"shirt") as HouseEaseCalibrationTable["shirt"];
  const trouser=normalizeGarmentTable(source.trouser,"trouser") as HouseEaseCalibrationTable["trouser"];
  const note=literalText(source.note,1200,"Ease model rationale");
  return {version,shirt,trouser,note};
}

export function easeEvidenceKey(input:{
  garment:string;
  fitClass:string;
  field:string;
}){
  return `${input.garment}:${input.fitClass}:${input.field}`;
}

export function requiredEaseEvidenceKeys(){
  return [
    ...SHIRT_EASE_CLASSES.flatMap((fitClass)=>SHIRT_EASE_FIELDS.map((field)=>easeEvidenceKey({garment:"shirt",fitClass,field}))),
    ...TROUSER_EASE_CLASSES.flatMap((fitClass)=>TROUSER_EASE_FIELDS.map((field)=>easeEvidenceKey({garment:"trouser",fitClass,field}))),
  ];
}

export function summarizeEaseEvidence(
  rows:Array<{garment?:unknown;fit_class?:unknown;field?:unknown;case_id?:unknown;ease_cm?:unknown}>,
){
  const keyCases=new Map<string,Set<string>>();
  for(const row of rows){
    const garment=typeof row.garment==="string"?row.garment:"";
    const fitClass=typeof row.fit_class==="string"?row.fit_class:"";
    const field=typeof row.field==="string"?row.field:"";
    const caseId=typeof row.case_id==="string"?row.case_id:"";
    const ease=literalFinite(row.ease_cm);
    if(!/^[A-Za-z0-9._-]{3,80}$/.test(caseId)||ease===null) continue;
    const key=easeEvidenceKey({garment,fitClass,field});
    if(!keyCases.has(key)) keyCases.set(key,new Set());
    keyCases.get(key)!.add(caseId);
  }
  const required=requiredEaseEvidenceKeys();
  const covered=required.filter((key)=>(keyCases.get(key)?.size||0)>0);
  return {
    requiredCells:required.length,
    coveredCells:covered.length,
    uncoveredCells:required.filter((key)=>!covered.includes(key)),
    evidenceCoverageComplete:covered.length===required.length,
    uniqueCases:new Set([...keyCases.values()].flatMap((set)=>[...set])).size,
  };
}

export function canApproveHouseEaseModel(input:{
  evidenceCoverageComplete:boolean;
  approvedBy:string;
}){
  return input.evidenceCoverageComplete&&input.approvedBy.trim().length>=2;
}


export type ApprovedHouseEaseModel={
  modelId:string;
  version:string;
  table:HouseEaseCalibrationTable;
  approvedBy:string;
  approvedAt:string|null;
};

export function approvedHouseEaseModelFromRow(input:unknown):ApprovedHouseEaseModel|null {
  const source=record(input);
  if(text(source.status,20)!=="approved") return null;
  const modelId=text(source.model_id,120);
  const approvedBy=text(source.approved_by,120);
  if(!modelId||approvedBy.length<2) return null;
  try{
    const normalized=normalizeHouseEaseCalibrationDraft({
      version:source.version,
      shirt:source.shirt_table,
      trouser:source.trouser_table,
      note:source.note,
    });
    return {
      modelId,
      version:normalized.version,
      table:{shirt:normalized.shirt,trouser:normalized.trouser},
      approvedBy,
      approvedAt:text(source.approved_at,80)||null,
    };
  }catch{
    return null;
  }
}
