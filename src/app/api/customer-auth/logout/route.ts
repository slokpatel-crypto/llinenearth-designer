import { NextResponse } from "next/server";
import { secureSameOriginRequestError } from "@/lib/secure-json-request";
import { CUSTOMER_ACCESS_COOKIE, CUSTOMER_REFRESH_COOKIE } from "@/lib/customer-auth";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer-session";

export async function POST(request:Request){
  const requestError=secureSameOriginRequestError(request);
  if(requestError)return NextResponse.json({error:requestError.error},{status:requestError.status,headers:{"cache-control":"private, no-store"}});
  const response=NextResponse.json({ok:true},{headers:{"cache-control":"private, no-store"}});
  for(const name of [CUSTOMER_SESSION_COOKIE,CUSTOMER_ACCESS_COOKIE,CUSTOMER_REFRESH_COOKIE]){
    response.cookies.set(name,"",{
      httpOnly:true,secure:process.env.NODE_ENV==="production",
      sameSite:"lax",path:"/",maxAge:0,
    });
  }
  return response;
}
