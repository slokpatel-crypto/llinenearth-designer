import { NextResponse } from "next/server";
import {
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  verifyCustomerOtp,
} from "@/lib/customer-auth";
import {
  CUSTOMER_AUTH_JSON_MAX_BYTES,
  customerAuthRateBlocked,
  parseCustomerAuthEmail,
  parseCustomerOtpCode,
  type CustomerAuthRateState,
} from "@/lib/customer-auth-request";
import {
  readSecureJsonObject, secureJsonRequestError,
  SecureJsonBodyInvalid, SecureJsonBodyTooLarge,
} from "@/lib/secure-json-request";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE_OPTIONS,
  createSignedCustomerSession,
} from "@/lib/customer-session";

export const runtime="nodejs";

const rate=(globalThis as typeof globalThis & {
  __linenCustomerAuthRate?:CustomerAuthRateState;
}).__linenCustomerAuthRate ||= {identities:new Map(),global:new Map()};

function respond(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store, max-age=0"}});
}

export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,CUSTOMER_AUTH_JSON_MAX_BYTES);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  if(customerAuthRateBlocked(rate,"verify",ip))
    return respond({error:"Too many sign-in attempts. Try again later."},429);
  let email:string|null;
  let token:string|null;
  try{
    const body=await readSecureJsonObject(request,CUSTOMER_AUTH_JSON_MAX_BYTES);
    email=parseCustomerAuthEmail(body.email);
    token=parseCustomerOtpCode(body.token);
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    return respond({error:"Sign-in request could not be read."},400);
  }
  if(!email||!token) return respond({error:"Enter the email and code you received."},400);

  try{
    const session=await verifyCustomerOtp(email,token);
    if(!session.user?.id) {
      return respond({error:"The sign-in response was incomplete."},502);
    }

    const customer={id:session.user.id,email:session.user.email||email};
    const durableToken=createSignedCustomerSession(customer);
    if(!durableToken){
      return respond({error:"Customer session signing is not configured."},503);
    }

    const response=respond({ok:true,customer});
    response.cookies.set(CUSTOMER_SESSION_COOKIE,durableToken,CUSTOMER_SESSION_COOKIE_OPTIONS);
    for(const name of [CUSTOMER_ACCESS_COOKIE,CUSTOMER_REFRESH_COOKIE]){
      response.cookies.set(name,"",{
        httpOnly:true,secure:process.env.NODE_ENV==="production",
        sameSite:"lax",path:"/",maxAge:0,
      });
    }
    return response;
  }catch(error){
    console.error("[customer-auth/verify] OTP verification failed.",error instanceof Error?error.name:"Unknown error");
    return respond({error:"That code is invalid or expired."},401);
  }
}
