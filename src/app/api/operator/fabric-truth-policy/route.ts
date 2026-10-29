import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { FABRIC_TRUTH_POLICY_VERSION, normalizeFabricTruthPolicy, type FabricTruthPolicy } from "@/lib/designer/fabric-truth-policy";

export const runtime="nodejs";

function respond(body:unknown,status=200){return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});}

type EventRow={at:string;payload?:Record<string,unknown>};

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

function policyFromPayload(payload:Record<string,unknown>|undefined):FabricTruthPolicy|null{
  if(!payload || payload.subtype!=="fabric_truth_evidence_policy") return null;
  if(payload.version!==FABRIC_TRUTH_POLICY_VERSION) return null;
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
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  const cloud=getSupabaseAdminConfig();
  if(!cloud) return respond({error:"Cloud evidence ledger is not configured."},503);
  try{
    const body=await readSecureJsonObject(request,16384);
    let policy:FabricTruthPolicy;
    try{policy=normalizeFabricTruthPolicy(body);}
    catch(error){return respond({error:error instanceof Error?error.message:"Invalid fabric truth policy."},400);}
    const at=new Date().toISOString();
    const event={
      id:`EV-FABRIC-TRUTH-POLICY-${crypto.randomUUID()}`,
      session_id:"FABRIC-TRUTH-POLICY",
      type:"operator_note",
      at,
      source:"operator",
      payload:{subtype:"fabric_truth_evidence_policy",...policy},
    };
    const response=await fetch(`${cloud.url.replace(/\/$/,"")}/rest/v1/style_events?select=id,at`,{
      method:"POST",
      headers:{
        ...supabaseAdminHeaders(cloud),
        "content-type":"application/json",
        accept:"application/json",
        prefer:"return=representation",
      },
      body:JSON.stringify(event),
      cache:"no-store",
      signal:AbortSignal.timeout(8_000),
    });
    if(!response.ok) throw new Error("Fabric Truth policy write was rejected by the ledger.");
    const receipt:unknown=await response.json();
    if(!Array.isArray(receipt)||receipt.length!==1||
       !receipt[0]||typeof receipt[0]!=="object"||Array.isArray(receipt[0]))
      return respond({error:"Fabric Truth policy write was not confirmed."},409);
    const saved=receipt[0] as Record<string,unknown>;
    if(saved.id!==event.id||typeof saved.at!=="string"||!Number.isFinite(Date.parse(saved.at)))
      return respond({error:"Fabric Truth policy receipt does not match the submitted event."},409);
    return respond({policy,recordedAt:saved.at,eventId:event.id});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/fabric-truth-policy:post]",error);
    return respond({error:"Fabric Truth evidence policy could not be saved."},409);
  }
}
