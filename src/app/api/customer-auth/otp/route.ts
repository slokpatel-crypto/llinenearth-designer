import { NextResponse } from "next/server";
import { normalizeCustomerEmail, requestCustomerOtp } from "@/lib/customer-auth";
import { secureJsonRequestError, readSecureJsonObject, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { distributedOtpRateAllowed } from "@/lib/customer-otp-rate";

export const runtime="nodejs";

const MAX_OTP_REQUEST_BYTES=4_096;
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
  if(requestError)return NextResponse.json({error:requestError.error},{status:requestError.status,headers:{"cache-control":"private, no-store"}});
  if(blocked(request)) return NextResponse.json({error:"Too many sign-in requests. Try again later."},{status:429});
  try{
    const body=await readSecureJsonObject(request,MAX_OTP_REQUEST_BYTES);
    const email=normalizeCustomerEmail(body.email);
    if(!email) return NextResponse.json({error:"Enter a valid email address."},{status:400});
    // Opt-in shared atomic rate limit prevents rotating proxy/IP headers from
    // bypassing a per-email budget across serverless instances.
    if(!await distributedOtpRateAllowed(email))
      return NextResponse.json({error:"Too many sign-in requests. Try again later."},
        {status:429,headers:{"cache-control":"private, no-store"}});
    await requestCustomerOtp(email);
    return NextResponse.json({ok:true},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge)return NextResponse.json({error:"Request payload is too large."},{status:413});
    if(error instanceof SecureJsonBodyInvalid)return NextResponse.json({error:"Invalid JSON request."},{status:400});
    // Upstream error details can contain private email addresses or OTP material.
    console.error("[customer-auth/otp] sign-in request failed (details redacted).");
    return NextResponse.json({error:"Sign-in code could not be sent."},{status:503});
  }
}
