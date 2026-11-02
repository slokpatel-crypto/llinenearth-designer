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
    return NextResponse.json({customer:null},{headers:{"cache-control":"private, no-store"}});
  }
}
