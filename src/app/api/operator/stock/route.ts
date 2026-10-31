import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { assertCurrentFabricId, readBoundedStockMutationJson, StockMutationPayloadTooLarge, stockMutationRequestError, validateOperatorStockSnapshot, verifiedOperatorStockReceiptId } from "@/lib/designer/operator-stock-safety";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { normalizeManualStockEvent, normalizeStockConsumption, normalizeStockRelease, normalizeStockReservation, normalizeStockMutationRequestKey } from "@/lib/designer/stock-ledger";

export const runtime="nodejs";

// Operator-only stock quantities, source evidence and reservation identities
// stay private and uncached even on failed or unauthenticated requests.
function respond(body:unknown,options:{status?:number;headers?:Record<string,string>}={}){
  return NextResponse.json(body,{
    ...options,
    headers:{...options.headers,"cache-control":"private, no-store",pragma:"no-cache"},
  });
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
  if(!response.ok){
    throw new Error(`Stock operation failed (${response.status}).`);
  }
  // Physical stock list receipts can be larger than mutation receipts, but never unbounded.
  const maxBytes=name==="fabric_stock_snapshot_v2"?4 * 1024 * 1024:256 * 1024;
  return await readBoundedJsonResponse(response,maxBytes) as T;
}

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

export async function GET(){
  if(!await authorized()) return respond({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return respond({error:"Stock backend is not configured; availability is unavailable."},{status:503,headers:{"cache-control":"private, no-store"}});
  try{
    const stock=await rpc<Array<{
      fabric_id:string;physical_metres:number;reserved_metres:number;available_metres:number;
      manual_event_count:number;provenance_event_count:number;legacy_unverified_event_count:number;
      provenance_ready:boolean;last_event_at:string|null;
    }>>("fabric_stock_snapshot_v2",{p_fabric_ids:null});
    const verified=validateOperatorStockSnapshot(stock);
    if(!verified) return respond({error:"Stock ledger returned inconsistent rows; do not reserve or cut."},{status:503,headers:{"cache-control":"private, no-store"}});
    return respond({configured:true,stock:verified},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/stock]",error);
    return respond({error:"Stock ledger could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return respond({error:"Unauthorized."},{status:401});
  // Browser Origin and strict JSON are checked before the privileged RPC.
  const unsafe=stockMutationRequestError(request);
  if(unsafe) return respond({error:unsafe.error},{status:unsafe.status});
  try{
    const body=await readBoundedStockMutationJson(request);
    const action=typeof body.action==="string"?body.action:"";
    if(action==="record"){
      const draft=normalizeManualStockEvent(body);
      const requestKey=normalizeStockMutationRequestKey(body.requestKey);
      assertCurrentFabricId(draft.fabricId);
      // Never fall back to non-idempotent v2 on a missing v3 RPC. Until its
      // owner-approved migration is installed, recording fails closed.
      const eventId=verifiedOperatorStockReceiptId(await rpc<unknown>("fabric_stock_record_v3",{
        p_fabric_id:draft.fabricId,
        p_event_type:draft.eventType,
        p_quantity_metres:draft.quantityMetres,
        p_note:draft.note,
        p_recorded_by:draft.recordedBy,
        p_source_reference:draft.sourceReference,
        p_request_key:requestKey,
      }));
      if(!eventId) return respond({error:"Stock backend did not confirm a valid event ID."},{status:502});
      return respond({eventId});
    }
    if(action==="reserve"){
      const draft=normalizeStockReservation(body);
      assertCurrentFabricId(draft.fabricId);
      const reservationId=verifiedOperatorStockReceiptId(await rpc<unknown>("fabric_stock_reserve_v2",{
        p_fabric_id:draft.fabricId,
        p_quantity_metres:draft.quantityMetres,
        p_revision_id:draft.revisionId,
        p_request_key:draft.requestKey,
        p_requested_by:draft.requestedBy,
        p_source_reference:draft.sourceReference,
      }));
      if(!reservationId) return respond({error:"Stock backend did not confirm a valid reservation ID."},{status:502});
      return respond({reservationId});
    }
    if(action==="release"){
      const draft=normalizeStockRelease(body);
      const released=await rpc<boolean>("fabric_stock_release_v2",{
        p_reservation_id:draft.reservationId,
        p_note:draft.note,
        p_released_by:draft.releasedBy,
        p_source_reference:draft.sourceReference,
      });
      if(released!==true) return respond({error:"Reservation was not active; no cloth was released."},{status:409});
      return respond({released:true});
    }
    if(action==="consume"){
      const draft=normalizeStockConsumption(body);
      const consumed=await rpc<boolean>("fabric_stock_consume_reservation_v2",{
        p_reservation_id:draft.reservationId,
        p_actual_metres:draft.actualMetres,
        p_note:draft.note,
        p_checked_by:draft.checkedBy,
        p_source_reference:draft.sourceReference,
      });
      if(consumed!==true) return respond({error:"Reservation was not active; no cloth was consumed."},{status:409});
      return respond({consumed:true});
    }
    return respond({error:"Unsupported stock action."},{status:400});
  }catch(error){
    if(error instanceof StockMutationPayloadTooLarge)
      return respond({error:error.message},{status:413});
    console.error("[operator/stock]",error);
    return respond({error:"Stock operation could not be completed."},{status:409});
  }
}
