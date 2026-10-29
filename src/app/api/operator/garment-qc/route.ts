import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { normalizeVaultId } from "@/lib/vault-id";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeFinishedGarmentQcDraft } from "@/lib/designer/finished-garment-qc";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { verifiedOperatorProductionCreateId } from "@/lib/designer/operator-production-receipt";

export const runtime="nodejs";

function respond(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});
}

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
    // Remote error bodies are untrusted and need not be buffered or reflected.
    throw new Error("Finished-garment QC request failed ("+response.status+").");
  }
  // A forged/oversized upstream reply cannot exhaust an operator session or
  // be promoted to a positive inspection receipt. A list has a larger budget.
  return await readBoundedJsonResponse(response,name.endsWith("_list")?4 * 1024 * 1024:4 * 1024) as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,orders:[],inspections:[]});
  try{
    const [orders,inspections]=await Promise.all([
      rpc<unknown[]>("production_order_list",{p_limit:150}),
      rpc<unknown[]>("finished_garment_qc_list",{p_limit:250}),
    ]);
    if(!Array.isArray(orders)||!Array.isArray(inspections)) throw new Error("Malformed production QC list receipts.");
    return NextResponse.json({configured:true,orders,inspections},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/garment-qc]",error);
    return NextResponse.json({error:"Finished-garment QC records could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  try{
    const body=await readSecureJsonObject(request,16384);
    if(body.action!=="record") return respond({error:"Unsupported QC action."},400);
    const orderId=normalizeVaultId(body.orderId);
    if(!orderId) return respond({error:"Valid production order ID is required."},400);
    let draft;
    try{draft=normalizeFinishedGarmentQcDraft(body);}
    catch(error){return respond({error:error instanceof Error?error.message:"Invalid finished-garment QC evidence."},400);}
    const receipt=await rpc<unknown>("finished_garment_qc_record_v2",{
      p_order_id:orderId,
      p_decision:draft.decision,
      p_checks:draft.checks,
      p_defects:draft.defects,
      p_note:draft.note,
      p_inspector:draft.inspector,
      p_inspection_reference:draft.inspectionReference,
    });
    const inspectionId=verifiedOperatorProductionCreateId(receipt);
    if(!inspectionId) return respond({error:"Finished-garment QC backend did not confirm an inspection ID."},409);
    return respond({inspectionId});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/garment-qc]",error);
    return respond({error:"Finished-garment QC could not be recorded."},409);
  }
}
