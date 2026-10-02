export const FABRIC_TRUTH_POLICY_VERSION="fabric-truth-policy-v1" as const;

export type FabricTruthPolicyStatus="approved"|"review";
export type FabricTruthPolicyField="physicalScale"|"gsm"|"drape"|"fiber";

export type FabricTruthPolicy={
  version:typeof FABRIC_TRUTH_POLICY_VERSION;
  status:FabricTruthPolicyStatus;
  physicalScalePercent:number;
  gsmPercent:number;
  drapePercent:number;
  fiberPercent:number;
  signedBy:string;
  note:string;
};

export type FabricTruthCoverage={
  activeCandidates:number;
  physicalScale:number;
  gsm:number;
  drape:number;
  fiber:number;
};

type UnknownRecord=Record<string,unknown>;

function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}
function text(value:unknown,limit:number){
  return String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
}
function percent(value:unknown,label:string){
  const n=Number(value);
  if(!Number.isFinite(n)||n<1||n>100) throw new Error(`${label} coverage must be between 1% and 100%.`);
  return Math.round(n);
}

export function normalizeFabricTruthPolicy(input:unknown):FabricTruthPolicy{
  const source=record(input);
  const status=text(source.status,20) as FabricTruthPolicyStatus;
  if(status!=="approved"&&status!=="review") throw new Error("Fabric Truth policy status must be approved or review.");
  const signedBy=text(source.signedBy,120);
  if(signedBy.length<2) throw new Error("Named owner or supplier reviewer is required.");
  const note=text(source.note,1200);
  if(note.length<8) throw new Error("Record a short rationale for the physical-evidence thresholds.");
  return {
    version:FABRIC_TRUTH_POLICY_VERSION,
    status,
    physicalScalePercent:percent(source.physicalScalePercent,"Physical-scale"),
    gsmPercent:percent(source.gsmPercent,"GSM"),
    drapePercent:percent(source.drapePercent,"Drape"),
    fiberPercent:percent(source.fiberPercent,"Fibre"),
    signedBy,
    note,
  };
}

function safeCount(value:unknown){
  const n=Number(value);
  return Number.isFinite(n)&&n>0?Math.floor(n):0;
}
function requiredCount(active:number,pct:number){
  return active>0?Math.ceil(active*pct/100):0;
}

export function evaluateFabricTruthPolicy(
  policy:FabricTruthPolicy|null|undefined,
  coverage:Partial<FabricTruthCoverage>|null|undefined,
){
  const active=safeCount(coverage?.activeCandidates);
  const fields:FabricTruthPolicyField[]=["physicalScale","gsm","drape","fiber"];
  const thresholds={
    physicalScale:policy?.physicalScalePercent??null,
    gsm:policy?.gsmPercent??null,
    drape:policy?.drapePercent??null,
    fiber:policy?.fiberPercent??null,
  };
  const counts={
    physicalScale:safeCount(coverage?.physicalScale),
    gsm:safeCount(coverage?.gsm),
    drape:safeCount(coverage?.drape),
    fiber:safeCount(coverage?.fiber),
  };
  const detail=Object.fromEntries(fields.map((field)=>{
    const threshold=thresholds[field];
    const required=threshold===null?null:requiredCount(active,threshold);
    const current=counts[field];
    return [field,{
      thresholdPercent:threshold,
      requiredCount:required,
      currentCount:current,
      percent:active?Math.round(current/active*100):0,
      pass:required!==null&&active>0&&current>=required,
    }];
  })) as Record<FabricTruthPolicyField,{
    thresholdPercent:number|null;
    requiredCount:number|null;
    currentCount:number;
    percent:number;
    pass:boolean;
  }>;
  const approved=policy?.status==="approved";
  const configured=Boolean(policy);
  const gateComplete=Boolean(approved&&active>0&&fields.every((field)=>detail[field].pass));
  const completedFields=fields.filter((field)=>detail[field].pass).length;
  return {
    configured,
    approved,
    activeCandidates:active,
    completedFields,
    totalFields:fields.length,
    progressPercent:Math.round(completedFields/fields.length*100),
    gateComplete,
    detail,
  };
}
