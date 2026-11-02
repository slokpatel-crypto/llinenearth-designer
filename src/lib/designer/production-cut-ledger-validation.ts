import {validateOperatorLedgerRows} from "./operator-optional-rpc.ts";

export type VerifiedProductionCutLedgerRow={
  evidence_id:string;case_id:string;order_id:string;
  revision_id:string;recipe_hash:string;garment:"shirt"|"trouser";fabric_id:string;
  fabric_width_cm:number;actual_metres:number;pattern_repeat_mm:number|null;
  pattern_matching:boolean;cut_context:string;checked_by:string;
  evidence_reference:string;note:string;created_at:string;
};

// A successful PostgREST list response is not proof that all cuts have valid
// physical evidence. Invalid or duplicated rows must not inflate a readiness
// count or produce a misleading mean/median for owner/tailor review.
const UUID=/^[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const CASE=/^[A-Za-z0-9._-]{3,80}$/;
const SHA256=/^[a-f\d]{64}$/;
const failed=():never=>{throw new Error("Invalid production cut evidence ledger.");};
const number=(v:unknown,min:number,max:number,positive=false):number=>{
  if(typeof v!=="number"&&typeof v!=="string")return failed();
  if(typeof v==="string"&&!v.trim())return failed();
  const n=Number(v);
  if(!Number.isFinite(n)||n<min||n>max||(positive&&n<=0))return failed();
  return n;
};
const string=(v:unknown,min:number,max:number):string=>{
  if(typeof v!=="string"||v!==v.trim()||v.length<min||v.length>max)return failed();
  return v;
};
const text=(v:unknown,max:number):string=>{
  if(typeof v!=="string"||v.length>max)return failed();
  return v;
};

export function verifyProductionCutLedger(value:unknown,maxRows=1000):VerifiedProductionCutLedgerRow[]{
  const rows=validateOperatorLedgerRows(value,maxRows);
  const seenEvidence=new Set<string>();
  const seenCase=new Set<string>();
  const seenOrderGarment=new Set<string>();
  return rows.map((row)=>{
    const evidence_id=string(row.evidence_id,36,36).toLowerCase();
    const case_id=string(row.case_id,3,80);
    const order_id=string(row.order_id,36,36).toLowerCase();
    const revision_id=string(row.revision_id,3,160);
    const recipe_hash=string(row.recipe_hash,64,64);
    const garment=row.garment;
    const fabric_id=string(row.fabric_id,2,160);
    const fabric_width_cm=number(row.fabric_width_cm,60,220);
    const actual_metres=number(row.actual_metres,0,12,true);
    const pattern_repeat_mm=row.pattern_repeat_mm===null?null:
      number(row.pattern_repeat_mm,0,1000,true);
    const pattern_matching=row.pattern_matching;
    const cut_context=text(row.cut_context,160);
    const checked_by=string(row.checked_by,2,120);
    const evidence_reference=string(row.evidence_reference,3,240);
    const note=text(row.note,1200);
    const created_at=string(row.created_at,20,64);
    if(!UUID.test(evidence_id)||!UUID.test(order_id)||!CASE.test(case_id)||
      !SHA256.test(recipe_hash)||!["shirt","trouser"].includes(String(garment))||
      typeof pattern_matching!=="boolean"||
      !/^\d{4}-\d{2}-\d{2}T/.test(created_at)||
      !/(Z|[+-]\d{2}:\d{2})$/.test(created_at)||
      !Number.isFinite(Date.parse(created_at))||
      !checked_by.trim()||!evidence_reference.trim())return failed();
    const orderGarment=order_id+":"+garment;
    if(seenEvidence.has(evidence_id)||seenCase.has(case_id)||
      seenOrderGarment.has(orderGarment))return failed();
    seenEvidence.add(evidence_id);
    seenCase.add(case_id);
    seenOrderGarment.add(orderGarment);
    return {evidence_id,case_id,order_id,revision_id,recipe_hash,
      garment:garment as "shirt"|"trouser",fabric_id,fabric_width_cm,
      actual_metres,pattern_repeat_mm,pattern_matching,cut_context,
      checked_by,evidence_reference,note,created_at};
  });
}
