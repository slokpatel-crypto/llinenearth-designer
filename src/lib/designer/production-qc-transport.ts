import { FINISHED_GARMENT_QC_CHECKS, FINISHED_GARMENT_QC_DEFECTS } from "./finished-garment-qc.ts";

const checkIds=new Set<string>(FINISHED_GARMENT_QC_CHECKS.map(item=>item.id));
const defectIds=new Set<string>(FINISHED_GARMENT_QC_DEFECTS.map(item=>item.id));

/** Copy only the fields required for operator QC history/delivery checks.
 * Call AFTER validating the complete original production desk envelope.
 * Historical nullable/missing checks remain unverified, never approved.
 * Unknown nested keys must fail closed rather than be sent to the browser. */
export function safeProductionQcRows(rows:unknown){
  if(!Array.isArray(rows)||rows.length>250) throw new Error("Unverified optional QC ledger.");
  return rows.map((value:unknown)=>{
    if(!value||typeof value!=="object"||Array.isArray(value))
      throw new Error("Malformed optional QC row.");
    const row=value as Record<string,unknown>;
    let checks:Record<string,boolean>|null=null;
    if(row.checks!==undefined&&row.checks!==null){
      if(typeof row.checks!=="object"||Array.isArray(row.checks))
        throw new Error("Malformed optional QC checks.");
      const entries=Object.entries(row.checks);
      if(entries.some(([key,passed])=>!checkIds.has(key)||typeof passed!=="boolean"))
        throw new Error("Unexpected optional QC check.");
      checks=Object.fromEntries(entries) as Record<string,boolean>;
    }
    let defects:string[]|null=null;
    if(row.defects!==undefined&&row.defects!==null){
      if(!Array.isArray(row.defects)||row.defects.some(item=>typeof item!=="string"||!defectIds.has(item)))
        throw new Error("Unexpected optional QC defect.");
      defects=[...row.defects];
    }
    return {
      inspection_id:row.inspection_id,order_id:row.order_id,
      revision_id:row.revision_id,recipe_hash:row.recipe_hash,
      decision:row.decision,checks,defects,note:row.note,
      inspector:row.inspector,inspection_reference:row.inspection_reference,
      created_at:row.created_at,
    };
  });
}
