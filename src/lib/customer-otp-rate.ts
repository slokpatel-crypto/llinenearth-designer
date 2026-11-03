import "server-only";
import {randomBytes} from "node:crypto";
import {getSupabaseAdminConfig,supabaseAdminHeaders} from "@/lib/supabase-admin";
import {readBoundedJsonResponse} from "@/lib/designer/bounded-json-response";
import {consumeLocalOtpBudget,otpRateSubjectHash,requireOtpRateAck,
  type LocalOtpWindow} from "@/lib/customer-otp-rate-contract";

const localState=(globalThis as typeof globalThis & {
  __linenOtpFallback?:{secret:string;windows:Map<string,LocalOtpWindow>};
}).__linenOtpFallback ||= {
  secret:randomBytes(32).toString("hex"),
  windows:new Map<string,LocalOtpWindow>(),
};

/** A best-effort same-process fallback only: production must still enable
 * the distributed database budget and enforce trusted-edge anti-abuse. */
export function localOtpRateAllowed(email:string,purpose:"request"|"verify"="request"){
  return consumeLocalOtpBudget(localState.windows,
    otpRateSubjectHash(email,localState.secret,purpose),Date.now());
}


export function distributedOtpRateRequired(){
  return process.env.LINEN_CUSTOMER_OTP_DISTRIBUTED_REQUIRED==="1";
}

export async function distributedOtpRateAllowed(
  email:string,purpose:"request"|"verify"="request"
):Promise<boolean>{
  if(!distributedOtpRateRequired())return true;
  const secret=process.env.LINEN_CUSTOMER_OTP_RATE_SECRET?.trim();
  if(!secret||secret.length<32)throw new Error("Distributed OTP limiter is not configured.");
  const config=getSupabaseAdminConfig();
  if(!config)throw new Error("Distributed OTP database is unavailable.");
  const response=await fetch(`${config.url}/rest/v1/rpc/customer_otp_rate_consume`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify({p_subject_hash:otpRateSubjectHash(email,secret,purpose)}),
    cache:"no-store",signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok||response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")
    throw new Error("Distributed OTP throttle is unavailable.");
  return requireOtpRateAck(await readBoundedJsonResponse(response,512));
}
