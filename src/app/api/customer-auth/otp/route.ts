import { NextResponse } from "next/server";
import { normalizeCustomerEmail, requestCustomerOtp } from "@/lib/customer-auth";
import { secureJsonRequestError, readSecureJsonObject, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { distributedOtpRateAllowed,localOtpRateAllowed } from "@/lib/customer-otp-rate";

export const runtime="nodejs";

const MAX_OTP_REQUEST_BYTES=4_096;
const privateJson=(body:unknown,status=200)=>NextResponse.json(body,{
  status,headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"},
});
const MAX_OTP_RATE_SUBJECTS=4_096;
const rate=(globalThis as typeof globalThis & {__linenCustomerOtpRate?:Map<string,{at:number;count:number}>}).__linenCustomerOtpRate ||= new Map();

function blocked(request:Request){
  // In-process protection only: distributed edge throttling is also required.
  const ip=(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown").slice(0,128);
  const now=Date.now(), current=rate.get(ip);
  if(rate.size>=MAX_OTP_RATE_SUBJECTS){
    for(const [subject,entry] of rate){
      if(now-entry.at>10*60_000||entry.at>now)rate.delete(subject);
    }
    if(rate.size>=MAX_OTP_RATE_SUBJECTS&&!current)return true;
  }
  if(!current||now-current.at>10*60_000){rate.set(ip,{at:now,count:1});return false;}
  current.count+=1;
  return current.count>8;
}

export async function POST(request:Request){
  const requestError=secureJsonRequestError(request,MAX_OTP_REQUEST_BYTES);
  if(requestError)return privateJson({error:requestError.error},requestError.status);
  if(blocked(request)) return privateJson({error:"Too many sign-in requests. Try again later."},429);
  try{
    const body=await readSecureJsonObject(request,MAX_OTP_REQUEST_BYTES);
    const email=normalizeCustomerEmail(body.email);
    if(!email) return privateJson({error:"Enter a valid email address."},400);
    if(!localOtpRateAllowed(email))
      return privateJson({error:"Too many sign-in requests. Try again later."},429);
    // Opt-in shared atomic rate limit prevents rotating proxy/IP headers from
    // bypassing a per-email budget across serverless instances.
    if(!await distributedOtpRateAllowed(email))
      return privateJson({error:"Too many sign-in requests. Try again later."},429);
    await requestCustomerOtp(email);
    return privateJson({ok:true});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge)return privateJson({error:"Request payload is too large."},413);
    if(error instanceof SecureJsonBodyInvalid)return privateJson({error:"Invalid JSON request."},400);
    // Upstream error details can contain private email addresses or OTP material.
    console.error("[customer-auth/otp] sign-in request failed (details redacted).");
    return privateJson({error:"Sign-in code could not be sent."},503);
  }
}
