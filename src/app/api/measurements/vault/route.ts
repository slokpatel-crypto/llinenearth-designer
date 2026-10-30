import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "@/lib/secure-json-request";
import { linkVaultOwnerBestEffort, resolveVaultStoreOwnerBestEffort, vaultOwnershipWarning } from "@/lib/vault-owner-link";
import { parseVaultRequestIdentifiers, vaultActionNeedsCustomerIdentity } from "@/lib/vault-request-identifiers";
import { vaultRateBlocked } from "@/lib/vault-rate-guard";
import { requireCompleteOwnedVaultRows } from "@/lib/vault-owned-list-integrity";
import { selectVaultReadRow } from "@/lib/vault-read-integrity";
import { requireVaultBooleanResult, requireVaultStoreId } from "@/lib/vault-write-integrity";
import { readBoundedJsonResponse } from "@/lib/designer/bounded-json-response";
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
    // Never buffer an untrusted error response or surface remote body details.
    throw new Error(`Measurement vault request failed (${response.status}).`);
  }
  // Single revisions/profiles are small; owned lists have a larger finite cap.
  // Oversized, malformed or interrupted upstream evidence fails closed.
  const maxBytes=name.endsWith("_list_owned")?4 * 1024 * 1024:256 * 1024;
  return await readBoundedJsonResponse(response,maxBytes) as T;
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
      const vaultId=requireVaultStoreId(await rpc<unknown>("measurement_profile_vault_store",{
        p_access_hash:accessHash,
        p_profile:profile,
        p_observations:observations,
        p_ttl_days:180,
      }));

      // Construct the recovery credential as soon as storage has been confirmed.
      // An optional account-link RPC must not turn this successful store into a 503.
      const recoveryToken=createMeasurementVaultRecoveryToken(vaultId,accessKey);
      const linkStatus=await linkVaultOwnerBestEffort(customer?.id,async ownerId=>{
        const attached=requireVaultBooleanResult(await rpc<unknown>("measurement_profile_vault_set_owner",{
          p_vault_id:vaultId,p_access_hash:accessHash,p_owner_user_id:ownerId,
        }));
        if(!attached)return false;
        // Do not claim account persistence from the owner-link boolean alone.
        // A failed owner read preserves the already-issued recovery token.
        const ownedRows=await rpc<Array<{profile:MeasurementProfile;observations:TailorObservationProfile;expires_at:string}>>(
          "measurement_profile_vault_get_owned",
          {p_vault_id:vaultId,p_owner_user_id:ownerId},
        );
        const ownedRow=selectVaultReadRow(ownedRows);
        const ownedProfile=validStoredMeasurementProfile(ownedRow?.profile);
        const ownedObservations=validStoredTailorObservationProfile(ownedRow?.observations);
        return !!ownedRow&&!!ownedProfile&&!!ownedObservations&&
          JSON.stringify(ownedProfile)===JSON.stringify(profile)&&
          JSON.stringify(ownedObservations)===JSON.stringify(observations);
      });
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
      // An installed RPC returning corrupt or repeated rows is not a verified
      // empty/partial account vault. Preserve the error rather than hiding it.
      requireCompleteOwnedVaultRows(rows,50);
      const profiles=[];
      for(const row of rows){
        const profile=validStoredMeasurementProfile(row.profile);
        const observations=validStoredTailorObservationProfile(row.observations);
        if(!profile||!observations) throw new Error("Invalid owned measurement vault row.");
        profiles.push({
          vaultId:row.vault_id,
          unit:profile.unit,
          createdAt:row.created_at,
          expiresAt:row.expires_at,
        });
      }
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
      // Confirm a single unexpired, usable profile before linking an account.
      // A set_owner success without a valid recoverable profile is not proof
      // of a successful owner-scoped measurement recovery.
      const rows=await rpc<Array<{profile:MeasurementProfile;observations:TailorObservationProfile;expires_at:string}>>("measurement_profile_vault_get",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,
      });
      const row=selectVaultReadRow(rows);
      if(!row) return jsonNoStore({error:"Measurement profile was not found or has expired."},{status:404});
      const profile=validStoredMeasurementProfile(row.profile);
      const observations=validStoredTailorObservationProfile(row.observations);
      if(!profile||!observations)
        return jsonNoStore({error:"Stored measurement profile failed integrity verification."},{status:409});
      const claimed=requireVaultBooleanResult(await rpc<unknown>("measurement_profile_vault_set_owner",{
        p_vault_id:parsed.vaultId,p_access_hash:parsed.accessHash,p_owner_user_id:customer.id,
      }));
      if(claimed){
        // Confirm the same usable measurements are visible through the
        // authenticated owner's read, not merely through a bearer token.
        const ownedRows=await rpc<Array<{profile:MeasurementProfile;observations:TailorObservationProfile;expires_at:string}>>(
          "measurement_profile_vault_get_owned",
          {p_vault_id:parsed.vaultId,p_owner_user_id:customer.id},
        );
        const ownedRow=selectVaultReadRow(ownedRows);
        const ownedProfile=validStoredMeasurementProfile(ownedRow?.profile);
        const ownedObservations=validStoredTailorObservationProfile(ownedRow?.observations);
        if(!ownedRow||!ownedProfile||!ownedObservations||
          JSON.stringify(ownedProfile)!==JSON.stringify(profile)||
          JSON.stringify(ownedObservations)!==JSON.stringify(observations)){
          throw new Error("Owner-scoped measurement recovery could not be confirmed.");
        }
      }
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
