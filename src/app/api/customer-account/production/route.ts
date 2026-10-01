import { NextResponse } from "next/server";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

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
    const detail=(await response.text()).slice(0,240);
    throw new Error(`Customer production request failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

export async function GET(request:Request){
  try{
    const customer=await getCustomerIdentity(request);
    if(!customer) return NextResponse.json({error:"Customer sign-in is required."},{status:401});

    const [quotes,orders]=await Promise.all([
      rpc("production_quote_list_owned",{p_owner_user_id:customer.id,p_limit:100}),
      rpc("production_order_list_owned",{p_owner_user_id:customer.id,p_limit:100}),
    ]);

    return NextResponse.json(
      {quotes,orders},
      {headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"}},
    );
  }catch(error){
    console.error("[customer-account/production]",error);
    return NextResponse.json({error:"Production status is temporarily unavailable."},{status:503});
  }
}
