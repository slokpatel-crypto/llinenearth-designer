import { NextResponse } from "next/server";
import { requestCustomerOtp } from "@/lib/customer-auth";
import {
  CUSTOMER_AUTH_JSON_MAX_BYTES,
  customerAuthRateBlocked,
  customerAuthEmailRateBlocked,
  parseCustomerAuthEmail,
  type CustomerAuthRateState,
} from "@/lib/customer-auth-request";
import {
  readSecureJsonObject, secureJsonRequestError,
  SecureJsonBodyInvalid, SecureJsonBodyTooLarge,
} from "@/lib/secure-json-request";

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
  if(customerAuthRateBlocked(rate,"otp",ip))
    return respond({error:"Too many sign-in requests. Try again later."},429);
  let email:string|null;
  try{
    const body=await readSecureJsonObject(request,CUSTOMER_AUTH_JSON_MAX_BYTES);
    email=parseCustomerAuthEmail(body.email);
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    return respond({error:"Sign-in request could not be read."},400);
  }
  if(!email) return respond({error:"Enter a valid email address."},400);
  if(customerAuthEmailRateBlocked(rate,"otp",email))
    return respond({error:"Too many codes requested for this email. Try again later."},429);
  try{
    await requestCustomerOtp(email);
    return respond({ok:true});
  }catch(error){
    console.error("[customer-auth/otp] OTP provider unavailable.",error instanceof Error?error.name:"Unknown error");
    return respond({error:"Sign-in code could not be sent."},503);
  }
}
