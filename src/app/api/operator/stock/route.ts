import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { assertCurrentFabricId, readBoundedStockMutationJson, StockMutationPayloadTooLarge, stockMutationRequestError } from "@/lib/designer/operator-stock-safety";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeManualStockEvent, normalizeStockConsumption, normalizeStockRelease, normalizeStockReservation } from "@/lib/designer/stock-ledger";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { requireStockCloseAck, requireStockCreatedId, requireStockSnapshotRows } from "@/lib/designer/operator-stock-response";
import { stockWritesEnabled } from "@/lib/designer/stock-write-rollout";

export const runtime="nodejs";
function stockPrivateJson(body:unknown,init:{status?:number;headers?:Record<string,string>}={}){
  return NextResponse.json(body,{...init,
    headers:{...init.headers,"cache-control":"private, no-store"}});
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Stock backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  // Never read or log arbitrary backend errors: they can contain source
  // references, customer fields and privileged SQL details.
  if(!response.ok) throw new Error("Stock upstream request failed.");
  const mime=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(mime!=="application/json") throw new Error("Invalid stock backend response type.");
  return await readBoundedJsonResponse(response,2_097_152) as T;
}

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}
class StockInputError extends Error {}
function stockInput<T>(validate:()=>T):T{
  try{return validate();}
  catch(error){
    // Local validators emit fixed diagnostic strings, never database payloads.
    throw new StockInputError(error instanceof Error?error.message:"Invalid stock input.");
  }
}

export async function GET(){
  if(!await authorized()) return stockPrivateJson({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return stockPrivateJson({configured:false,writesEnabled:false,stock:[]});
  try{
    const stock=requireStockSnapshotRows(await rpc<unknown>(
      "fabric_stock_snapshot_v2",{p_fabric_ids:null}));
    return stockPrivateJson({configured:true,writesEnabled:stockWritesEnabled(),stock},{headers:{"cache-control":"private, no-store"}});
  }catch{
    console.error("[operator/stock] snapshot unavailable (details redacted).");
    return stockPrivateJson({error:"Stock ledger could not be read."},{
      status:503,headers:{"cache-control":"private, no-store"}});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return stockPrivateJson({error:"Unauthorized."},{status:401});
  // Browser Origin and strict JSON are checked before the privileged RPC.
  const unsafe=stockMutationRequestError(request);
  if(unsafe) return stockPrivateJson({error:unsafe.error},{status:unsafe.status});
  // Keep the inventory ledger read-only until stock v3 is deployed and
  // staging/rollback/physical-source checks are explicitly approved.
  // This is server-side only: no browser flag can enable privileged writes.
  if(!stockWritesEnabled()) return stockPrivateJson({error:"Stock writes are disabled pending rollout approval."},{status:503});
  try{
    const body=await readBoundedStockMutationJson(request);
    const action=String(body.action||"");
    if(action==="record"){
      const draft=stockInput(()=>normalizeManualStockEvent(body));
      stockInput(()=>assertCurrentFabricId(draft.fabricId));
      const eventId=requireStockCreatedId(await rpc<string>("fabric_stock_record_v3",{
        p_fabric_id:draft.fabricId,
        p_event_type:draft.eventType,
        p_quantity_metres:draft.quantityMetres,
        p_note:draft.note,
        p_recorded_by:draft.recordedBy,
        p_source_reference:draft.sourceReference,
        p_request_key:draft.requestKey,
      }));
      return stockPrivateJson({eventId});
    }
    if(action==="reserve"){
      const draft=stockInput(()=>normalizeStockReservation(body));
      stockInput(()=>assertCurrentFabricId(draft.fabricId));
      const reservationId=requireStockCreatedId(await rpc<string>("fabric_stock_reserve_v2",{
        p_fabric_id:draft.fabricId,
        p_quantity_metres:draft.quantityMetres,
        p_revision_id:draft.revisionId,
        p_request_key:draft.requestKey,
        p_requested_by:draft.requestedBy,
        p_source_reference:draft.sourceReference,
      }));
      return stockPrivateJson({reservationId});
    }
    if(action==="release"){
      const draft=stockInput(()=>normalizeStockRelease(body));
      const released=requireStockCloseAck(await rpc<unknown>("fabric_stock_release_v2",{
        p_reservation_id:draft.reservationId,
        p_note:draft.note,
        p_released_by:draft.releasedBy,
        p_source_reference:draft.sourceReference,
      }));
      if(released!==true) return stockPrivateJson({error:"Reservation was not active; no cloth was released."},{status:409});
      return stockPrivateJson({released:true});
    }
    if(action==="consume"){
      const draft=stockInput(()=>normalizeStockConsumption(body));
      const consumed=requireStockCloseAck(await rpc<unknown>("fabric_stock_consume_reservation_v2",{
        p_reservation_id:draft.reservationId,
        p_actual_metres:draft.actualMetres,
        p_note:draft.note,
        p_checked_by:draft.checkedBy,
        p_source_reference:draft.sourceReference,
      }));
      if(consumed!==true) return stockPrivateJson({error:"Reservation was not active; no cloth was consumed."},{status:409});
      return stockPrivateJson({consumed:true});
    }
    return stockPrivateJson({error:"Unsupported stock action."},{status:400});
  }catch(error){
    if(error instanceof StockMutationPayloadTooLarge)
      return stockPrivateJson({error:error.message},{status:413,
        headers:{"cache-control":"private, no-store"}});
    if(error instanceof StockInputError)
      return stockPrivateJson({error:error.message},{status:409,
        headers:{"cache-control":"private, no-store"}});
    // Unexpected backend/transport errors are never echoed to an operator or
    // logged with private supplier/source references.
    console.error("[operator/stock] mutation unavailable (details redacted).");
    return stockPrivateJson({error:"Stock operation could not be verified."},{status:503,
      headers:{"cache-control":"private, no-store"}});
  }
}
