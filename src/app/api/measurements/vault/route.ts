import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { type MeasurementProfile } from "@/lib/measurements";
import { type TailorObservationProfile } from "@/lib/designer/tailor-observations";
import {
  createMeasurementVaultAccessKey,
  createMeasurementVaultRecoveryToken,
  hashMeasurementVaultAccessKey,
  parseMeasurementVaultRecoveryToken,
} from "@/lib/measurement-vault";

export const runtime="nodejs";

function jsonNoStore(body:unknown,init?:{status?:number}){
  return NextResponse.json(body,{
    ...init,
    headers:{"cache-control":"private, no-store, max-age=0","pragma":"no-cache"},
  });
}

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
  if(blocked(request)) return jsonNoStore({error:"Too many measurement-vault requests."},{status:429});
  try{
    const body=await request.json() as {
      action?:string;
      profile?:MeasurementProfile;
      observations?:TailorObservationProfile;
      recoveryToken?:string;
      vaultId?:string;
    };
    const action=String(body.action||"");
    const customer=await getCustomerIdentity(request);

    if(action==="store"){
      if(!validProfile(body.profile)||!validObservations(body.observations)) {
        return jsonNoStore({error:"A valid measurement and tailoring profile is required."},{status:400});
      }
      const accessKey=createMeasurementVaultAccessKey();
      const accessHash=hashMeasurementVaultAccessKey(accessKey);
      const vaultId=await rpc<string>("measurement_profile_vault_store",{
        p_access_hash:accessHash,
        p_profile:body.profile,
        p_observations:body.observations,
        p_ttl_days:180,
      });

      let accountOwned=false;
      if(customer){
        accountOwned=Boolean(await rpc<boolean>("measurement_profile_vault_set_owner",{
          p_vault_id:vaultId,p_access_hash:accessHash,p_owner_user_id:customer.id,
        }));
      }

      const recoveryToken=createMeasurementVaultRecoveryToken(vaultId,accessKey);
      return jsonNoStore({
        vaultId,recoveryToken,expiresInDays:180,
        accountOwned,
        customer:customer?{email:customer.email}:null,
      });
    }

    if(action==="listOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const rows=await rpc<Array<{
        vault_id:string;profile:MeasurementProfile;observations:TailorObservationProfile;
        created_at:string;expires_at:string;
      }>>("measurement_profile_vault_list_owned",{p_owner_user_id:customer.id});
      const profiles=rows.filter((row)=>validProfile(row.profile)&&validObservations(row.observations)).map((row)=>({
        vaultId:row.vault_id,profile:row.profile,observations:row.observations,
        createdAt:row.created_at,expiresAt:row.expires_at,
      }));
      return jsonNoStore({profiles,customer:{email:customer.email}});
    }

    if(action==="loadOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const rows=await rpc<Array<{profile:MeasurementProfile;observations:TailorObservationProfile;expires_at:string}>>(
        "measurement_profile_vault_get_owned",
        {p_vault_id:String(body.vaultId||""),p_owner_user_id:customer.id},
      );
      const row=rows[0];
      if(!row||!validProfile(row.profile)||!validObservations(row.observations)) {
        return jsonNoStore({error:"Measurement profile was not found."},{status:404});
      }
      return jsonNoStore({profile:row.profile,observations:row.observations,expiresAt:row.expires_at});
    }

    if(action==="deleteOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const deleted=await rpc<boolean>("measurement_profile_vault_delete_owned",{
        p_vault_id:String(body.vaultId||""),p_owner_user_id:customer.id,
      });
      return jsonNoStore({deleted:Boolean(deleted)});
    }

    const parsed=parseMeasurementVaultRecoveryToken(String(body.recoveryToken||""));
    if(!parsed) return jsonNoStore({error:"The measurement recovery token is invalid."},{status:400});

    if(action==="claim"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const claimed=await rpc<boolean>("measurement_profile_vault_set_owner",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,p_owner_user_id:customer.id,
      });
      return jsonNoStore({claimed:Boolean(claimed)});
    }

    if(action==="load"){
      const rows=await rpc<Array<{profile:MeasurementProfile;observations:TailorObservationProfile;expires_at:string}>>("measurement_profile_vault_get",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
      });
      const row=rows[0];
      if(!row||!validProfile(row.profile)||!validObservations(row.observations)) {
        return jsonNoStore({error:"Measurement profile was not found or has expired."},{status:404});
      }
      return jsonNoStore({profile:row.profile,observations:row.observations,expiresAt:row.expires_at});
    }

    if(action==="delete"){
      const deleted=await rpc<boolean>("measurement_profile_vault_delete",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
      });
      return jsonNoStore({deleted:Boolean(deleted)});
    }

    return jsonNoStore({error:"Unsupported measurement-vault action."},{status:400});
  }catch(error){
    console.error("[measurements/vault]",error);
    return jsonNoStore({error:"Secure measurement storage is temporarily unavailable."},{status:503});
  }
}
