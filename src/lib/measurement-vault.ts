import { createHash, randomBytes } from "node:crypto";

export const MEASUREMENT_VAULT_TOKEN_VERSION="lem1" as const;

const VAULT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCESS_KEY=/^[A-Za-z0-9_-]{40,80}$/;

export function createMeasurementVaultAccessKey(){
  return randomBytes(32).toString("base64url");
}

export function hashMeasurementVaultAccessKey(accessKey:string){
  const key=String(accessKey||"").trim();
  if(!ACCESS_KEY.test(key)) throw new Error("Invalid measurement vault access key.");
  return createHash("sha256").update(key,"utf8").digest("hex");
}

export function createMeasurementVaultRecoveryToken(vaultId:string,accessKey:string){
  const id=String(vaultId||"").trim().toLowerCase();
  if(!VAULT_ID.test(id)) throw new Error("Invalid measurement vault id.");
  if(!ACCESS_KEY.test(accessKey)) throw new Error("Invalid measurement vault access key.");
  return `${MEASUREMENT_VAULT_TOKEN_VERSION}.${id}.${accessKey}`;
}

export function parseMeasurementVaultRecoveryToken(token:string){
  const [version,vaultId,accessKey,extra]=String(token||"").trim().split(".");
  if(version!==MEASUREMENT_VAULT_TOKEN_VERSION||extra||!VAULT_ID.test(vaultId||"")||!ACCESS_KEY.test(accessKey||"")) return null;
  return {
    version:MEASUREMENT_VAULT_TOKEN_VERSION,
    vaultId:vaultId.toLowerCase(),
    accessKey,
    accessHash:hashMeasurementVaultAccessKey(accessKey),
  };
}
