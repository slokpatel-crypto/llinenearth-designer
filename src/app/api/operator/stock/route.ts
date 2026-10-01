import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeManualStockEvent, normalizeStockReservation } from "@/lib/designer/stock-ledger";

export const runtime="nodejs";

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
    const detail=(await response.text()).slice(0,300);
    throw new Error(`Stock operation failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,stock:[]});
  try{
    const stock=await rpc<Array<{
      fabric_id:string;physical_metres:number;reserved_metres:number;available_metres:number;
      manual_event_count:number;provenance_event_count:number;legacy_unverified_event_count:number;
      provenance_ready:boolean;last_event_at:string|null;
    }>>("fabric_stock_snapshot_v2",{p_fabric_ids:null});
    return NextResponse.json({configured:true,stock},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/stock]",error);
    return NextResponse.json({error:"Stock ledger could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"");
    if(action==="record"){
      const draft=normalizeManualStockEvent(body);
      const eventId=await rpc<string>("fabric_stock_record_v2",{
        p_fabric_id:draft.fabricId,
        p_event_type:draft.eventType,
        p_quantity_metres:draft.quantityMetres,
        p_note:draft.note,
        p_recorded_by:draft.recordedBy,
        p_source_reference:draft.sourceReference,
      });
      return NextResponse.json({eventId});
    }
    if(action==="reserve"){
      const draft=normalizeStockReservation(body);
      const reservationId=await rpc<string>("fabric_stock_reserve_v2",{
        p_fabric_id:draft.fabricId,
        p_quantity_metres:draft.quantityMetres,
        p_revision_id:draft.revisionId,
        p_request_key:draft.requestKey,
        p_requested_by:draft.requestedBy,
        p_source_reference:draft.sourceReference,
      });
      return NextResponse.json({reservationId});
    }
    if(action==="release"){
      const reservationId=String(body.reservationId||"").trim();
      const note=String(body.note||"").trim().slice(0,600);
      const released=await rpc<boolean>("fabric_stock_release",{p_reservation_id:reservationId,p_note:note});
      return NextResponse.json({released:Boolean(released)});
    }
    if(action==="consume"){
      const reservationId=String(body.reservationId||"").trim();
      const actual=Number(body.actualMetres);
      const note=String(body.note||"").trim().slice(0,600);
      if(!Number.isFinite(actual)||actual<=0) return NextResponse.json({error:"Invalid actual usage."},{status:400});
      const consumed=await rpc<boolean>("fabric_stock_consume_reservation",{
        p_reservation_id:reservationId,p_actual_metres:actual,p_note:note,
      });
      return NextResponse.json({consumed:Boolean(consumed)});
    }
    return NextResponse.json({error:"Unsupported stock action."},{status:400});
  }catch(error){
    console.error("[operator/stock]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Stock operation failed."},{status:409});
  }
}
