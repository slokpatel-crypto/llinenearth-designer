import { NextResponse } from "next/server";
import { secureSameOriginRequestError } from "@/lib/secure-json-request";
import { CUSTOMER_ACCESS_COOKIE, CUSTOMER_REFRESH_COOKIE } from "@/lib/customer-auth";
import { CUSTOMER_SESSION_COOKIE, verifySignedCustomerSession } from "@/lib/customer-session";
import { readCookie } from "@/lib/customer-auth";
import { revokeCustomerSessionBearer } from "@/lib/customer-session-revocation";

export async function POST(request:Request){
  const requestError=secureSameOriginRequestError(request);
  if(requestError)return NextResponse.json({error:requestError.error},{status:requestError.status,headers:{"cache-control":"private, no-store"}});
  const signedCookie=readCookie(request,CUSTOMER_SESSION_COOKIE);
  if(signedCookie&&verifySignedCustomerSession(signedCookie)){
    try{await revokeCustomerSessionBearer(signedCookie);}
    catch{
      // Do not clear cookies or claim logout succeeded while a stolen cookie
      // remains reusable because the required revocation store is unavailable.
      console.error("[customer-auth/logout] revocation failed (details redacted).");
      return NextResponse.json({error:"Secure sign-out is temporarily unavailable."},
        {status:503,headers:{"cache-control":"private, no-store"}});
    }
  }
  const response=NextResponse.json({ok:true},{headers:{"cache-control":"private, no-store"}});
  for(const name of [CUSTOMER_SESSION_COOKIE,CUSTOMER_ACCESS_COOKIE,CUSTOMER_REFRESH_COOKIE]){
    response.cookies.set(name,"",{
      httpOnly:true,secure:process.env.NODE_ENV==="production",
      sameSite:"lax",path:"/",maxAge:0,
    });
  }
  return response;
}
