export const FINISHED_GARMENT_QC_CHECKS=[
  {id:"recipe_match",label:"Locked construction matches the finished garment"},
  {id:"fabric_match",label:"Fabric IDs match the locked recipe"},
  {id:"measurement_check",label:"Finished measurements were checked against the approved target"},
  {id:"pattern_alignment",label:"Stripe/check/pattern alignment is acceptable where applicable"},
  {id:"stitching_finish",label:"Stitching, seams, buttons and finishing are acceptable"},
  {id:"clean_damage_free",label:"Garment is clean and free from visible damage"},
] as const;

export type FinishedGarmentQcCheckId=typeof FINISHED_GARMENT_QC_CHECKS[number]["id"];
export type FinishedGarmentQcDecision="approved"|"rework";

export const FINISHED_GARMENT_QC_DEFECTS=[
  {id:"measurement",label:"Measurement / fit"},
  {id:"construction",label:"Construction mismatch"},
  {id:"fabric_mismatch",label:"Wrong fabric"},
  {id:"pattern_alignment",label:"Pattern alignment"},
  {id:"stitching",label:"Stitching / seam"},
  {id:"finishing",label:"Finishing / button / press"},
  {id:"damage_stain",label:"Damage / stain"},
  {id:"other",label:"Other"},
] as const;

export type FinishedGarmentQcDefectId=typeof FINISHED_GARMENT_QC_DEFECTS[number]["id"];

type UnknownRecord=Record<string,unknown>;
function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}

export function normalizeFinishedGarmentQcDraft(input:unknown){
  const source=record(input);
  const decision=String(source.decision||"") as FinishedGarmentQcDecision;
  if(decision!=="approved"&&decision!=="rework") throw new Error("QC decision must be approved or rework.");

  const rawChecks=record(source.checks);
  const checks={} as Record<FinishedGarmentQcCheckId,boolean>;
  for(const item of FINISHED_GARMENT_QC_CHECKS) checks[item.id]=rawChecks[item.id]===true;

  const knownDefects=new Set(FINISHED_GARMENT_QC_DEFECTS.map((item)=>item.id));
  const defects=Array.isArray(source.defects)
    ? [...new Set(source.defects.map(String).filter((item)=>knownDefects.has(item as FinishedGarmentQcDefectId)))].slice(0,12) as FinishedGarmentQcDefectId[]
    : [];
  const note=String(source.note||"").trim().slice(0,1200);
  const inspector=String(source.inspector||"").trim().slice(0,120);
  const inspectionReference=String(source.inspectionReference||"").replace(/\s+/g," ").trim().slice(0,240);

  if(inspector.length<2) throw new Error("Named inspector / checker is required.");
  if(inspectionReference.length<3) throw new Error("Physical inspection reference is required.");
  if(decision==="approved"&&FINISHED_GARMENT_QC_CHECKS.some((item)=>!checks[item.id])){
    throw new Error("Every finished-garment QC check must pass before approval.");
  }
  if(decision==="rework"&&defects.length===0&&note.length<3){
    throw new Error("Record at least one defect or a short rework note.");
  }
  return {decision,checks,defects,note,inspector,inspectionReference};
}

export function latestQcDecision<T extends {decision:string;created_at:string}>(items:T[]){
  if(!items.length) return null;
  return [...items].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))[0]?.decision||null;
}
