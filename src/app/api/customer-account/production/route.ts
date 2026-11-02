import { NextResponse } from "next/server";
import { secureJsonRequestError, readSecureJsonObject, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeCustomerProductionOutcome } from "@/lib/designer/customer-production-outcomes";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { requireOwnedProductionRows, requireCustomerOutcomeId } from "@/lib/designer/customer-production-rpc-contract";

export const runtime="nodejs";
const MAX_CUSTOMER_PRODUCTION_REQUEST_BYTES=16_384;
// A full 100-300 row account history may contain line items, but upstream
// service-role RPC data must never parse unbounded network responses.
const MAX_CUSTOMER_PRODUCTION_RPC_RESPONSE_BYTES=4_194_304;
const privateJson=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"}});

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Production backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok||
    response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json"){
    // Never propagate upstream payloads that could contain customer details.
    throw new Error("Customer production upstream request failed.");
  }
  return await readBoundedJsonResponse(response,MAX_CUSTOMER_PRODUCTION_RPC_RESPONSE_BYTES) as T;
}

export async function GET(request:Request){
  try{
    const customer=await getCustomerIdentity(request);
    if(!customer) return NextResponse.json({error:"Customer sign-in is required."},{status:401});

    const [quotes,orders,orderEvents,outcomes]=await Promise.all([
      rpc("production_quote_list_owned_v2",{p_owner_user_id:customer.id,p_limit:100}),
      rpc("production_order_list_owned",{p_owner_user_id:customer.id,p_limit:100}),
      rpc("production_order_event_list_owned",{p_owner_user_id:customer.id,p_limit:300}),
      rpc("production_customer_outcome_list_owned",{p_owner_user_id:customer.id,p_limit:100}),
    ]);

    return privateJson({
      quotes:requireOwnedProductionRows(quotes,100),
      orders:requireOwnedProductionRows(orders,100),
      orderEvents:requireOwnedProductionRows(orderEvents,300),
      outcomes:requireOwnedProductionRows(outcomes,100),
    });
  }catch(error){
    console.error("[customer-account/production] request failed (details redacted).");
    return NextResponse.json({error:"Production status is temporarily unavailable."},{status:503});
  }
}


export async function POST(request:Request){
  const requestError=secureJsonRequestError(request,MAX_CUSTOMER_PRODUCTION_REQUEST_BYTES);
  if(requestError)return privateJson({error:requestError.error},requestError.status);
  try{
    const customer=await getCustomerIdentity(request);
    if(!customer) return privateJson({error:"Customer sign-in is required."},401);

    const body=await readSecureJsonObject(request,MAX_CUSTOMER_PRODUCTION_REQUEST_BYTES);
    const action=String(body.action||"");
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if(action==="accept_quote"){
      const quoteId=String(body.quoteId||"").trim();
      if(!uuid.test(quoteId)) return NextResponse.json({error:"Valid quote ID is required."},{status:400});

      const accepted=await rpc<unknown>("production_quote_accept_owned",{
        p_quote_id:quoteId,
        p_owner_user_id:customer.id,
      });
      if(accepted===false) return privateJson({error:"Quote is unavailable."},404);
      // PostgREST JSON must be a literal boolean; do not coerce truthy "false".
      if(accepted!==true)throw new Error("Invalid quote acceptance acknowledgment.");

      return NextResponse.json(
        {accepted:true},
        {headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"}},
      );
    }

    if(action==="record_outcome"){
      const orderId=String(body.orderId||"").trim();
      if(!uuid.test(orderId)) return NextResponse.json({error:"Valid order ID is required."},{status:400});
      let outcome;
      try{outcome=normalizeCustomerProductionOutcome(body);}
      catch(error){
        return NextResponse.json({error:error instanceof Error?error.message:"Invalid post-delivery feedback."},{status:400});
      }
      const outcomeAck=await rpc<unknown>("production_customer_outcome_record",{
        p_order_id:orderId,
        p_owner_user_id:customer.id,
        p_overall_rating:outcome.overallRating,
        p_fit_result:outcome.fitResult,
        p_worn_confirmed:outcome.wornConfirmed,
        p_note:outcome.note,
      });
      const outcomeId=requireCustomerOutcomeId(outcomeAck);
      return privateJson({recorded:true,outcomeId});
    }

    return NextResponse.json({error:"Unsupported customer production action."},{status:400});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge)return privateJson({error:"Request payload is too large."},413);
    if(error instanceof SecureJsonBodyInvalid)return privateJson({error:"Invalid JSON request."},400);
    console.error("[customer-account/production] action failed (details redacted).");
    return privateJson({error:"Customer production action could not be completed."},409);
  }
}
