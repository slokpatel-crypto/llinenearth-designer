import "server-only";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
import {
  hashCustomerSessionBearer,
  requireCustomerSessionRevocationAck,
} from "@/lib/customer-session-revocation-contract";

// Opt in only *after* applying and testing the migration in the target backend.
// With enforcement enabled, all session checks fail CLOSED if the RPC is down.
export function customerSessionRevocationRequired(){
  return process.env.LINEN_CUSTOMER_SESSION_REVOCATION_REQUIRED==="1";
}

async function revocationRpc(name:string,token:string):Promise<boolean>{
  const config=getSupabaseAdminConfig();
  if(!config)throw new Error("Customer revocation backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify({p_token_hash:hashCustomerSessionBearer(token)}),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok)throw new Error("Customer session revocation RPC failed.");
  if(response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")
    throw new Error("Customer session revocation response type invalid.");
  return requireCustomerSessionRevocationAck(await readBoundedJsonResponse(response,512));
}

export async function customerSessionBearerAllowed(token:string):Promise<boolean>{
  if(!customerSessionRevocationRequired())return true;
  // A false boolean is the only acceptable not-revoked response.
  return !(await revocationRpc("customer_session_is_revoked",token));
}

export async function revokeCustomerSessionBearer(token:string):Promise<void>{
  if(!customerSessionRevocationRequired())return;
  // Do not acknowledge sign-out when revocation is missing, malformed or false.
  if((await revocationRpc("customer_session_revoke",token))!==true)
    throw new Error("Customer session could not be revoked.");
}
