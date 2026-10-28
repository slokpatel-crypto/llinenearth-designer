import { readSecureJsonObject, secureJsonRequestError, SecureJsonBodyInvalid, SecureJsonBodyTooLarge } from "../secure-json-request.ts";
import { normalizeVaultId } from "../vault-id.ts";
import { vaultRateBlocked, type VaultRateStore } from "../vault-rate-guard.ts";

// The same public lock, share and enquiry flow must not bypass the vault's
// same-origin/UTF-8/streamed-byte contract. This is only process-local throttle.
export const LOCKED_HANDOFF_JSON_MAX_BYTES=98_304;
const handoffRequests:VaultRateStore=new Map();

export type LockedHandoffRequestResult=
  |{ok:true;revision:Record<string,unknown>}
  |{ok:false;status:number;error:string};

export async function readLockedHandoffRequest(request:Request):Promise<LockedHandoffRequestResult>{
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
  if(vaultRateBlocked(handoffRequests,ip))
    return {ok:false,status:429,error:"Too many locked-design handoff requests."};
  const unsafe=secureJsonRequestError(request,LOCKED_HANDOFF_JSON_MAX_BYTES);
  if(unsafe) return {ok:false,...unsafe};
  try{
    return {ok:true,revision:await readSecureJsonObject(request,LOCKED_HANDOFF_JSON_MAX_BYTES)};
  }catch(error){
    if(error instanceof SecureJsonBodyTooLarge) return {ok:false,status:413,error:error.message};
    if(error instanceof SecureJsonBodyInvalid) return {ok:false,status:400,error:error.message};
    throw error;
  }
}

/** A successful HTTP status alone cannot prove that a durable audit row exists. */
export function verifiedLockedHandoffAuditId(receipt:unknown):string|null{
  return normalizeVaultId(receipt);
}
