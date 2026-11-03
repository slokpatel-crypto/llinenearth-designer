import { NextResponse } from "next/server";
import { secureJsonRequestError, readSecureJsonObject, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { customerSessionBearerAllowed, customerSessionRevocationRequired } from "@/lib/customer-session-revocation";
import { distributedOtpRateAllowed,localOtpRateAllowed } from "@/lib/customer-otp-rate";
import { validCustomerSessionIdentityId } from "@/lib/customer-session-token";
import {
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  normalizeCustomerEmail,
  verifyCustomerOtp,
} from "@/lib/customer-auth";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE_OPTIONS,
  createSignedCustomerSession,
} from "@/lib/customer-session";

export const runtime="nodejs";
const MAX_VERIFY_REQUEST_BYTES=4_096;
const privateJson=(body:unknown,status=200)=>NextResponse.json(body,{
  status,headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"},
});

export async function POST(request:Request){
  const requestError=secureJsonRequestError(request,MAX_VERIFY_REQUEST_BYTES);
  if(requestError)return privateJson({error:requestError.error},requestError.status);
  try{
    const body=await readSecureJsonObject(request,MAX_VERIFY_REQUEST_BYTES);
    const email=normalizeCustomerEmail(body.email);
    const token=String(body.token||"").replace(/\s/g,"");
    if(!email||token.length<6||token.length>12) {
      return privateJson({error:"Enter the email and code you received."},400);
    }

    // In-process recipient budget also protects the transition period before
    // the distributed migration is enabled, independent of untrusted IPs.
    if(!localOtpRateAllowed(email,"verify"))
      return privateJson({error:"Too many code attempts. Try again later."},429);

    // A separate shared email budget limits OTP guessing across instances.
    // A broken throttle store must not allow unlimited verification attempts.
    try{
      if(!await distributedOtpRateAllowed(email,"verify"))
        return privateJson({error:"Too many code attempts. Try again later."},429);
    }catch{
      return privateJson({error:"Secure code verification is temporarily unavailable."},503);
    }
    const session=await verifyCustomerOtp(email,token);
    // Never bind an OTP sent for Alice to a different Supabase account.
    // Inconsistent upstream identity data must not issue a durable cookie.
    if(!validCustomerSessionIdentityId(session.user?.id)||
      normalizeCustomerEmail(session.user.email)!==email) {
      return privateJson({error:"The sign-in response was incomplete."},502);
    }

    const customer={id:session.user.id,email:session.user.email||email};
    const durableToken=createSignedCustomerSession(customer);
    if(!durableToken){
      return privateJson({error:"Customer session signing is not configured."},503);
    }
    if(customerSessionRevocationRequired()){
      try{
        if(!await customerSessionBearerAllowed(durableToken))
          throw new Error("New signed session unexpectedly revoked.");
      }catch{
        return privateJson({error:"Secure customer sessions are temporarily unavailable."},503);
      }
    }

    const response=privateJson({ok:true,customer});
    response.cookies.set(CUSTOMER_SESSION_COOKIE,durableToken,CUSTOMER_SESSION_COOKIE_OPTIONS);

    for(const name of [CUSTOMER_ACCESS_COOKIE,CUSTOMER_REFRESH_COOKIE]){
      response.cookies.set(name,"",{
        httpOnly:true,secure:process.env.NODE_ENV==="production",
        sameSite:"lax",path:"/",maxAge:0,
      });
    }
    return response;
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge)return privateJson({error:"Request payload is too large."},413);
    if(error instanceof SecureJsonBodyInvalid)return privateJson({error:"Invalid JSON request."},400);
    console.error("[customer-auth/verify] verification failed (details redacted).");
    return privateJson({error:"That code is invalid or expired."},401);
  }
}
