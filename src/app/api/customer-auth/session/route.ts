import { NextResponse } from "next/server";
import { getCustomerIdentity } from "@/lib/customer-auth";

export const runtime="nodejs";

export async function GET(request:Request){
  try{
    const customer=await getCustomerIdentity(request);
    return NextResponse.json({customer},{headers:{"cache-control":"private, no-store"}});
  }catch{
    // The backend error may include an upstream URL, cookie or customer email.
    console.error("[customer-auth/session] session lookup failed (details redacted).");
    // Outage and ordinary signed-out are different states. A 503 tells the
    // account client to hide stale private data and show a retry action.
    // Never disclose the backend error or the submitted cookie in the body.
    return NextResponse.json({customer:null,error:"Customer session temporarily unavailable."},{
      status:503,headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"},
    });
  }
}
