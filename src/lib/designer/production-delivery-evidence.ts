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
  const evidenceReference=String(source.evidenceReference||"").replace(/\s+/g," ").trim().slice(0,240);
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
};

export type ProductionDeliveryEvidenceRow={
  order_id:string;
  manual_design_reentry:boolean;
  operator?:string|null;
  evidence_reference?:string|null;
  created_at:string;
};

/** Ten delivered *order identities* must not be inferred from repeated rows
 * or a missing/non-boolean zero-reentry acknowledgement. This is a source
 * evidence gate, not certification of actual physical delivery. */
export function summarizeProductionDeliveryEvidence(
  orders:ProductionEvidenceOrder[],
  evidence:ProductionDeliveryEvidenceRow[],
  target=10,
){
  const validId=(id:unknown)=>typeof id==="string"&&id.trim().length>0&&id===id.trim();
  const validTime=(stamp:unknown)=>typeof stamp==="string"&&
    stamp.trim().length>0&&Number.isFinite(Date.parse(stamp));
  // Compare all order records, not just the delivered entries. Contradictory
  // statuses for the same order ID are an integrity failure, not two orders.
  const orderCounts=new Map<string,number>();
  for(const order of orders){
    if(order&&validId(order.order_id))
      orderCounts.set(order.order_id,(orderCounts.get(order.order_id)||0)+1);
  }
  const duplicateOrderRows=[...orderCounts.values()]
    .reduce((total,count)=>total+Math.max(0,count-1),0);
  const invalidDeliveredRows=orders.filter(order=>
    order?.status==="delivered"&&
    (!validId(order.order_id)||!validTime(order.created_at))
  ).length;
  const deliveredRaw=orders.filter(order=>
    order?.status==="delivered"&&
    validId(order.order_id)&&validTime(order.created_at)
  ).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
  const deliveredSeen=new Set<string>();
  const delivered=deliveredRaw.filter(order=>{
    if(deliveredSeen.has(order.order_id))return false;
    deliveredSeen.add(order.order_id);
    return true;
  });
  const firstTarget=delivered.slice(0,Number.isInteger(target)&&target>0?target:0);

  const evidenceByOrder=new Map<string,ProductionDeliveryEvidenceRow>();
  const evidenceCounts=new Map<string,number>();
  for(const row of evidence){
    if(!row||!validId(row.order_id))continue;
    evidenceCounts.set(row.order_id,(evidenceCounts.get(row.order_id)||0)+1);
    if(!evidenceByOrder.has(row.order_id))evidenceByOrder.set(row.order_id,row);
  }
  const audited=firstTarget.map(order=>{
    const row=evidenceByOrder.get(order.order_id)||null;
    const validReceipt=Boolean(row&&
      evidenceCounts.get(order.order_id)===1&&
      orderCounts.get(order.order_id)===1&&
      typeof row.manual_design_reentry==="boolean"&&
      validTime(row.created_at)&&
      Date.parse(row.created_at)>=Date.parse(order.created_at));
    const provenanceReady=Boolean(validReceipt&&row&&
      typeof row.operator==="string"&&row.operator.trim().length>=2&&
      typeof row.evidence_reference==="string"&&
      row.evidence_reference.trim().length>=3);
    return {order,evidence:row,provenanceReady,validReceipt};
  });
  const duplicateTargetEvidenceRows=firstTarget.reduce(
    (total,order)=>total+Math.max(0,(evidenceCounts.get(order.order_id)||0)-1),0);
  const invalidTargetReceipts=audited.filter(item=>item.evidence&&!item.validReceipt).length;
  const evidenceIntegrityIssues=invalidDeliveredRows+duplicateOrderRows+
    duplicateTargetEvidenceRows+invalidTargetReceipts;
  const recordedTargetCount=audited.filter(item=>item.evidence).length;
  const auditedTargetCount=audited.filter(item=>item.evidence&&item.provenanceReady).length;
  const legacyOrUnverifiedCount=audited.filter(item=>item.evidence&&!item.provenanceReady).length;
  const zeroReentryTargetCount=audited.filter(item=>
    item.provenanceReady&&item.evidence?.manual_design_reentry===false).length;
  const reentryIncidentCount=audited.filter(item=>
    item.provenanceReady&&item.evidence?.manual_design_reentry===true).length;
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
    missingEvidenceCount,
    evidenceIntegrityIssues,
    gateComplete:firstTarget.length>=target&&
      Number.isInteger(target)&&target>0&&auditedTargetCount===target&&
      zeroReentryTargetCount===target&&reentryIncidentCount===0&&
      evidenceIntegrityIssues===0,
  };
}
