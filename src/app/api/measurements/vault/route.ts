import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { linkVaultOwnerBestEffort, resolveVaultStoreOwnerBestEffort, vaultOwnershipWarning } from "@/lib/vault-owner-link";
import { parseVaultRequestIdentifiers, vaultActionNeedsCustomerIdentity } from "@/lib/vault-request-identifiers";
import { vaultRateBlocked } from "@/lib/vault-rate-guard";
import { isVaultListRowEnvelope } from "@/lib/vault-owned-list-integrity";
import { selectVaultReadRow } from "@/lib/vault-read-integrity";
import { requireVaultBooleanResult } from "@/lib/vault-write-integrity";
import { NextResponse } from "next/server";
import { getSupabaseAdminConfig, supabaseAdminHeaders } from "@/lib/supabase-admin";
import { getCustomerIdentity } from "@/lib/customer-auth";
import { validStoredMeasurementProfile, type MeasurementProfile } from "@/lib/measurements";
import { validStoredTailorObservationProfile, type TailorObservationProfile } from "@/lib/designer/tailor-observations";
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
  return vaultRateBlocked(rate,ip);
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

export async function POST(request:Request){
  if(blocked(request)) return jsonNoStore({error:"Too many measurement-vault requests."},{status:429});
  const unsafe=secureJsonRequestError(request,16384);
  if(unsafe) return jsonNoStore({error:unsafe.error},{status:unsafe.status});
  try{
    const input:unknown=await readSecureJsonObject(request,16384);
    const body=input as {
      action?:string;
      profile?:MeasurementProfile;
      observations?:TailorObservationProfile;
      recoveryToken?:string;
      vaultId?:string;
    };
    const action=body.action;
    if(typeof action!=="string"||!["store","listOwned","loadOwned","deleteOwned","claim","load","delete"].includes(action))
      return jsonNoStore({error:"Unsupported measurement-vault action."},{status:400});
    const identifiers=parseVaultRequestIdentifiers(action,body);
    if(!identifiers.ok){
      const field=identifiers.field==="vaultId"?"vault ID":"recovery token";
      return jsonNoStore({error:`A valid ${field} string is required.`},{status:400});
    }
    const optionalOwner=action==="store"?await resolveVaultStoreOwnerBestEffort(()=>getCustomerIdentity(request)):null;
    const customer=optionalOwner?optionalOwner.customer:vaultActionNeedsCustomerIdentity(action)?await getCustomerIdentity(request):null;

    if(action==="store"){
      const profile=validStoredMeasurementProfile(body.profile);
      const observations=validStoredTailorObservationProfile(body.observations);
      if(!profile||!observations) {
        return jsonNoStore({error:"A valid measurement and tailoring profile is required."},{status:400});
      }
      const accessKey=createMeasurementVaultAccessKey();
      const accessHash=hashMeasurementVaultAccessKey(accessKey);
      const vaultId=await rpc<string>("measurement_profile_vault_store",{
        p_access_hash:accessHash,
        p_profile:profile,
        p_observations:observations,
        p_ttl_days:180,
      });

      // Construct the recovery credential as soon as storage has been confirmed.
      // An optional account-link RPC must not turn this successful store into a 503.
      const recoveryToken=createMeasurementVaultRecoveryToken(vaultId,accessKey);
      const linkStatus=await linkVaultOwnerBestEffort(customer?.id,ownerId=>
        rpc<boolean>("measurement_profile_vault_set_owner",{
          p_vault_id:vaultId,p_access_hash:accessHash,p_owner_user_id:ownerId,
        }),
      );
      return jsonNoStore({
        vaultId,recoveryToken,expiresInDays:180,
        accountOwned:linkStatus==="linked",
        ownershipWarning:optionalOwner?.lookupFailed?vaultOwnershipWarning("unavailable"):vaultOwnershipWarning(linkStatus),
        customer:customer?{email:customer.email}:null,
      });
    }

    if(action==="listOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const rows=await rpc<Array<{
        vault_id:string;profile:MeasurementProfile;observations:TailorObservationProfile;
        created_at:string;expires_at:string;
      }>>("measurement_profile_vault_list_owned",{p_owner_user_id:customer.id});
      if(!Array.isArray(rows)) throw new Error("Invalid owned measurement vault response.");
      const profiles=rows.filter((row)=>isVaultListRowEnvelope(row)&&validStoredMeasurementProfile(row.profile)&&validStoredTailorObservationProfile(row.observations)).map((row)=>({
        vaultId:row.vault_id,
        unit:row.profile.unit,
        createdAt:row.created_at,
        expiresAt:row.expires_at,
      }));
      return jsonNoStore({profiles,customer:{email:customer.email}});
    }

    if(action==="loadOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const rows=await rpc<Array<{profile:MeasurementProfile;observations:TailorObservationProfile;expires_at:string}>>(
        "measurement_profile_vault_get_owned",
        {p_vault_id:identifiers.vaultId!,p_owner_user_id:customer.id},
      );
      const row=selectVaultReadRow(rows);
      const profile=validStoredMeasurementProfile(row?.profile);
      const observations=validStoredTailorObservationProfile(row?.observations);
      if(!row||!profile||!observations) {
        return jsonNoStore({error:"Measurement profile was not found."},{status:404});
      }
      return jsonNoStore({profile,observations,expiresAt:row.expires_at});
    }

    if(action==="deleteOwned"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const deleted=requireVaultBooleanResult(await rpc<unknown>("measurement_profile_vault_delete_owned",{
        p_vault_id:identifiers.vaultId!,p_owner_user_id:customer.id,
      }));
      return jsonNoStore({deleted});
    }

    const parsed=parseMeasurementVaultRecoveryToken(identifiers.recoveryToken!);
    if(!parsed) return jsonNoStore({error:"The measurement recovery token is invalid."},{status:400});

    if(action==="claim"){
      if(!customer) return jsonNoStore({error:"Customer sign-in is required."},{status:401});
      const claimed=requireVaultBooleanResult(await rpc<unknown>("measurement_profile_vault_set_owner",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,p_owner_user_id:customer.id,
      }));
      return jsonNoStore({claimed});
    }

    if(action==="load"){
      const rows=await rpc<Array<{profile:MeasurementProfile;observations:TailorObservationProfile;expires_at:string}>>("measurement_profile_vault_get",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
      });
      const row=selectVaultReadRow(rows);
      const profile=validStoredMeasurementProfile(row?.profile);
      const observations=validStoredTailorObservationProfile(row?.observations);
      if(!row||!profile||!observations) {
        return jsonNoStore({error:"Measurement profile was not found or has expired."},{status:404});
      }
      return jsonNoStore({profile,observations,expiresAt:row.expires_at});
    }

    if(action==="delete"){
      const deleted=requireVaultBooleanResult(await rpc<unknown>("measurement_profile_vault_delete",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
      }));
      return jsonNoStore({deleted});
    }

    return jsonNoStore({error:"Unsupported measurement-vault action."},{status:400});
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return jsonNoStore({error:error.message},{status:413});
    if(error instanceof SecureJsonBodyInvalid) return jsonNoStore({error:error.message},{status:400});
    console.error("[measurements/vault]",error);
    return jsonNoStore({error:"Secure measurement storage is temporarily unavailable."},{status:503});
  }
}
