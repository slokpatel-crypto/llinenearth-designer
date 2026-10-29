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
  const decision=source.decision;
  if(decision!=="approved"&&decision!=="rework") throw new Error("QC decision must be approved or rework.");

  // Physical QC is a human release gate. Do not turn coerced, unknown or
  // silently discarded evidence into a passing inspection.
  const suppliedChecks=source.checks===undefined?{}:source.checks;
  if(!suppliedChecks||typeof suppliedChecks!=="object"||Array.isArray(suppliedChecks))
    throw new Error("QC checks must be a named boolean record.");
  const rawChecks=suppliedChecks as Record<string,unknown>;
  const knownCheckIds=new Set<string>(FINISHED_GARMENT_QC_CHECKS.map((item)=>item.id));
  for(const [id,passed] of Object.entries(rawChecks)){
    if(!knownCheckIds.has(id)||typeof passed!=="boolean")
      throw new Error("QC checks must use supported names and literal booleans.");
  }
  const checks={} as Record<FinishedGarmentQcCheckId,boolean>;
  for(const item of FINISHED_GARMENT_QC_CHECKS) checks[item.id]=rawChecks[item.id]===true;

  const knownDefects=new Set<string>(FINISHED_GARMENT_QC_DEFECTS.map((item)=>item.id));
  const rawDefects=source.defects===undefined?[]:source.defects;
  if(!Array.isArray(rawDefects)||rawDefects.length>12
    ||!rawDefects.every((item)=>typeof item==="string"&&knownDefects.has(item)))
    throw new Error("QC defects must use the supported physical defect list (maximum 12).");
  const defects=[...new Set(rawDefects)] as FinishedGarmentQcDefectId[];
  if(source.note!==undefined&&source.note!==null&&typeof source.note!=="string")
    throw new Error("QC note must be literal text.");
  const note=typeof source.note==="string"?source.note.trim():"";
  if(note.length>1200) throw new Error("QC note cannot exceed 1200 characters.");
  // Identity-bearing physical evidence must not be coerced or silently truncated.
  const inspector=typeof source.inspector==="string"?source.inspector.trim():"";
  const inspectionReference=typeof source.inspectionReference==="string"
    ?source.inspectionReference.replace(/\s+/g," ").trim():"";

  if(inspector.length<2||inspector.length>120) throw new Error("Named inspector / checker is required (2–120 characters).");
  if(inspectionReference.length<3||inspectionReference.length>240) throw new Error("Physical inspection reference is required. Value must be 3–240 characters.");
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
