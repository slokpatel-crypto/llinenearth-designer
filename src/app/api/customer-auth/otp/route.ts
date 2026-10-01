import { NextResponse } from "next/server";
import { normalizeCustomerEmail, requestCustomerOtp } from "@/lib/customer-auth";

export const runtime="nodejs";

const rate=(globalThis as typeof globalThis & {__linenCustomerOtpRate?:Map<string,{at:number;count:number}>}).__linenCustomerOtpRate ||= new Map();

function blocked(request:Request){
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  const now=Date.now(), current=rate.get(ip);
  if(!current||now-current.at>10*60_000){rate.set(ip,{at:now,count:1});return false;}
  current.count+=1;
  return current.count>8;
}

export async function POST(request:Request){
  if(blocked(request)) return NextResponse.json({error:"Too many sign-in requests. Try again later."},{status:429});
  try{
    const body=await request.json() as {email?:string};
    const email=normalizeCustomerEmail(body.email);
    if(!email) return NextResponse.json({error:"Enter a valid email address."},{status:400});
    await requestCustomerOtp(email);
    return NextResponse.json({ok:true},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[customer-auth/otp]",error);
    return NextResponse.json({error:"Sign-in code could not be sent."},{status:503});
  }
}
