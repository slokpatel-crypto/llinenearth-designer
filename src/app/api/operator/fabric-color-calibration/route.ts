import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { normalizeVaultId } from "@/lib/vault-id";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  normalizeFabricPhysicalColorCheck,
  summarizeFabricPhysicalColorChecks,
} from "@/lib/fabric-color-calibration";
import { loadFabricAnalysesForFabricIds } from "@/lib/fabric-analyzer-store";

export const runtime="nodejs";

async function authorized(){
  const jar=await cookies();
  return verifyOperatorSession(jar.get(OPERATOR_COOKIE.name)?.value);
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Fabric colour evidence backend is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).slice(0,300);
    throw new Error(`Fabric colour evidence request failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

export async function GET(){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  if(!getSupabaseAdminConfig()) return NextResponse.json({configured:false,checks:[],summary:summarizeFabricPhysicalColorChecks([])});
  try{
    const checks=await rpc<Array<Record<string,unknown>>>("fabric_physical_color_check_list",{p_limit:500});
    return NextResponse.json({
      configured:true,
      checks,
      summary:summarizeFabricPhysicalColorChecks(checks),
    },{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    console.error("[operator/fabric-color-calibration]",error);
    return NextResponse.json({error:"Physical colour evidence could not be loaded."},{status:503});
  }
}

function respond(body:unknown,status=200){
  return NextResponse.json(body,{status,headers:{"cache-control":"private, no-store","pragma":"no-cache"}});
}

export async function POST(request:Request){
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return respond({error:unsafe.error},unsafe.status);
  if(!await authorized()) return respond({error:"Unauthorized."},401);
  try{
    const body=await readSecureJsonObject(request,16384);
    let check;
    try{
      check=normalizeFabricPhysicalColorCheck({
        fabricId:body.fabricId,profileId:body.profileId,digitalHex:body.digitalHex,
        method:body.method,physicalLab:body.physicalLab,physicalHex:body.physicalHex,
        illuminant:body.illuminant,device:body.device,checkedBy:body.checkedBy,
        evidenceReference:body.evidenceReference,note:body.note,
      });
      if(!check.profileId) throw new Error("A reviewed Analyzer profile is required for the digital colour reference.");
    }catch(error){
      return respond({error:error instanceof Error?error.message:"Invalid physical colour evidence."},400);
    }
    const profiles=await loadFabricAnalysesForFabricIds([check.fabricId],{includeUnreviewed:false});
    const profile=profiles.find((item)=>item.id===check.profileId&&
      (item.review_status==="approved"||item.review_status==="corrected"));
    if(!profile) return respond({error:"The selected Analyzer profile is not an approved/corrected profile bound to this fabric."},409);
    const measured=profile.profile?.measured?.colour?.hex;
    const measuredHex=typeof measured==="string"?measured.trim().toUpperCase():"";
    if(measuredHex!==check.digitalHex) return respond({error:"Digital colour reference must match the selected reviewed Analyzer measurement."},409);
    const receipt=await rpc<unknown>("fabric_physical_color_check_record_v2",{
      p_fabric_id:check.fabricId,p_profile_id:check.profileId,
      p_digital_hex:check.digitalHex,p_method:check.method,
      p_physical_l:check.physicalLab.l,p_physical_a:check.physicalLab.a,
      p_physical_b:check.physicalLab.b,p_physical_hex:check.physicalHex,
      p_delta_e:check.deltaE,p_illuminant:check.illuminant,
      p_device:check.device,p_checked_by:check.checkedBy,
      p_evidence_reference:check.evidenceReference,p_note:check.note,
    });
    const checkId=normalizeVaultId(receipt);
    if(!checkId) return respond({error:"Physical colour check was not confirmed by the backend."},409);
    return respond({checkId,check});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return respond({error:error.message},413);
    if(error instanceof SecureJsonBodyInvalid) return respond({error:error.message},400);
    console.error("[operator/fabric-color-calibration]",error);
    return respond({error:"Physical colour check could not be saved."},409);
  }
}
