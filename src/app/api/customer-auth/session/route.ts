import { NextResponse } from "next/server";
import { getCustomerIdentity } from "@/lib/customer-auth";

export const runtime="nodejs";

export async function GET(request:Request){
  try{
    const customer=await getCustomerIdentity(request);
    return NextResponse.json({customer},{headers:{"cache-control":"private, no-store"}});
  }catch{
    // Never log upstream errors: they can contain cookies, emails or provider URLs.
    console.error("[customer-auth/session] session lookup failed (details redacted).");
    // An unavailable authentication backend must not masquerade as signed-out.
    return NextResponse.json({customer:null,error:"Customer session temporarily unavailable."},{
      status:503,headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"},
    });
  }
}
