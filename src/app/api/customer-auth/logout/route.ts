import { NextResponse } from "next/server";
import { CUSTOMER_ACCESS_COOKIE, CUSTOMER_REFRESH_COOKIE } from "@/lib/customer-auth";

export async function POST(){
  const response=NextResponse.json({ok:true},{headers:{"cache-control":"private, no-store"}});
  for(const name of [CUSTOMER_ACCESS_COOKIE,CUSTOMER_REFRESH_COOKIE]){
    response.cookies.set(name,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
  }
  return response;
}
