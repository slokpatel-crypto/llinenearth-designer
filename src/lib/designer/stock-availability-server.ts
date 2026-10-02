import "server-only";

import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { applyVerifiedStockAvailability, type VerifiedStockSnapshotRow } from "@/lib/designer/stock-availability";
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
    const rows=await response.json() as Array<Record<string,unknown>>;
    return rows.map((row)=>({
      fabric_id:String(row.fabric_id||""),
      available_metres:Number(row.available_metres),
      provenance_ready:row.provenance_ready===true,
    }));
  }catch(error){
    console.error("[designer/stock-availability] snapshot failed",error);
    return [];
  }
}

export async function applyLiveVerifiedStockAvailability(stock:FabricColorway[]){
  const rows=await loadVerifiedStockSnapshot(stock.map((fabric)=>fabric.id));
  return applyVerifiedStockAvailability(stock,rows);
}
