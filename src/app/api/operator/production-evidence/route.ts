import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeProductionDeliveryEvidence } from "@/lib/designer/production-delivery-evidence";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Production evidence backend is not configured.");
  const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).replace(/\s+/g," ").slice(0,260);
    throw new Error("Production evidence request failed ("+response.status+"): "+detail);
  }
  return await response.json() as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,orders:[],evidence:[]});
  try{
    const [orders,evidence]=await Promise.all([
      rpc<unknown[]>("production_order_list",{p_limit:500}),
      rpc<unknown[]>("production_delivery_evidence_list",{p_limit:500}),
    ]);
    return NextResponse.json({configured:true,orders,evidence},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/production-evidence]",error);
    return NextResponse.json({error:"Production completion evidence could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    if(String(body.action||"")!=="record") return NextResponse.json({error:"Unsupported evidence action."},{status:400});
    const orderId=String(body.orderId||"").trim();
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(orderId)) return NextResponse.json({error:"Valid delivered order ID is required."},{status:400});
    const draft=normalizeProductionDeliveryEvidence(body);
    const evidenceId=await rpc<string>("production_delivery_evidence_record",{
      p_order_id:orderId,
      p_manual_design_reentry:draft.manualDesignReentry,
      p_reentry_fields:draft.reentryFields,
      p_note:draft.note,
      p_operator:draft.operator,
    });
    return NextResponse.json({evidenceId});
  }catch(error){
    console.error("[operator/production-evidence]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Production completion evidence could not be recorded."},{status:409});
  }
}
