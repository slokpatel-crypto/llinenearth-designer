import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { FABRIC_STOCK } from "@/lib/fabric-stock";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeManualStockEvent, normalizeStockConsumption, normalizeStockRelease, normalizeStockReservation } from "@/lib/designer/stock-ledger";

export const runtime="nodejs";

const KNOWN_CATALOGUE_FABRICS=new Set(FABRIC_STOCK.map((fabric)=>fabric.id));

/** No invented catalogue codes may enter the physical roll ledger. */
export function assertCurrentFabricId(id:string){
  if(!KNOWN_CATALOGUE_FABRICS.has(id))
    throw new Error("Selected fabric is not in the published Linen Earth supplier catalogue.");
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
  // Reject cross-site browser writes and non-JSON body submissions before
  // the service-role Supabase RPC. The session cookie alone is not CSRF proof.
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)
    return NextResponse.json({error:"Cross-site stock changes are not allowed."},{status:403});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
    return NextResponse.json({error:"Stock mutations require JSON."},{status:415});
  const bodySize=Number(request.headers.get("content-length")||0);
  if(Number.isFinite(bodySize)&&bodySize>24_000)
    return NextResponse.json({error:"Stock mutation payload is too large."},{status:413});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"");
    if(action==="record"){
      const draft=normalizeManualStockEvent(body);
      assertCurrentFabricId(draft.fabricId);
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
      assertCurrentFabricId(draft.fabricId);
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
      const draft=normalizeStockRelease(body);
      const released=await rpc<boolean>("fabric_stock_release_v2",{
        p_reservation_id:draft.reservationId,
        p_note:draft.note,
        p_released_by:draft.releasedBy,
        p_source_reference:draft.sourceReference,
      });
      return NextResponse.json({released:Boolean(released)});
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
      return NextResponse.json({consumed:Boolean(consumed)});
    }
    return NextResponse.json({error:"Unsupported stock action."},{status:400});
  }catch(error){
    console.error("[operator/stock]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Stock operation failed."},{status:409});
  }
}
