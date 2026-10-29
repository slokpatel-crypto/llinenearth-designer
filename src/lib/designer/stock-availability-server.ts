import "server-only";

import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { applyVerifiedStockAvailability, stockSnapshotHasConfirmedProvenance, type VerifiedStockSnapshotRow } from "@/lib/designer/stock-availability";
import type { FabricColorway } from "@/lib/fabric-stock";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";

export async function loadVerifiedStockSnapshot(fabricIds:string[]):Promise<VerifiedStockSnapshotRow[]>{
  const config=getSupabaseAdminConfig();
  const ids=[...new Set(fabricIds.map((id)=>String(id||"").trim()).filter(Boolean))].slice(0,500);
  if(!config||!ids.length) return [];
  try{
    const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/rpc/fabric_stock_snapshot_v2",{
      method:"POST",
      headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
      body:JSON.stringify({p_fabric_ids:ids}),
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok){
      console.error("[designer/stock-availability] snapshot failed",response.status);
      return [];
    }
    const rows=await readBoundedJsonResponse(response,1024 * 1024);
    if(!Array.isArray(rows)) return [];
    return rows.map((row)=>{
      if(!row||typeof row!=="object"||Array.isArray(row)) throw new Error("Invalid stock snapshot row");
      const record=row as Record<string,unknown>;
      return ({
      // Preserve the RPC type; never turn ["fabric-id"] or other JSON
      // values into a convincing exact inventory identifier.
      fabric_id:typeof record.fabric_id==="string"?record.fabric_id:"",
      // Never convert a missing/null RPC value into the number zero: that
      // would falsely label an absent measurement as verified zero stock.
      available_metres:typeof record.available_metres==="number"||typeof record.available_metres==="string"
        ?record.available_metres:NaN,
      provenance_ready:stockSnapshotHasConfirmedProvenance(record),
    });
    });
  }catch(error){
    console.error("[designer/stock-availability] snapshot failed",error);
    return [];
  }
}

export async function applyLiveVerifiedStockAvailability(stock:FabricColorway[]){
  const rows=await loadVerifiedStockSnapshot(stock.map((fabric)=>fabric.id));
  return applyVerifiedStockAvailability(stock,rows);
}
