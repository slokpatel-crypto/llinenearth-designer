import { NextResponse } from "next/server";
import { CUSTOMER_ACCESS_COOKIE, CUSTOMER_REFRESH_COOKIE } from "@/lib/customer-auth";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/customer-session";
import { secureSameOriginRequestError } from "@/lib/secure-json-request";

export async function POST(request:Request){
  // A cross-site form POST must not forcibly sign a customer out.
  // This endpoint has no JSON body, so reuse only the origin/fetch-site gate.
  const unsafe=secureSameOriginRequestError(request);
  if(unsafe) return NextResponse.json({error:unsafe.error},{
    status:unsafe.status,headers:{"cache-control":"private, no-store"},
  });
  const response=NextResponse.json({ok:true},{headers:{"cache-control":"private, no-store"}});
  for(const name of [CUSTOMER_SESSION_COOKIE,CUSTOMER_ACCESS_COOKIE,CUSTOMER_REFRESH_COOKIE]){
    response.cookies.set(name,"",{
      httpOnly:true,secure:process.env.NODE_ENV==="production",
      sameSite:"lax",path:"/",maxAge:0,
    });
  }
  return response;
}
