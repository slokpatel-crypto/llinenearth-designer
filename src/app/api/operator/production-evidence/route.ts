import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import { operatorEvidenceMutationRequestError } from "@/lib/designer/operator-evidence-mutation-safety";
import { verifyProductionDeliveryOrders, verifyProductionDeliveryAudits } from "@/lib/designer/production-delivery-ledger-validation";
import { PRODUCTION_DELIVERY_LEDGER_RPC_LIMIT, deliveryLedgerSnapshotIsExhaustive } from "@/lib/designer/production-delivery-snapshot-completeness";
import { requireOperatorCreatedId } from "@/lib/designer/operator-created-id";
import { normalizeProductionDeliveryEvidence } from "@/lib/designer/production-delivery-evidence";

export const runtime="nodejs";
const MAX_INCOMING_EVIDENCE_BYTES=32_768;
const MAX_UPSTREAM_EVIDENCE_BYTES=4_194_304;
function privateEvidenceJson(body:unknown,init?:ResponseInit){
  const response=NextResponse.json(body,init);
  response.headers.set("cache-control","private, no-store");
  return response;
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
  // Never read, echo or log private PostgREST SQL/source details.
  if(!response.ok) throw new Error("Production evidence upstream unavailable.");
  const mime=response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if(mime!=="application/json") throw new Error("Invalid production evidence response.");
  return await readBoundedJsonResponse(response,MAX_UPSTREAM_EVIDENCE_BYTES) as T;
}

export async function GET(){
  if(!await authorized()) return privateEvidenceJson({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return privateEvidenceJson({configured:false,orders:[],evidence:[]});
  try{
    const [orders,evidence]=await Promise.all([
      rpc<unknown[]>("production_order_list",{p_limit:PRODUCTION_DELIVERY_LEDGER_RPC_LIMIT}),
      rpc<unknown[]>("production_delivery_evidence_list",{p_limit:PRODUCTION_DELIVERY_LEDGER_RPC_LIMIT}),
    ]);
    // Reject malformed upstream lists as an invalid response (503) before
    // evaluating whether otherwise valid historical rows are capped (409).
    const verifiedOrders=verifyProductionDeliveryOrders(orders);
    const verifiedEvidence=verifyProductionDeliveryAudits(evidence);
    // Opposite sort directions in the two v1 RPCs make a capped snapshot
    // insufficient to certify the *first ten* actual delivered orders.
    if(!deliveryLedgerSnapshotIsExhaustive(verifiedOrders,verifiedEvidence))
      return privateEvidenceJson({error:"Delivery ledger is incomplete; full historical pagination is required before acceptance."},{status:409});
    return privateEvidenceJson({
      configured:true,
      orders:verifiedOrders,
      evidence:verifiedEvidence,
    });
  }catch(error){
    console.error("[operator/production-evidence] request failed (details redacted).");
    return privateEvidenceJson({error:"Production completion evidence could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return privateEvidenceJson({error:"Unauthorized."},{status:401});
  const unsafe=operatorEvidenceMutationRequestError(request);
  if(unsafe)return privateEvidenceJson({error:unsafe.error},{status:unsafe.status});
  let orderId:string;
  let draft:ReturnType<typeof normalizeProductionDeliveryEvidence>;
  try{
    const input=await readBoundedJsonResponse(request,MAX_INCOMING_EVIDENCE_BYTES);
    if(!input||typeof input!=="object"||Array.isArray(input))
      return privateEvidenceJson({error:"Valid production evidence JSON object required."},{status:400});
    const body=input as Record<string,unknown>;
    if(String(body.action||"")!=="record")
      return privateEvidenceJson({error:"Unsupported evidence action."},{status:400});
    orderId=String(body.orderId||"").trim();
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(orderId))
      return privateEvidenceJson({error:"Valid delivered order ID is required."},{status:400});
    draft=normalizeProductionDeliveryEvidence(body);
  }catch{
    return privateEvidenceJson({error:"Invalid production delivery evidence fields or JSON."},{status:400});
  }
  try{
    const evidenceId=await rpc<unknown>("production_delivery_evidence_record_v2",{
      p_order_id:orderId,
      p_manual_design_reentry:draft.manualDesignReentry,
      p_reentry_fields:draft.reentryFields,
      p_note:draft.note,
      p_operator:draft.operator,
      p_evidence_reference:draft.evidenceReference,
    });
    return privateEvidenceJson({evidenceId:requireOperatorCreatedId(evidenceId)});
  }catch{
    console.error("[operator/production-evidence] request failed (details redacted).");
    return privateEvidenceJson({error:"Production evidence could not be recorded or verified."},{status:503});
  }
}
