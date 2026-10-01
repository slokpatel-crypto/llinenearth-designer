import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorSession } from "@/lib/operator-session";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import {
  normalizeFabricPhysicalColorCheck,
  summarizeFabricPhysicalColorChecks,
} from "@/lib/fabric-color-calibration";

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

export async function POST(request:Request){
  if(!await authorized()) return NextResponse.json({error:"Unauthorized."},{status:401});
  try{
    const body=await request.json() as Record<string,unknown>;
    const check=normalizeFabricPhysicalColorCheck({
      fabricId:body.fabricId,
      profileId:body.profileId,
      digitalHex:body.digitalHex,
      method:body.method,
      physicalLab:body.physicalLab,
      physicalHex:body.physicalHex,
      illuminant:body.illuminant,
      device:body.device,
      note:body.note,
    });
    const checkId=await rpc<string>("fabric_physical_color_check_record",{
      p_fabric_id:check.fabricId,
      p_profile_id:check.profileId,
      p_digital_hex:check.digitalHex,
      p_method:check.method,
      p_physical_l:check.physicalLab.l,
      p_physical_a:check.physicalLab.a,
      p_physical_b:check.physicalLab.b,
      p_physical_hex:check.physicalHex,
      p_delta_e:check.deltaE,
      p_illuminant:check.illuminant,
      p_device:check.device,
      p_note:check.note,
    });
    return NextResponse.json({checkId,check});
  }catch(error){
    console.error("[operator/fabric-color-calibration]",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Physical colour check could not be saved."},{status:400});
  }
}
