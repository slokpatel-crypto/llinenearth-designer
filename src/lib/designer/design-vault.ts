import { createHash, randomBytes } from "node:crypto";

export const DESIGN_VAULT_TOKEN_VERSION="lev1" as const;
export const DESIGN_VAULT_ACCESS_BYTES=32;

const VAULT_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  const id=String(vaultId||"").trim().toLowerCase();
  if(!VAULT_ID.test(id)) throw new Error("Invalid design vault id.");
  if(!ACCESS_KEY.test(accessKey)) throw new Error("Invalid design vault access key.");
  return `${DESIGN_VAULT_TOKEN_VERSION}.${id}.${accessKey}`;
}

export function parseDesignVaultRecoveryToken(token:string){
  const [version,vaultId,accessKey,extra]=String(token||"").trim().split(".");
  if(version!==DESIGN_VAULT_TOKEN_VERSION||extra||!VAULT_ID.test(vaultId||"")||!ACCESS_KEY.test(accessKey||"")) return null;
  return {
    version:DESIGN_VAULT_TOKEN_VERSION,
    vaultId:vaultId.toLowerCase(),
    accessKey,
    accessHash:hashDesignVaultAccessKey(accessKey),
  };
}
