import { NextResponse } from "next/server";
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

export async function POST(request:Request){
  try{
    const body=await request.json() as {email?:string;token?:string};
    const email=normalizeCustomerEmail(body.email);
    const token=String(body.token||"").replace(/\s/g,"");
    if(!email||token.length<6||token.length>12) {
      return NextResponse.json({error:"Enter the email and code you received."},{status:400});
    }

    const session=await verifyCustomerOtp(email,token);
    if(!session.user?.id) {
      return NextResponse.json({error:"The sign-in response was incomplete."},{status:502});
    }

    const customer={id:session.user.id,email:session.user.email||email};
    const durableToken=createSignedCustomerSession(customer);
    if(!durableToken){
      return NextResponse.json({error:"Customer session signing is not configured."},{status:503});
    }

    const response=NextResponse.json({ok:true,customer},{
      headers:{"cache-control":"private, no-store","pragma":"no-cache"},
    });
    response.cookies.set(CUSTOMER_SESSION_COOKIE,durableToken,CUSTOMER_SESSION_COOKIE_OPTIONS);

    for(const name of [CUSTOMER_ACCESS_COOKIE,CUSTOMER_REFRESH_COOKIE]){
      response.cookies.set(name,"",{
        httpOnly:true,secure:process.env.NODE_ENV==="production",
        sameSite:"lax",path:"/",maxAge:0,
      });
    }
    return response;
  }catch(error){
    console.error("[customer-auth/verify]",error);
    return NextResponse.json({error:"That code is invalid or expired."},{status:401});
  }
}
