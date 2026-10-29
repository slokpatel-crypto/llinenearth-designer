import { NextResponse } from "next/server";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { hasCompleteCustomerProductionHistory } from "@/lib/designer/customer-production-history";
import { normalizeCustomerProductionOutcome, parseCustomerProductionRecordId } from "@/lib/designer/customer-production-outcomes";
import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";

export const runtime="nodejs";

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
  if(!response.ok){
    throw new Error(`Customer production request failed (${response.status}).`);
  }
  // Customer-owned order histories have a finite list budget; mutations remain small.
  const maxBytes=name.includes("_list_owned")?4 * 1024 * 1024:256 * 1024;
  return await readBoundedJsonResponse(response,maxBytes) as T;
}

function respond(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"}});
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

    // A malformed owner-scoped RPC response is not an empty production
    // history. Never return a success-shaped customer status snapshot when
    // any of its four independently fetched ledgers is unverified.
    if(!hasCompleteCustomerProductionHistory(quotes,orders,orderEvents,outcomes)){
      throw new Error("Malformed customer production history list receipts.");
    }

    return NextResponse.json(
      {quotes,orders,orderEvents,outcomes},
      {headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"}},
    );
  }catch(error){
    console.error("[customer-account/production]",error);
    return NextResponse.json({error:"Production status is temporarily unavailable."},{status:503});
  }
}


export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  try{
    const body=await readSecureJsonObject(request,16384);
    if(body.action==="accept_quote"){
      const quoteId=parseCustomerProductionRecordId(body.quoteId);
      if(!quoteId) return respond({error:"Valid quote ID is required."},400);
      const customer=await getCustomerIdentity(request);
      if(!customer) return respond({error:"Customer sign-in is required."},401);

      const accepted=await rpc<unknown>("production_quote_accept_owned",{
        p_quote_id:quoteId,
        p_owner_user_id:customer.id,
      });
      if(accepted===false) return respond({error:"Quote is unavailable."},404);
      if(accepted!==true) return respond({error:"Quote acceptance could not be confirmed."},409);
      return respond({accepted:true});
    }

    if(body.action==="record_outcome"){
      const orderId=parseCustomerProductionRecordId(body.orderId);
      if(!orderId) return respond({error:"Valid order ID is required."},400);
      let outcome;
      try{outcome=normalizeCustomerProductionOutcome(body);}
      catch(error){
        return respond({error:error instanceof Error?error.message:"Invalid post-delivery feedback."},400);
      }
      const customer=await getCustomerIdentity(request);
      if(!customer) return respond({error:"Customer sign-in is required."},401);
      const outcomeId=await rpc<unknown>("production_customer_outcome_record",{
        p_order_id:orderId,
        p_owner_user_id:customer.id,
        p_overall_rating:outcome.overallRating,
        p_fit_result:outcome.fitResult,
        p_worn_confirmed:outcome.wornConfirmed,
        p_note:outcome.note,
      });
      const confirmedId=parseCustomerProductionRecordId(outcomeId);
      if(!confirmedId) return respond({error:"Feedback record could not be confirmed."},409);
      return respond({recorded:true,outcomeId:confirmedId});
    }

    return respond({error:"Unsupported customer production action."},400);
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[customer-account/production]",error);
    return respond({error:"Customer production action could not be completed."},409);
  }
}
