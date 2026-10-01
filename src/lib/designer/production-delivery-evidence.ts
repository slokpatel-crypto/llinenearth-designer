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
  const reentryFields=Array.isArray(source.reentryFields)
    ? [...new Set(source.reentryFields.map(String).filter((item)=>known.has(item as ProductionReentryField)))].slice(0,12) as ProductionReentryField[]
    : [];
  const note=String(source.note||"").trim().slice(0,1200);
  const operator=String(source.operator||"").trim().slice(0,120);
  if(source.manualDesignReentry&&reentryFields.length===0&&note.length<3){
    throw new Error("Record what had to be re-entered or add a short incident note.");
  }
  return {
    manualDesignReentry:source.manualDesignReentry,
    reentryFields,
    note,
    operator,
  };
}

export type ProductionEvidenceOrder={
  order_id:string;
  status:string;
  created_at:string;
};

export type ProductionDeliveryEvidenceRow={
  order_id:string;
  manual_design_reentry:boolean;
  created_at:string;
};

export function summarizeProductionDeliveryEvidence(
  orders:ProductionEvidenceOrder[],
  evidence:ProductionDeliveryEvidenceRow[],
  target=10,
){
  const delivered=[...orders]
    .filter((item)=>item.status==="delivered")
    .sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
  const firstTarget=delivered.slice(0,target);
  const evidenceByOrder=new Map(evidence.map((item)=>[item.order_id,item]));
  const audited=firstTarget.map((order)=>({order,evidence:evidenceByOrder.get(order.order_id)||null}));
  const auditedTargetCount=audited.filter((item)=>item.evidence).length;
  const zeroReentryTargetCount=audited.filter((item)=>item.evidence&&!item.evidence.manual_design_reentry).length;
  const reentryIncidentCount=audited.filter((item)=>item.evidence?.manual_design_reentry).length;
  const missingEvidenceCount=firstTarget.length-auditedTargetCount;
  return {
    target,
    deliveredCount:delivered.length,
    firstTargetOrderCount:firstTarget.length,
    auditedTargetCount,
    zeroReentryTargetCount,
    reentryIncidentCount,
    missingEvidenceCount,
    gateComplete:firstTarget.length>=target&&auditedTargetCount===target&&reentryIncidentCount===0,
  };
}
