import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {OPERATOR_COOKIE,verifyOperatorSession} from "@/lib/operator-session";
import {getSupabaseAdminConfig,supabaseAdminHeaders} from "@/lib/supabase-admin";
import {readBoundedJsonResponse} from "@/lib/designer/bounded-json-response";
import {parseProductionDeliveryEligibility} from "@/lib/designer/production-delivery-eligibility";

export const runtime="nodejs";

function respond(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});
}

/** Deliberately separate from the existing production ledger GET contract:
 * an older un-migrated backend keeps quote/order history usable, but never
 * unlocks a delivered action. This is a read-only UI hint, NOT authorization.
 * Delivery POST revalidates physical QC atomically under the order lock. */
export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value)){
    return respond({error:"Unauthorized."},401);
  }
  const config=getSupabaseAdminConfig();
  if(!config)return respond({error:"Delivery verification unavailable."},503);
  try{
    const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/rpc/production_delivery_eligibility_list",{
      method:"POST",
      headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
      body:JSON.stringify({p_limit:100}),
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok)throw new Error("Delivery eligibility RPC unavailable.");
    const raw=await readBoundedJsonResponse(response,128*1024);
    const eligibility=parseProductionDeliveryEligibility(raw);
    if(!eligibility)throw new Error("Invalid delivery eligibility read receipt.");
    return respond({eligibility});
  }catch{
    // Do not leak backend errors, QC names/references or SQL details.
    return respond({error:"Delivery verification unavailable."},503);
  }
}
