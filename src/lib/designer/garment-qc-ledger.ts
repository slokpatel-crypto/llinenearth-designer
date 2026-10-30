import { FINISHED_GARMENT_QC_CHECKS } from "./finished-garment-qc.ts";
import { verifiedOperatorProductionCreateId } from "./operator-production-receipt.ts";
import { parseProductionEvidenceTimestamp } from "./production-delivery-evidence.ts";
import { validProductionQcOrderRows } from "./production-desk-ledger.ts";

function record(value:unknown):value is Record<string,unknown>{
  return value!==null&&typeof value==="object"&&!Array.isArray(value);
}

/** The dedicated physical QC screen must not trust 200 JSON arrays of arbitrary
 * rows. Keep legacy blank inspector/reference histories visible but unverified;
 * do not mistake them for signed physical approval. The two SQL lists are
 * independently capped, so older inspections may refer to orders off-page. */
export function validGarmentQcDeskResponse(value:unknown):value is {
  configured:boolean;orders:Record<string,unknown>[];inspections:Record<string,unknown>[];
}{
  if(!record(value)||typeof value.configured!=="boolean"
    ||!validProductionQcOrderRows(value.orders)
    ||!Array.isArray(value.inspections)||value.inspections.length>250) return false;
  if(!value.configured) return value.orders.length===0&&value.inspections.length===0;
  const orders=new Map<string,Record<string,unknown>>();
  for(const order of value.orders){
    orders.set((order.order_id as string).toLowerCase(),order);
  }
  const inspectionIds=new Set<string>();
  let previousTime=Number.POSITIVE_INFINITY;
  for(const row of value.inspections){
    if(!record(row)) return false;
    const id=verifiedOperatorProductionCreateId(row.inspection_id);
    const orderId=verifiedOperatorProductionCreateId(row.order_id);
    const inspectedAt=parseProductionEvidenceTimestamp(row.created_at);
    if(!id||!orderId||inspectionIds.has(id.toLowerCase())
      ||!Number.isFinite(inspectedAt)||inspectedAt>previousTime
      ||typeof row.revision_id!=="string"||row.revision_id.length<12||row.revision_id.length>220
      ||row.revision_id!==row.revision_id.trim()
      ||typeof row.recipe_hash!=="string"||!/^[a-f0-9]{64}$/i.test(row.recipe_hash)
      ||(row.decision!=="approved"&&row.decision!=="rework")
      ||typeof row.note!=="string"||row.note.length>1200
      ||typeof row.inspector!=="string"||row.inspector.length>120
      ||(row.inspection_reference!==undefined&&row.inspection_reference!==null
        &&(typeof row.inspection_reference!=="string"||row.inspection_reference.length>240))
      ||!record(row.checks)||Object.keys(row.checks).length>30
      ||!Object.values(row.checks).every(check=>typeof check==="boolean")
      ||!Array.isArray(row.defects)||row.defects.length>100
      ||!row.defects.every((defect:unknown)=>typeof defect==="string"&&defect.length<=120)) return false;
    // SQL-approved QC must contain all six actual physical checks. Extra
    // historical check/defect labels remain display-only, not new approvals.
    const verifiedChecks=row.checks as Record<string,boolean>; // narrowed above before callback
    if(row.decision==="approved"&&FINISHED_GARMENT_QC_CHECKS.some(check=>verifiedChecks[check.id]!==true))
      return false;
    if(row.decision==="rework"&&row.defects.length===0&&row.note.trim().length<3)
      return false;
    const order=orders.get(orderId.toLowerCase());
    if(order&&(order.revision_id!==row.revision_id
      ||String(order.recipe_hash).toLowerCase()!==row.recipe_hash.toLowerCase()
      ||inspectedAt<parseProductionEvidenceTimestamp(order.created_at))) return false;
    inspectionIds.add(id.toLowerCase());
    previousTime=inspectedAt;
  }
  return true;
}
