import "server-only";

import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { applyVerifiedStockAvailability, type VerifiedStockSnapshotRow } from "@/lib/designer/stock-availability";
import { normalizeStockSnapshotTransport } from "@/lib/designer/stock-snapshot-transport";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import type { FabricColorway } from "@/lib/fabric-stock";

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
    const mime=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if(mime!=="application/json") throw new Error("Unexpected stock snapshot media type.");
    // A successful upstream status is not proof of bounded, well-formed
    // ledger data. Parse no more than 2 MiB and verify the requested SKU scope.
    const data=await readBoundedJsonResponse(response,2_097_152);
    return normalizeStockSnapshotTransport(data,ids);
  }catch{
    console.error("[designer/stock-availability] snapshot unavailable (details redacted).");
    return [];
  }
}

export async function applyLiveVerifiedStockAvailability(stock:FabricColorway[]){
  const rows=await loadVerifiedStockSnapshot(stock.map((fabric)=>fabric.id));
  return applyVerifiedStockAvailability(stock,rows);
}
