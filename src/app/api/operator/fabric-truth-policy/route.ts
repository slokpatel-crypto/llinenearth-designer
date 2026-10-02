import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { FABRIC_TRUTH_POLICY_VERSION, normalizeFabricTruthPolicy, type FabricTruthPolicy } from "@/lib/designer/fabric-truth-policy";

export const runtime="nodejs";

type EventRow={at:string;payload?:Record<string,unknown>};

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

function policyFromPayload(payload:Record<string,unknown>|undefined):FabricTruthPolicy|null{
  if(!payload || String(payload.subtype||"")!=="fabric_truth_evidence_policy") return null;
  if(String(payload.version||"")!==FABRIC_TRUTH_POLICY_VERSION) return null;
  try{return normalizeFabricTruthPolicy(payload);}catch{return null;}
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return NextResponse.json({configured:false,policy:null},{headers:{"cache-control":"private, no-store"}});
  try{
    const params=new URLSearchParams({
      select:"at,payload",
      type:"eq.operator_note",
      source:"eq.operator",
      order:"at.desc",
      limit:"500",
    });
    const response=await fetch(`${cloud.url}/rest/v1/style_events?${params.toString()}`,{
      headers:{...supabaseAdminHeaders(cloud),accept:"application/json"},
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok) throw new Error("Fabric Truth policy ledger could not be read.");
    const rows=await response.json() as EventRow[];
    for(const row of rows){
      const policy=policyFromPayload(row.payload);
      if(policy) return NextResponse.json({configured:true,policy,recordedAt:row.at},{headers:{"cache-control":"private, no-store"}});
    }
    return NextResponse.json({configured:true,policy:null},{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/fabric-truth-policy:get]",error);
    return NextResponse.json({error:"Fabric Truth evidence policy could not be loaded."},{status:503});
  }
}

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return NextResponse.json({error:"Cloud evidence ledger is not configured."},{status:503});
  try{
    const body=await request.json() as Record<string,unknown>;
    const policy=normalizeFabricTruthPolicy(body);
    const at=new Date().toISOString();
    const event={
      id:`EV-FABRIC-TRUTH-POLICY-${crypto.randomUUID()}`,
      session_id:"FABRIC-TRUTH-POLICY",
      type:"operator_note",
      at,
      source:"operator",
      payload:{
        subtype:"fabric_truth_evidence_policy",
        ...policy,
      },
    };
    const response=await fetch(`${cloud.url}/rest/v1/style_events`,{
      method:"POST",
      headers:{
        ...supabaseAdminHeaders(cloud),
        "content-type":"application/json",
        prefer:"return=minimal",
      },
      body:JSON.stringify(event),
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok){
      const detail=(await response.text()).replace(/\s+/g," ").slice(0,280);
      throw new Error(`Fabric Truth policy write failed (${response.status}): ${detail}`);
    }
    return NextResponse.json({policy,recordedAt:at});
  }catch(error){
    console.error("[operator/fabric-truth-policy:post]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Fabric Truth evidence policy could not be saved."},{status:409});
  }
}
