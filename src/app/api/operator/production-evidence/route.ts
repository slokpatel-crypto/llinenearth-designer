import { normalizeVaultId } from "@/lib/vault-id";
import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { normalizeProductionDeliveryEvidence } from "@/lib/designer/production-delivery-evidence";
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
  if(!config) throw new Error("Production evidence backend is not configured.");
  const response=await fetch(config.url.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    // Never buffer or reflect untrusted upstream error bodies in audit responses.
    throw new Error("Production evidence request failed ("+response.status+").");
  }
  const maxBytes=name.endsWith("_list")||name==="production_first_ten_delivery_audit"
    ?4 * 1024 * 1024:4 * 1024;
  return await readBoundedJsonResponse(response,maxBytes) as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,orders:[],evidence:[]});
  try{
    const [orders,evidence]=await Promise.all([
      rpc<unknown[]>("production_order_list",{p_limit:500}),
      rpc<unknown[]>("production_delivery_evidence_list",{p_limit:500}),
    ]);
    if(!Array.isArray(orders)||!Array.isArray(evidence)) throw new Error("Malformed delivery evidence list receipts.");
    // The browsing RPCs have 500-row caps and cannot certify the earliest ten
    // lifetime deliveries after a shop accumulates larger order history.
    // Keep browsing/recording functional before this migration is installed,
    // but never return a release-capable audit basis without the new DB RPC.
    let firstTenBasis:unknown=null;
    try {
      firstTenBasis=await rpc<unknown>("production_first_ten_delivery_audit",{});
    } catch {
      // The first-ten evidence gate remains blocked until the migration exists.
    }
    return NextResponse.json({configured:true,orders,evidence,firstTenBasis},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return NextResponse.json({error:error.message},{status:413});
    if(error instanceof SecureJsonBodyInvalid) return NextResponse.json({error:error.message},{status:400});
    console.error("[operator/production-evidence]",error);
    return NextResponse.json({error:"Production completion evidence could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  try{
    const body=await readSecureJsonObject(request,16384);
    if(body.action!=="record") return respond({error:"Unsupported evidence action."},400);
    const orderId=normalizeVaultId(body.orderId);
    if(!orderId) return respond({error:"Valid delivered order ID is required."},400);
    let draft;
    try{draft=normalizeProductionDeliveryEvidence(body);}
    catch(error){return respond({error:error instanceof Error?error.message:"Invalid production completion evidence."},400);}
    const receipt=await rpc<unknown>("production_delivery_evidence_record_v2",{
      p_order_id:orderId,
      p_manual_design_reentry:draft.manualDesignReentry,
      p_reentry_fields:draft.reentryFields,
      p_note:draft.note,
      p_operator:draft.operator,
      p_evidence_reference:draft.evidenceReference,
    });
    const evidenceId=verifiedOperatorProductionCreateId(receipt);
    if(!evidenceId) return respond({error:"Production delivery evidence backend did not confirm an evidence ID."},409);
    return respond({evidenceId});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/production-evidence]",error);
    return respond({error:"Production completion evidence could not be recorded."},409);
  }
}
