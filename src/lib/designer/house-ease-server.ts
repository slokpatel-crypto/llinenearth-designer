import "server-only";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { approvedHouseEaseModelFromRow, type ApprovedHouseEaseModel } from "@/lib/designer/ease-calibration";

export async function loadApprovedHouseEaseModel():Promise<ApprovedHouseEaseModel|null>{
  const config=getSupabaseAdminConfig();
  if(!config) return null;
  try{
    const response=await fetch(`${config.url}/rest/v1/rpc/house_ease_model_list`,{
      method:"POST",
      headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
      body:JSON.stringify({p_limit:100}),
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok) return null;
    const rows=await response.json() as unknown[];
    for(const row of rows){
      const model=approvedHouseEaseModelFromRow(row);
      if(model) return model;
    }
    return null;
  }catch{
    return null;
  }
}
