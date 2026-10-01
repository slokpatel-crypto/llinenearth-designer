import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeFinishedGarmentQcDraft } from "@/lib/designer/finished-garment-qc";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Finished-garment QC backend is not configured.");
  const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).replace(/\s+/g," ").slice(0,260);
    throw new Error("Finished-garment QC request failed ("+response.status+"): "+detail);
  }
  return await response.json() as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,orders:[],inspections:[]});
  try{
    const [orders,inspections]=await Promise.all([
      rpc<unknown[]>("production_order_list",{p_limit:150}),
      rpc<unknown[]>("finished_garment_qc_list",{p_limit:250}),
    ]);
    return NextResponse.json({configured:true,orders,inspections},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/garment-qc]",error);
    return NextResponse.json({error:"Finished-garment QC records could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    if(String(body.action||"")!=="record") return NextResponse.json({error:"Unsupported QC action."},{status:400});
    const orderId=String(body.orderId||"").trim();
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(orderId)) return NextResponse.json({error:"Valid production order ID is required."},{status:400});
    const draft=normalizeFinishedGarmentQcDraft(body);
    const inspectionId=await rpc<string>("finished_garment_qc_record",{
      p_order_id:orderId,
      p_decision:draft.decision,
      p_checks:draft.checks,
      p_defects:draft.defects,
      p_note:draft.note,
      p_inspector:draft.inspector,
    });
    return NextResponse.json({inspectionId});
  }catch(error){
    console.error("[operator/garment-qc]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Finished-garment QC could not be recorded."},{status:409});
  }
}
