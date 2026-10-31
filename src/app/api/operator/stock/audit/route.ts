import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {OPERATOR_COOKIE,verifyOperatorSession} from "@/lib/operator-session";
import {getSupabaseAdminConfig,supabaseAdminHeaders} from "@/lib/supabase-admin";
import {readBoundedJsonResponse} from "@/lib/designer/bounded-json-response";
import {verifyOperatorStockSourceAudit} from "@/lib/designer/operator-stock-safety";

export const runtime="nodejs";
export const dynamic="force-dynamic";

function privateResponse(body:unknown,status=200){
  return NextResponse.json(body,{
    status,
    headers:{"cache-control":"private, no-store",pragma:"no-cache"},
  });
}

/** Aggregate-only legacy migration readiness; no raw ledger rows or sources.
 * Does not mutate stock and does not certify genuine supplier paper evidence.
 * Do not use production without explicit operator/owner authorisation. */
export async function GET(){
  const jar=await cookies();
  if(!await verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value))
    return privateResponse({error:"Unauthorized."},401);
  const config=getSupabaseAdminConfig();
  if(!config)
    return privateResponse({error:"Read-only source audit unavailable."},503);
  try{
    const response=await fetch(`${config.url}/rest/v1/rpc/fabric_stock_source_audit_v1`,{
      method:"POST", // PostgREST function invocation; SQL function executes SELECT only.
      headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
      body:"{}",
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok)throw new Error(`Stock audit RPC failed (${response.status})`);
    const audit=verifyOperatorStockSourceAudit(await readBoundedJsonResponse(response,8_192));
    if(!audit) return privateResponse({error:"Stock source audit returned inconsistent counts."},503);
    return privateResponse({audit});
  }catch(error){
    console.error("[operator/stock/audit]",error);
    return privateResponse({error:"Read-only stock source audit is unavailable."},503);
  }
}
