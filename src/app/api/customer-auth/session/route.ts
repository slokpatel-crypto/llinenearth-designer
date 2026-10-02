import { NextResponse } from "next/server";
import { getCustomerIdentity } from "@/lib/customer-auth";

export const runtime="nodejs";

export async function GET(request:Request){
  try{
    const customer=await getCustomerIdentity(request);
    return NextResponse.json({customer},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[customer-auth/session]",error);
    return NextResponse.json({customer:null},{headers:{"cache-control":"private, no-store"}});
  }
}
