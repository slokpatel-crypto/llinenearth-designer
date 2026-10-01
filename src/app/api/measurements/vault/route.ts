import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { type MeasurementProfile } from "@/lib/measurements";
import { type TailorObservationProfile } from "@/lib/designer/tailor-observations";
import {
  createMeasurementVaultAccessKey,
  createMeasurementVaultRecoveryToken,
  hashMeasurementVaultAccessKey,
  parseMeasurementVaultRecoveryToken,
} from "@/lib/measurement-vault";

export const runtime="nodejs";

const rate=(globalThis as typeof globalThis & {
  __linenMeasurementVaultRate?:Map<string,{at:number;count:number}>
}).__linenMeasurementVaultRate ||= new Map<string,{at:number;count:number}>();

function blocked(request:Request){
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  const now=Date.now();
  const current=rate.get(ip);
  if(!current||now-current.at>60_000){rate.set(ip,{at:now,count:1});return false;}
  current.count+=1;
  return current.count>30;
}

async function rpc<T>(name:string,payload:Record<string,unknown>):Promise<T>{
  const config=getSupabaseAdminConfig();
  if(!config) throw new Error("Measurement vault is not configured.");
  const response=await fetch(`${config.url}/rest/v1/rpc/${name}`,{
    method:"POST",
    headers:{...supabaseAdminHeaders(config),"content-type":"application/json",accept:"application/json"},
    body:JSON.stringify(payload),
    cache:"no-store",
    signal:AbortSignal.timeout(8_000),
  });
  if(!response.ok){
    const detail=(await response.text()).slice(0,300);
    throw new Error(`Measurement vault request failed (${response.status}): ${detail}`);
  }
  return await response.json() as T;
}

function validProfile(profile:unknown):profile is MeasurementProfile{
  if(!profile||typeof profile!=="object"||Array.isArray(profile)) return false;
  const p=profile as MeasurementProfile;
  if(p.version!==1||!["cm","in"].includes(p.unit)||!p.shirt||!p.pants) return false;
  const numericValues=[...Object.values(p.shirt),...Object.values(p.pants)];
  return numericValues.every((value)=>value===undefined||(typeof value==="number"&&Number.isFinite(value)&&value>0&&value<500));
}

function validObservations(value:unknown):value is TailorObservationProfile{
  if(!value||typeof value!=="object"||Array.isArray(value)) return false;
  const v=value as TailorObservationProfile;
  return v.version===1;
}

export async function POST(request:Request){
  if(blocked(request)) return NextResponse.json({error:"Too many measurement-vault requests."},{status:429});
  try{
    const body=await request.json() as {action?:string;profile?:MeasurementProfile;observations?:TailorObservationProfile;recoveryToken?:string};
    const action=String(body.action||"");

    if(action==="store"){
      if(!validProfile(body.profile)||!validObservations(body.observations)) {
        return NextResponse.json({error:"A valid measurement and tailoring profile is required."},{status:400});
      }
      const accessKey=createMeasurementVaultAccessKey();
      const accessHash=hashMeasurementVaultAccessKey(accessKey);
      const vaultId=await rpc<string>("measurement_profile_vault_store",{
        p_access_hash:accessHash,
        p_profile:body.profile,
        p_observations:body.observations,
        p_ttl_days:180,
      });
      const recoveryToken=createMeasurementVaultRecoveryToken(vaultId,accessKey);
      return NextResponse.json({vaultId,recoveryToken,expiresInDays:180});
    }

    const parsed=parseMeasurementVaultRecoveryToken(String(body.recoveryToken||""));
    if(!parsed) return NextResponse.json({error:"The measurement recovery token is invalid."},{status:400});

    if(action==="load"){
      const rows=await rpc<Array<{profile:MeasurementProfile;observations:TailorObservationProfile;expires_at:string}>>("measurement_profile_vault_get",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
      });
      const row=rows[0];
      if(!row||!validProfile(row.profile)||!validObservations(row.observations)) {
        return NextResponse.json({error:"Measurement profile was not found or has expired."},{status:404});
      }
      return NextResponse.json({profile:row.profile,observations:row.observations,expiresAt:row.expires_at});
    }

    if(action==="delete"){
      const deleted=await rpc<boolean>("measurement_profile_vault_delete",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
      });
      return NextResponse.json({deleted:Boolean(deleted)});
    }

    return NextResponse.json({error:"Unsupported measurement-vault action."},{status:400});
  }catch(error){
    console.error("[measurements/vault]",error);
    return NextResponse.json({error:"Secure measurement storage is temporarily unavailable."},{status:503});
  }
}
