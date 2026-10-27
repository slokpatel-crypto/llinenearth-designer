import { createHash, randomBytes } from "node:crypto";
import { normalizeVaultId } from "../vault-id.ts";

export const DESIGN_VAULT_TOKEN_VERSION="lev1" as const;
export const DESIGN_VAULT_ACCESS_BYTES=32;

const ACCESS_KEY=/^[A-Za-z0-9_-]{40,80}$/;

export function createDesignVaultAccessKey(){
  return randomBytes(DESIGN_VAULT_ACCESS_BYTES).toString("base64url");
}

export function hashDesignVaultAccessKey(accessKey:string){
  const key=String(accessKey||"").trim();
  if(!ACCESS_KEY.test(key)) throw new Error("Invalid design vault access key.");
  return createHash("sha256").update(key,"utf8").digest("hex");
}

export function createDesignVaultRecoveryToken(vaultId:string,accessKey:string){
  const id=normalizeVaultId(vaultId);
  if(!id) throw new Error("Invalid design vault id.");
  if(!ACCESS_KEY.test(accessKey)) throw new Error("Invalid design vault access key.");
  return `${DESIGN_VAULT_TOKEN_VERSION}.${id}.${accessKey}`;
}

export function parseDesignVaultRecoveryToken(token:unknown){
  if(typeof token!=="string") return null;
  const [version,rawVaultId,accessKey,extra]=token.trim().split(".");
  const vaultId=normalizeVaultId(rawVaultId);
  if(version!==DESIGN_VAULT_TOKEN_VERSION||extra||!vaultId||!ACCESS_KEY.test(accessKey||"")) return null;
  return {
    version:DESIGN_VAULT_TOKEN_VERSION,
    vaultId,
    accessKey,
    accessHash:hashDesignVaultAccessKey(accessKey),
  };
}
