import "server-only";
import {getSupabaseAdminConfig,supabaseAdminHeaders} from "@/lib/supabase-admin";
import {readBoundedJsonResponse} from "@/lib/designer/bounded-json-response";
import {otpRateSubjectHash,requireOtpRateAck} from "@/lib/customer-otp-rate-contract";

export function distributedOtpRateRequired(){
  return process.env.LINEN_CUSTOMER_OTP_DISTRIBUTED_REQUIRED==="1";
}

export async function distributedOtpRateAllowed(email:string):Promise<boolean>{
  if(!distributedOtpRateRequired())return true;
  const secret=process.env.LINEN_CUSTOMER_OTP_RATE_SECRET?.trim();
  if(!secret||secret.length<32)throw new Error("Distributed OTP limiter is not configured.");
  const config=getSupabaseAdminConfig();
  if(!config)throw new Error("Distributed OTP database is unavailable.");
  const response=await fetch(`${config.url}/rest/v1/rpc/customer_otp_rate_consume`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify({p_subject_hash:otpRateSubjectHash(email,secret)}),
    cache:"no-store",signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok||response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()!=="application/json")
    throw new Error("Distributed OTP throttle is unavailable.");
  return requireOtpRateAck(await readBoundedJsonResponse(response,512));
}
