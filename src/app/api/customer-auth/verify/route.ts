import { NextResponse } from "next/server";
import {
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  authCookieOptions,
  normalizeCustomerEmail,
  verifyCustomerOtp,
} from "@/lib/customer-auth";

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
    if(!session.access_token||!session.user?.id) {
      return NextResponse.json({error:"The sign-in response was incomplete."},{status:502});
    }
    const response=NextResponse.json({
      ok:true,
      customer:{id:session.user.id,email:session.user.email||email},
    },{headers:{"cache-control":"private, no-store"}});
    response.cookies.set(CUSTOMER_ACCESS_COOKIE,session.access_token,authCookieOptions(session.expires_in||3600));
    if(session.refresh_token){
      response.cookies.set(CUSTOMER_REFRESH_COOKIE,session.refresh_token,{
        ...authCookieOptions(60*60*24*30),
        maxAge:60*60*24*30,
      });
    }
    return response;
  }catch(error){
    console.error("[customer-auth/verify]",error);
    return NextResponse.json({error:"That code is invalid or expired."},{status:401});
  }
}
