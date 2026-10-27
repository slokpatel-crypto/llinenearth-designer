import { createHash, randomBytes } from "node:crypto";
import { normalizeVaultId } from "./vault-id.ts";

export const MEASUREMENT_VAULT_TOKEN_VERSION="lem1" as const;

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
  const id=normalizeVaultId(vaultId);
  if(!id) throw new Error("Invalid measurement vault id.");
  if(!ACCESS_KEY.test(accessKey)) throw new Error("Invalid measurement vault access key.");
  return `${MEASUREMENT_VAULT_TOKEN_VERSION}.${id}.${accessKey}`;
}

export function parseMeasurementVaultRecoveryToken(token:unknown){
  if(typeof token!=="string") return null;
  const [version,rawVaultId,accessKey,extra]=token.trim().split(".");
  const vaultId=normalizeVaultId(rawVaultId);
  if(version!==MEASUREMENT_VAULT_TOKEN_VERSION||extra||!vaultId||!ACCESS_KEY.test(accessKey||"")) return null;
  return {
    version:MEASUREMENT_VAULT_TOKEN_VERSION,
    vaultId,
    accessKey,
    accessHash:hashMeasurementVaultAccessKey(accessKey),
  };
}
