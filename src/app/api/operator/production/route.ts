import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}
async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Production backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).slice(0,300);
    throw new Error(`Production request failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,quotes:[],orders:[]});
  try{
    const [quotes,orders]=await Promise.all([
      rpc("production_quote_list",{p_limit:100}),
      rpc("production_order_list",{p_limit:100}),
    ]);
    return NextResponse.json({configured:true,quotes,orders},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/production]",error);
    return NextResponse.json({error:"Production records could not be read."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const action=String(body.action||"");
    if(action==="create_quote"){
      const revisionId=String(body.revisionId||"").trim();
      const recipeHash=String(body.recipeHash||"").trim().toLowerCase();
      const currency=String(body.currency||"INR").trim().toUpperCase();
      const lineItems=Array.isArray(body.lineItems)?body.lineItems:[];
      const adjustment=Number(body.adjustment||0);
      const note=String(body.note||"").slice(0,1000);
      if(revisionId.length<12||!/^[a-f0-9]{64}$/.test(recipeHash)||!/^[A-Z]{3}$/.test(currency)||!lineItems.length) {
        return NextResponse.json({error:"Locked revision, recipe hash and line items are required."},{status:400});
      }
      const quoteId=await rpc<string>("production_quote_create",{
        p_revision_id:revisionId,p_recipe_hash:recipeHash,p_currency:currency,
        p_line_items:lineItems,p_adjustment:adjustment,p_note:note,
      });
      return NextResponse.json({quoteId});
    }
    if(action==="quote_status"){
      const quoteId=String(body.quoteId||"");
      const status=String(body.status||"");
      const note=String(body.note||"").slice(0,1000);
      const updated=await rpc<boolean>("production_quote_set_status",{p_quote_id:quoteId,p_status:status,p_note:note});
      return NextResponse.json({updated:Boolean(updated)});
    }
    if(action==="create_order"){
      const revisionId=String(body.revisionId||"").trim();
      const recipeHash=String(body.recipeHash||"").trim().toLowerCase();
      const quoteId=String(body.quoteId||"").trim()||null;
      const note=String(body.note||"").slice(0,1000);
      if(revisionId.length<12||!/^[a-f0-9]{64}$/.test(recipeHash)) {
        return NextResponse.json({error:"Locked revision and recipe hash are required."},{status:400});
      }
      const orderId=await rpc<string>("production_order_create",{
        p_revision_id:revisionId,p_recipe_hash:recipeHash,p_quote_id:quoteId,p_note:note,
      });
      return NextResponse.json({orderId});
    }
    if(action==="order_status"){
      const orderId=String(body.orderId||"");
      const status=String(body.status||"");
      const note=String(body.note||"").slice(0,1000);
      const updated=await rpc<boolean>("production_order_set_status",{p_order_id:orderId,p_status:status,p_note:note});
      return NextResponse.json({updated:Boolean(updated)});
    }
    return NextResponse.json({error:"Unsupported production action."},{status:400});
  }catch(error){
    console.error("[operator/production]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Production operation failed."},{status:409});
  }
}
