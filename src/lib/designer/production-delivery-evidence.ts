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
  const operator=typeof source.operator==="string"?source.operator.trim():"";
  const evidenceReference=typeof source.evidenceReference==="string"
    ?source.evidenceReference.replace(/\s+/g," ").trim():"";
  if(operator.length<2||operator.length>120) throw new Error("Named operator / checker must be 2–120 characters for production completion evidence.");
  if(evidenceReference.length<3||evidenceReference.length>240) throw new Error("Production-flow evidence reference is required. Value must be 3–240 characters.");
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
  delivered_at?:string|null;
};

export type ProductionDeliveryEvidenceRow={
  order_id:string;
  manual_design_reentry:boolean;
  operator?:string|null;
  evidence_reference?:string|null;
  created_at:string;
};

/**
 * The first ten DISTINCT delivered production orders must have independently
 * traceable evidence with zero manual design re-entry. Never allow map
 * last-write-wins behavior to hide an earlier re-entry incident, or duplicate
 * order rows to count as additional successful customer deliveries.
 */
export function summarizeProductionDeliveryEvidence(
  orders:ProductionEvidenceOrder[],
  evidence:ProductionDeliveryEvidenceRow[],
  target=10,
){
  const requestedTargetValid=Number.isInteger(target)&&target>=10&&target<=500;
  // Both operator list RPCs are capped at 500 newest rows. At the cap, the
  // earliest-ever deliveries/evidence might be omitted, so proof is incomplete.
  const sourceCoverageUnknown=orders.length>=500||evidence.length>=500;
  const rawDelivered=orders.filter((item)=>item&&item.status==="delivered");
  const orderById=new Map<string,ProductionEvidenceOrder>();
  const repeatedOrderIds=new Set<string>();
  let malformedDeliveryCount=0;
  for(const order of rawDelivered){
    const id=typeof order.order_id==="string"?order.order_id.trim():"";
    const timestamp=typeof order.created_at==="string"?Date.parse(order.created_at):Number.NaN;
    const deliveredAt=order.delivered_at;
    const deliveryTimestamp=deliveredAt===undefined
      ?timestamp
      :typeof deliveredAt==="string"?Date.parse(deliveredAt):Number.NaN;
    if(!id||!Number.isFinite(timestamp)||!Number.isFinite(deliveryTimestamp)
      ||deliveryTimestamp<timestamp){
      malformedDeliveryCount++;
      continue;
    }
    const key=id.toLowerCase();
    if(orderById.has(key)) repeatedOrderIds.add(key);
    else orderById.set(key,order);
  }
  const delivered=[...orderById.values()]
    .sort((a,b)=>Date.parse(a.delivered_at||a.created_at)-Date.parse(b.delivered_at||b.created_at));
  const firstTarget=delivered.slice(0,requestedTargetValid?target:10);
  const evidenceByOrder=new Map<string,ProductionDeliveryEvidenceRow[]>();
  for(const row of evidence){
    if(!row||typeof row.order_id!=="string"||!row.order_id.trim()) continue;
    const key=row.order_id.trim().toLowerCase();
    const group=evidenceByOrder.get(key)||[];
    group.push(row);
    evidenceByOrder.set(key,group);
  }
  const audited=firstTarget.map((order)=>{
    const rows=evidenceByOrder.get(order.order_id.trim().toLowerCase())||[];
    // Every recorded audit matters. A later false cannot erase an earlier
    // true, even if Supabase returned rows in a different order.
    const incident=rows.some((row)=>row.manual_design_reentry===true);
    const provenanceReady=rows.length>0&&rows.every((row)=>
      typeof row.manual_design_reentry==="boolean"
      && typeof row.operator==="string"&&row.operator.trim().length>=2&&row.operator.trim().length<=120
      && typeof row.evidence_reference==="string"&&row.evidence_reference.trim().length>=3&&row.evidence_reference.trim().length<=240
      && typeof row.created_at==="string"&&Number.isFinite(Date.parse(row.created_at))
    );
    const disputed=rows.length>1&&rows.some((row)=>
      row.manual_design_reentry!==rows[0].manual_design_reentry);
    return {order,evidence:rows[0]||null,provenanceReady,incident,disputed};
  });
  // A single job card copied across several delivered orders is not ten
  // independent source documents. Count unique physical references per order.
  const sourceOwner=new Map<string,string>();
  const repeatedSourceReferences=new Set<string>();
  for(const item of audited){
    if(!item.provenanceReady) continue;
    const orderId=item.order.order_id.trim().toLowerCase();
    for(const row of evidenceByOrder.get(orderId)||[]){
      const reference=(row.evidence_reference as string).trim().replace(/\s+/g," ").toLowerCase();
      const firstOrder=sourceOwner.get(reference);
      if(firstOrder&&firstOrder!==orderId) repeatedSourceReferences.add(reference);
      else sourceOwner.set(reference,orderId);
    }
  }
  const recordedTargetCount=audited.filter((item)=>item.evidence).length;
  const auditedTargetCount=audited.filter((item)=>item.provenanceReady).length;
  const legacyOrUnverifiedCount=audited.filter((item)=>item.evidence&&!item.provenanceReady).length;
  const zeroReentryTargetCount=audited.filter((item)=>item.provenanceReady&&!item.incident).length;
  const reentryIncidentCount=audited.filter((item)=>item.incident).length;
  const disputedTargetCount=audited.filter((item)=>item.disputed).length;
  const missingEvidenceCount=firstTarget.length-recordedTargetCount;
  return {
    target,
    deliveredCount:delivered.length,
    firstTargetOrderCount:firstTarget.length,
    recordedTargetCount,
    auditedTargetCount,
    legacyOrUnverifiedCount,
    zeroReentryTargetCount,
    reentryIncidentCount,
    disputedTargetCount,
    duplicateDeliveredOrderCount:repeatedOrderIds.size,
    duplicateEvidenceSourceCount:repeatedSourceReferences.size,
    sourceCoverageUnknown,
    invalidDeliveredOrderCount:malformedDeliveryCount,
    missingEvidenceCount,
    gateComplete:firstTarget.length>=target&&requestedTargetValid
      &&auditedTargetCount===target&&zeroReentryTargetCount===target
      &&reentryIncidentCount===0&&disputedTargetCount===0
      &&repeatedOrderIds.size===0&&repeatedSourceReferences.size===0
      &&malformedDeliveryCount===0&&!sourceCoverageUnknown,
  };
}
