import { verifiedOperatorProductionCreateId } from "./operator-production-receipt.ts";

/** Parse an exact, offset-bearing PostgreSQL timestamp without JS calendar rollover.
 * Date.parse normalizes impossible days such as February 31 into March, which
 * must never count as real physical delivery or inspection evidence. */
export function parseProductionEvidenceTimestamp(value:unknown):number{
  if(typeof value!=="string") return Number.NaN;
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/i.exec(value);
  if(!match) return Number.NaN;
  const year=Number(match[1]);
  const month=Number(match[2]);
  const day=Number(match[3]);
  const hour=Number(match[4]);
  const minute=Number(match[5]);
  const second=Number(match[6]);
  const zone=match[7];
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1||month<1||month>12||day<1||day>days[month-1]
    ||hour>23||minute>59||second>59) return Number.NaN;
  if(zone.toUpperCase()!=="Z"){
    const offsetHour=Number(zone.slice(1,3));
    const offsetMinute=Number(zone.slice(4,6));
    if(offsetHour>23||offsetMinute>59) return Number.NaN;
  }
  return Date.parse(value);
}

export const PRODUCTION_REENTRY_FIELDS=[
  {id:"fabric_identity",label:"Fabric identity / code"},
  {id:"construction",label:"Collar / cuff / placket / pocket construction"},
  {id:"fit_measurements",label:"Fit / measurement data"},
  {id:"style_recipe",label:"Style recipe / design selection"},
  {id:"quote_order_identity",label:"Quote / order / revision identity"},
  {id:"other",label:"Other design detail"},
] as const;

export type ProductionReentryField=typeof PRODUCTION_REENTRY_FIELDS[number]["id"];

// Both incoming submissions and historical delivery records must preserve
// the closed physical-incident vocabulary, without casting unknown IDs away.
const knownProductionReentryFieldIds=new Set<string>(PRODUCTION_REENTRY_FIELDS.map((item)=>item.id));
export function validProductionReentryFields(value:unknown):value is ProductionReentryField[]{
  return Array.isArray(value)&&value.every((field)=>
    typeof field==="string"&&knownProductionReentryFieldIds.has(field));
}

type UnknownRecord=Record<string,unknown>;

function record(value:unknown):UnknownRecord{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as UnknownRecord:{};
}

export function normalizeProductionDeliveryEvidence(input:unknown){
  const source=record(input);
  if(typeof source.manualDesignReentry!=="boolean"){
    throw new Error("Confirm whether any design data had to be manually re-entered.");
  }
  const submittedFields=source.reentryFields===undefined?[]:source.reentryFields;
  if(!validProductionReentryFields(submittedFields)){
    throw new Error("Re-entered fields must use the supported production field list.");
  }
  // Duplicate known choices carry no extra meaning; unknown or coerced values
  // are rejected above rather than disappearing into a false clean audit.
  const reentryFields=[...new Set(submittedFields as ProductionReentryField[])];
  if(source.note!==undefined&&source.note!==null&&typeof source.note!=="string")
    throw new Error("Production completion note must be text.");
  const note=typeof source.note==="string"?source.note.trim():"";
  if(note.length>1200) throw new Error("Production completion note cannot exceed 1200 characters.");
  const operator=typeof source.operator==="string"?source.operator.trim():"";
  const evidenceReference=typeof source.evidenceReference==="string"
    ?source.evidenceReference.replace(/\s+/g," ").trim():"";
  if(operator.length<2||operator.length>120) throw new Error("Named operator / checker must be 2–120 characters for production completion evidence.");
  if(evidenceReference.length<3||evidenceReference.length>240) throw new Error("Production-flow evidence reference is required. Value must be 3–240 characters.");
  if(!source.manualDesignReentry&&reentryFields.length>0){
    throw new Error("Zero design-data re-entry cannot list any manually re-entered fields.");
  }
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

/**
 * Fail-closed contract guard for the authoritative first-ten SQL snapshot.
 * This only validates response integrity; real shop evidence and physical
 * approval remain separate requirements for a production release.
 */
export function validProductionFirstTenAuditBasis(input:unknown):boolean{
  if(!input||typeof input!=="object"||Array.isArray(input)) return false;
  const basis=input as Record<string,unknown>;
  if(basis.version!=="linen-earth-production-first-ten-audit-v2"
    ||basis.historyValid!==true
    ||!Array.isArray(basis.orders)||basis.orders.length>10
    ||!Array.isArray(basis.evidence)) return false;
  const time=parseProductionEvidenceTimestamp;
  const deliveredAtByOrder=new Map<string,number>();
  const orderLineage=new Map<string,{revision:string;hash:string;created:string}>();
  const evidenceIds=new Set<string>();
  let previousDeliveredAt=Number.NEGATIVE_INFINITY;
  for(const value of basis.orders){
    if(!value||typeof value!=="object"||Array.isArray(value)) return false;
    const order=value as Record<string,unknown>;
    if(!verifiedOperatorProductionCreateId(order.order_id)
      ||order.status!=="delivered"
      ||typeof order.revision_id!=="string"||order.revision_id.trim().length<3||order.revision_id.length>240
      ||typeof order.recipe_hash!=="string"||!/^[a-f0-9]{64}$/i.test(order.recipe_hash)) return false;
    const createdAt=time(order.created_at);
    const deliveredAt=time(order.delivered_at);
    const key=order.order_id.toLowerCase();
    if(!Number.isFinite(createdAt)||!Number.isFinite(deliveredAt)
      ||deliveredAt<createdAt||deliveredAtByOrder.has(key)
      ||deliveredAt<previousDeliveredAt) return false;
    // SQL sorts the first-ever deliveries by event time. Never certify an
    // arbitrary later window or reordered rows as the first-ten snapshot.
    previousDeliveredAt=deliveredAt;
    deliveredAtByOrder.set(key,deliveredAt);
    orderLineage.set(key,{revision:order.revision_id as string,hash:order.recipe_hash as string,created:order.created_at as string});
  }
  for(const value of basis.evidence){
    if(!value||typeof value!=="object"||Array.isArray(value)) return false;
    const evidence=value as Record<string,unknown>;
    // Database UUID identities are exact receipts; do not silently repair
    // whitespace-padded order/evidence selectors into credible audit proof.
    if(!verifiedOperatorProductionCreateId(evidence.order_id)
      ||!verifiedOperatorProductionCreateId(evidence.evidence_id)) return false;
    const key=evidence.order_id.toLowerCase();
    const deliveryAt=deliveredAtByOrder.get(key);
    const lineage=orderLineage.get(key);
    const evidenceId=evidence.evidence_id.toLowerCase();
    const auditedAt=time(evidence.created_at);
    if(deliveryAt===undefined||!lineage||!Number.isFinite(auditedAt)||auditedAt<deliveryAt
      ||!evidenceId||evidenceIds.has(evidenceId)
      ||evidence.revision_id!==lineage.revision||evidence.recipe_hash!==lineage.hash
      ||evidence.order_created_at!==lineage.created
      ||typeof evidence.note!=="string"
      ||!Array.isArray(evidence.reentry_fields)
      ||new Set(evidence.reentry_fields).size!==evidence.reentry_fields.length
      ||(evidence.manual_design_reentry===true&&evidence.reentry_fields.length===0&&evidence.note.trim().length<3)
      ||typeof evidence.manual_design_reentry!=="boolean"
      ||(evidence.reentry_fields!==undefined&&!validProductionReentryFields(evidence.reentry_fields))
      ||(evidence.manual_design_reentry===false
        &&Array.isArray(evidence.reentry_fields)&&evidence.reentry_fields.length!==0)
      ||typeof evidence.operator!=="string"||evidence.operator.trim().length<2||evidence.operator.trim().length>120
      ||typeof evidence.evidence_reference!=="string"||evidence.evidence_reference.trim().length<3
      ||evidence.evidence_reference.trim().length>240) return false;
    evidenceIds.add(evidenceId);
  }
  return true;
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
  reentry_fields?:unknown;
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
    const timestamp=typeof order.created_at==="string"?parseProductionEvidenceTimestamp(order.created_at):Number.NaN;
    const deliveredAt=order.delivered_at;
    const deliveryTimestamp=deliveredAt===undefined
      ?timestamp
      :typeof deliveredAt==="string"?parseProductionEvidenceTimestamp(deliveredAt):Number.NaN;
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
    .sort((a,b)=>parseProductionEvidenceTimestamp(a.delivered_at||a.created_at)-parseProductionEvidenceTimestamp(b.delivered_at||b.created_at));
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
      && (row.reentry_fields===undefined||validProductionReentryFields(row.reentry_fields))
      && (row.manual_design_reentry===true
        || row.reentry_fields===undefined
        || (Array.isArray(row.reentry_fields)&&row.reentry_fields.length===0))
      && typeof row.operator==="string"&&row.operator.trim().length>=2&&row.operator.trim().length<=120
      && typeof row.evidence_reference==="string"&&row.evidence_reference.trim().length>=3&&row.evidence_reference.trim().length<=240
      && typeof row.created_at==="string"&&Number.isFinite(parseProductionEvidenceTimestamp(row.created_at))
      && (!order.delivered_at||parseProductionEvidenceTimestamp(row.created_at)>=parseProductionEvidenceTimestamp(order.delivered_at))
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
