export const PRODUCTION_REENTRY_FIELDS=[
  {id:"fabric_identity",label:"Fabric identity / code"},
  {id:"construction",label:"Collar / cuff / placket / pocket construction"},
  {id:"fit_measurements",label:"Fit / measurement data"},
  {id:"style_recipe",label:"Style recipe / design selection"},
  {id:"quote_order_identity",label:"Quote / order / revision identity"},
  {id:"other",label:"Other design detail"},
] as const;

export type ProductionReentryField=typeof PRODUCTION_REENTRY_FIELDS[number]["id"];

type UnknownRecord=Record<string,unknown>;

function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}

export function normalizeProductionDeliveryEvidence(input:unknown){
  const source=record(input);
  if(typeof source.manualDesignReentry!=="boolean"){
    throw new Error("Confirm whether any design data had to be manually re-entered.");
  }
  const known=new Set(PRODUCTION_REENTRY_FIELDS.map((item)=>item.id));
  if(source.reentryFields!==undefined&&(!Array.isArray(source.reentryFields)||
      !source.reentryFields.every((item)=>typeof item==="string"&&known.has(item as ProductionReentryField)))){
    throw new Error("Re-entry fields must use the supported production evidence choices.");
  }
  const reentryFields=[...new Set((source.reentryFields||[]) as ProductionReentryField[])].slice(0,12);
  if(source.note!==undefined&&source.note!==null&&typeof source.note!=="string")
    throw new Error("Completion note must be text.");
  if(typeof source.operator!=="string"||typeof source.evidenceReference!=="string")
    throw new Error("Named operator and production-flow evidence reference must be text.");
  const note=(source.note||"").trim().slice(0,1200);
  const operator=source.operator.trim().slice(0,120);
  const evidenceReference=source.evidenceReference.replace(/\s+/g," ").trim().slice(0,240);
  if(!source.manualDesignReentry&&reentryFields.length>0)
    throw new Error("Zero re-entry cannot include re-entered design fields.");
  if(operator.length<2) throw new Error("Named operator / checker is required for production completion evidence.");
  if(evidenceReference.length<3) throw new Error("Production-flow evidence reference is required.");
  if(source.manualDesignReentry&&reentryFields.length===0&&note.length<3){
    throw new Error("Record what had to be re-entered or add a short incident note.");
  }
  return {
    manualDesignReentry:source.manualDesignReentry,
    reentryFields,
    note,
    operator,
    evidenceReference,
  };
}

export type ProductionEvidenceOrder={
  order_id:string;
  status:string;
  created_at:string;
  delivered_at?:string;
};

export type ProductionDeliveryEvidenceRow={
  order_id:string;
  manual_design_reentry:boolean;
  operator?:string|null;
  evidence_reference?:string|null;
  created_at:string;
};

const ORDER_STATUSES=new Set(["created","cloth_reserved","cutting","stitching","fitting","ready","delivered","cancelled"]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validTimestamp(value:unknown):value is string{
  return typeof value==="string"&&Number.isFinite(Date.parse(value));
}

export function parseAuthoritativeFirstTenDeliveryAudit(input:unknown){
  if(!Array.isArray(input)||input.length>10) return null;
  if(input.length===0) return {orders:[] as ProductionEvidenceOrder[],evidence:[] as ProductionDeliveryEvidenceRow[],deliveredCount:0};
  const orders:ProductionEvidenceOrder[]=[];
  const evidence:ProductionDeliveryEvidenceRow[]=[];
  const seen=new Set<string>();
  let deliveredCount:number|null=null;
  let priorKey="";
  for(const value of input){
    if(!value||typeof value!=="object"||Array.isArray(value)) return null;
    const row=value as Record<string,unknown>;
    if(typeof row.order_id!=="string"||!UUID.test(row.order_id)||seen.has(row.order_id)) return null;
    if(typeof row.current_status!=="string"||!ORDER_STATUSES.has(row.current_status)) return null;
    if(typeof row.revision_id!=="string"||typeof row.recipe_hash!=="string"||
       !validTimestamp(row.order_created_at)||!validTimestamp(row.delivered_at)) return null;
    if(typeof row.total_delivered_count!=="number"||!Number.isInteger(row.total_delivered_count)||row.total_delivered_count<input.length) return null;
    if(deliveredCount===null) deliveredCount=Number(row.total_delivered_count);
    else if(deliveredCount!==Number(row.total_delivered_count)) return null;
    const chronologyKey=`${new Date(row.delivered_at).toISOString()}\0${row.order_id.toLowerCase()}`;
    if(priorKey&&chronologyKey<=priorKey) return null;
    priorKey=chronologyKey;
    seen.add(row.order_id);
    orders.push({
      order_id:row.order_id,status:row.current_status,
      created_at:row.order_created_at,delivered_at:row.delivered_at,
    });
    if(row.evidence_id===null||row.evidence_id===undefined) continue;
    if(typeof row.evidence_id!=="string"||!UUID.test(row.evidence_id)||
       typeof row.manual_design_reentry!=="boolean"||!validTimestamp(row.evidence_created_at)||
       typeof row.operator!=="string"||typeof row.evidence_reference!=="string") return null;
    evidence.push({
      order_id:row.order_id,
      manual_design_reentry:row.manual_design_reentry,
      operator:row.operator,evidence_reference:row.evidence_reference,
      created_at:row.evidence_created_at,
    });
  }
  return {orders,evidence,deliveredCount:deliveredCount||0};
}

export function summarizeProductionDeliveryEvidence(
  orders:ProductionEvidenceOrder[],
  evidence:ProductionDeliveryEvidenceRow[],
  target=10,
  historyComplete=true,
  authoritativeDeliveredCount?:number,
){
  const delivered=[...orders]
    .filter((item)=>validTimestamp(item.delivered_at)||(item.status==="delivered"&&validTimestamp(item.created_at)))
    .sort((a,b)=>Date.parse(a.delivered_at||a.created_at)-Date.parse(b.delivered_at||b.created_at)||a.order_id.localeCompare(b.order_id));
  const firstTarget=delivered.slice(0,target);
  const evidenceByOrder=new Map(evidence.map((item)=>[item.order_id,item]));
  const audited=firstTarget.map((order)=>{
    const row=evidenceByOrder.get(order.order_id)||null;
    const provenanceReady=Boolean(
      row &&
      typeof row.manual_design_reentry==="boolean" &&
      typeof row.operator==="string" && row.operator.trim().length>=2 &&
      typeof row.evidence_reference==="string" && row.evidence_reference.trim().length>=3
    );
    return {order,evidence:row,provenanceReady};
  });
  const recordedTargetCount=audited.filter((item)=>item.evidence).length;
  const auditedTargetCount=audited.filter((item)=>item.evidence&&item.provenanceReady).length;
  const legacyOrUnverifiedCount=audited.filter((item)=>item.evidence&&!item.provenanceReady).length;
  const zeroReentryTargetCount=audited.filter((item)=>item.evidence&&item.provenanceReady&&item.evidence.manual_design_reentry===false).length;
  const reentryIncidentCount=audited.filter((item)=>item.evidence&&item.provenanceReady&&item.evidence.manual_design_reentry===true).length;
  const statusRegressionCount=firstTarget.filter((item)=>Boolean(item.delivered_at)&&item.status!=="delivered").length;
  const missingEvidenceCount=firstTarget.length-recordedTargetCount;
  return {
    target,
    historyComplete,
    deliveredCount:Number.isInteger(authoritativeDeliveredCount)&&Number(authoritativeDeliveredCount)>=delivered.length
      ?Number(authoritativeDeliveredCount):delivered.length,
    firstTargetOrderCount:firstTarget.length,
    recordedTargetCount,
    auditedTargetCount,
    legacyOrUnverifiedCount,
    zeroReentryTargetCount,
    reentryIncidentCount,
    statusRegressionCount,
    missingEvidenceCount,
    gateComplete:historyComplete&&firstTarget.length>=target&&auditedTargetCount===target&&reentryIncidentCount===0&&statusRegressionCount===0,
  };
}
